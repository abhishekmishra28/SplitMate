const prisma = require("../config/prisma");
const {
  detectUnknownUser,
  detectDuplicateCsvRow,
  detectDuplicateExpenseInDb,
  detectUnknownSplitMembers,
  findMember,
} = require("../services/importAdvancedValidationService");

const {
  createActivity,
} = require("../services/activityService");

const ACTIVITY =
  require("../constants/activityTypes");

const { validateRow, normalizeRow, parseDate } = require("../services/importValidationService");
const { parseCsv } = require("../services/csvImportService");

exports.uploadCsv = async (req, res) => {
  try {
    const { groupId } = req.params;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "CSV file is required",
      });
    }

    const rows = await parseCsv(req.file.buffer);

    const memberships = await prisma.membership.findMany({
      where: {
        groupId,
        isGuest: false,
      },
      include: {
        user: true,
        group: true,
      },
    });

    const seenRows = new Set();
    const processedRows = [];
    const anomalies = [];

    for (let index = 0; index < rows.length; index++) {
      const row = rows[index];
      const rowNumber = index + 1;

      const rowAnomalies = [
        ...validateRow(row, rowNumber),
        ...(await detectUnknownUser(row, rowNumber, memberships)),
        ...detectDuplicateCsvRow(row, rowNumber, seenRows),
        ...(await detectDuplicateExpenseInDb(row, rowNumber, groupId, prisma)),
        ...detectUnknownSplitMembers(row, rowNumber, memberships),
      ];

      anomalies.push(...rowAnomalies);

      const hasError = rowAnomalies.some((anomaly) => anomaly.severity === "error");
      const hasApproval = rowAnomalies.some((anomaly) => anomaly.severity === "approval");

      let status = "ok";
      if (hasError) {
        status = "error";
      } else if (hasApproval) {
        status = "approval";
      }

      processedRows.push({
        rowNumber,
        original: normalizeRow(row),
        anomalies: rowAnomalies,
        status,
      });
    }

    const errorRows = processedRows.filter((row) => row.status === "error").length;

    const report = await prisma.importReport.create({
      data: {
        groupId,
        importedById: req.user.id,
        filename: req.file.originalname,
        status: "reviewing",
        totalRows: rows.length,
        importedRows: rows.length - errorRows,
        skippedRows: errorRows,
        report: {
          processedRows,
          anomalies,
        },
      },
    });

    res.status(201).json({
      success: true,
      message: "CSV uploaded and validated successfully",
      summary: {
        totalRows: rows.length,
        validRows: rows.length - errorRows,
        invalidRows: errorRows,
        anomalyCount: anomalies.length,
      },
      report,
    });
  } catch (error) {
    console.error("CSV Upload Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to upload CSV",
    });
  }
};

exports.getImportReports = async (req, res) => {
  try {
    const { groupId } = req.params;

    const reports = await prisma.importReport.findMany({
      where: {
        groupId,
      },
      include: {
        importedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json({
      success: true,
      reports,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
    });
  }
};

exports.getImportReportById = async (req, res) => {
  try {
    const { reportId } = req.params;

    const report = await prisma.importReport.findUnique({
      where: {
        id: reportId,
      },
    });

    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Import report not found",
      });
    }

    res.json({
      success: true,
      report,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
    });
  }
};

exports.approveImportReport = async (req, res) => {
  try {

    const { reportId } = req.params;

    const report =
      await prisma.importReport.findUnique({
        where: {
          id: reportId,
        },
      });

    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Import report not found",
      });
    }

    // Idempotent: if already approved, just succeed
    if (report.status === "approved" || report.status === "completed") {
      return res.json({
        success: true,
        message: "Report already approved",
        report,
      });
    }

    const updatedReport =
      await prisma.importReport.update({
        where: {
          id: reportId,
        },

        data: {
          status: "approved",
        },
      });

    res.json({
      success: true,
      message: "Import report approved",
      report: updatedReport,
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      success: false,
      message: "Failed to approve report",
    });
  }
};

exports.executeImport = async (req, res) => {
  try {

    const { reportId } = req.params;

    const report = await prisma.importReport.findUnique({
      where: { id: reportId },
    });

    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Report not found",
      });
    }

    // Already completed - return success without re-running
    if (report.status === "completed") {
      return res.json({
        success: true,
        message: "Import already completed",
        importedRows: report.importedRows,
      });
    }

    if (report.status !== "approved") {
      return res.status(400).json({
        success: false,
        message: "Report must be approved before execution",
      });
    }

    const processedRows = report.report.processedRows;
    let importedCount = 0;

    const USD_RATE = parseFloat(process.env.UsdRate) || 95.11;

    const memberships = await prisma.membership.findMany({
      where: { groupId: report.groupId, isGuest: false },
      include: { user: true },
    });

    // Run each expense+splits as individual sequential writes (no wrapping transaction)
    // to avoid Prisma's default 5s transaction timeout with large imports.
    for (const rowData of processedRows) {
      if (rowData.status === "error") continue;

      const row = rowData.original;
      const { member: payerMember } = findMember(row.paidBy, memberships);
      if (!payerMember) continue;

      const amountStr = String(row.amount).replace(/,/g, "").trim();
      const amount = Number(amountStr) || 0;
      if (amount <= 0) continue;

      const currency = (row.currency || "INR").toUpperCase().trim();
      const exchangeRate = currency === "USD" ? USD_RATE : 1;
      const amountInr = parseFloat((amount * exchangeRate).toFixed(2));

      const expenseDateResult = parseDate(row.date);
      const expenseDate = expenseDateResult.isValid ? expenseDateResult.date : new Date();

      try {
        const expense = await prisma.expense.create({
          data: {
            groupId: report.groupId,
            description: row.description,
            paidById: payerMember.user.id,
            amount: amount,
            amountInr: amountInr,
            currency: currency,
            exchangeRate: exchangeRate,
            splitType: row.splitType || "equal",
            expenseDate: expenseDate,
            createdById: report.importedById,
          },
        });

        const splitMembers = row.splitWith ? row.splitWith.split(";").map(n => n.trim()).filter(Boolean) : [];
        const validMembers = [];
        for (const memberName of splitMembers) {
          const { member } = findMember(memberName, memberships);
          if (member) validMembers.push(member);
        }

        // Splits are always in INR (converted)
        const amountInrPerMember = validMembers.length > 0 ? amountInr / validMembers.length : amountInr;
        for (const member of validMembers) {
          await prisma.expenseSplit.create({
            data: {
              expenseId: expense.id,
              userId: member.user.id,
              amountOwed: parseFloat(amountInrPerMember.toFixed(2)),
            },
          });
        }

        importedCount++;
      } catch (rowErr) {
        console.error(`Row ${rowData.rowNumber} import failed:`, rowErr.message);
        // Continue with remaining rows
      }
    }

    await prisma.importReport.update({
      where: { id: reportId },
      data: {
        status: "completed",
        importedRows: importedCount,
        completedAt: new Date(),
      },
    });

    await createActivity({
      groupId: report.groupId,
      userId: report.importedById,
      type: ACTIVITY.EXPENSE_CREATED,
      title: "CSV Import Completed",
      description: `${importedCount} expenses imported`,
    });

    res.json({
      success: true,
      message: "Import executed successfully",
      importedRows: importedCount,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to execute import",
    });
  }
};