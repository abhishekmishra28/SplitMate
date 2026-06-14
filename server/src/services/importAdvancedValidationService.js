const { normalizeRow, parseDate } = require("./importValidationService");

function normalizeName(name) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Find a membership by display name.
 * Supports exact match (case-insensitive) and prefix/substring typo match.
 * Returns { member, isTypo } or { member: null }
 */
function findMember(name, memberships) {
  const needle = normalizeName(name);

  // Exact match
  const exact = memberships.find(
    (m) => m.user && normalizeName(m.user.name) === needle
  );
  if (exact) return { member: exact, isTypo: false };

  // Prefix match — e.g. "Priya S" starts with "Priya"
  const prefix = memberships.find(
    (m) => m.user && (
      needle.startsWith(normalizeName(m.user.name)) ||
      normalizeName(m.user.name).startsWith(needle)
    )
  );
  if (prefix) return { member: prefix, isTypo: true };

  return { member: null, isTypo: false };
}

function anomaly(type, severity, rowNumber, message, originalValue = "", suggestedValue = null, action = "needs_approval") {
  return { id: `${type}_${rowNumber}_${Date.now()}`, type, severity, rowNumber, message, originalValue, suggestedValue, action };
}

// ----------------------------------------------------------------
// Check if expense date is within a member's active membership window.
// leftAt is already a Date or null; joinedAt is a Date.
// We only flag "pre-join" for members who joined AFTER the group was created
// (i.e., they are not founding members).
// ----------------------------------------------------------------
function checkMemberTimeframe(member, expenseDateResult, rowNumber, anomalyType, memberName) {
  if (!expenseDateResult.isValid) return [];
  const expenseDate = expenseDateResult.date;
  const anomalies = [];

  const leftAt = member.leftAt ? new Date(member.leftAt) : null;
  const joinedAt = member.joinedAt ? new Date(member.joinedAt) : null;
  const groupCreatedAt = member.group?.createdAt ? new Date(member.group.createdAt) : null;

  if (leftAt && expenseDate > leftAt) {
    anomalies.push(anomaly(
      `${anomalyType}_AFTER_LEFT`,
      "approval",
      rowNumber,
      `${memberName} had already left the group on ${leftAt.toLocaleDateString("en-IN")} — before this expense date`,
      expenseDate.toLocaleDateString("en-IN")
    ));
  }

  // Only flag pre-join if they joined significantly after the group was created (non-founding member)
  if (joinedAt && expenseDate < joinedAt && groupCreatedAt) {
    const msAfterGroupCreation = joinedAt.getTime() - groupCreatedAt.getTime();
    const hoursAfter = msAfterGroupCreation / 3600000;
    if (hoursAfter > 24) {  // joined more than a day after group was formed → late joiner
      anomalies.push(anomaly(
        `${anomalyType}_BEFORE_JOIN`,
        "approval",
        rowNumber,
        `${memberName} had not yet joined the group (joined ${joinedAt.toLocaleDateString("en-IN")}) — before this expense date`,
        expenseDate.toLocaleDateString("en-IN")
      ));
    }
  }

  return anomalies;
}

// ----------------------------------------------------------------
// detectUnknownUser — validates paid_by field
// ----------------------------------------------------------------
async function detectUnknownUser(rawRow, rowNumber, memberships) {
  const row = normalizeRow(rawRow);
  if (!row.paidBy.trim()) return [];

  const { member, isTypo } = findMember(row.paidBy, memberships);
  const anomalies = [];

  if (!member) {
    anomalies.push(anomaly(
      "UNKNOWN_PAYER",
      "error",
      rowNumber,
      `Payer '${row.paidBy}' is not a member of this group`,
      row.paidBy
    ));
    return anomalies;
  }

  if (isTypo) {
    anomalies.push(anomaly(
      "PAYER_NAME_TYPO",
      "info",
      rowNumber,
      `'${row.paidBy}' auto-corrected to '${member.user.name}'`,
      row.paidBy, member.user.name, "auto_fixed"
    ));
  }

  // Check payer timeframe
  const expenseDateResult = parseDate(row.date);
  const caseAnomalies = normalizeName(row.paidBy) !== normalizeName(member.user.name) && !isTypo
    ? [anomaly("PAYER_CASE_MISMATCH", "info", rowNumber,
        `Payer name case mismatch: '${row.paidBy}' vs '${member.user.name}'`,
        row.paidBy, member.user.name, "auto_fixed")]
    : [];
  
  return [
    ...anomalies,
    ...caseAnomalies,
    ...checkMemberTimeframe(member, expenseDateResult, rowNumber, "PAYER", member.user.name),
  ];
}

// ----------------------------------------------------------------
// detectDuplicateCsvRow — exact row duplicate within the same CSV
// ----------------------------------------------------------------
function detectDuplicateCsvRow(rawRow, rowNumber, seenRows) {
  const row = normalizeRow(rawRow);
  const amountStr = String(row.amount).replace(/,/g, "").trim();
  const key = `${row.date.trim()}|${row.description.trim().toLowerCase()}|${amountStr}|${row.paidBy.trim().toLowerCase()}`;

  if (seenRows.has(key)) {
    return [anomaly(
      "DUPLICATE_CSV_ROW",
      "approval",
      rowNumber,
      `This row appears to be an exact duplicate of an earlier row in this CSV`,
      key
    )];
  }

  seenRows.add(key);
  return [];
}

// ----------------------------------------------------------------
// detectDuplicateExpenseInDb — duplicate already saved to the database
// ----------------------------------------------------------------
async function detectDuplicateExpenseInDb(rawRow, rowNumber, groupId, prisma) {
  const row = normalizeRow(rawRow);
  const amountStr = String(row.amount).replace(/,/g, "").trim();
  const amount = Number(amountStr);
  if (isNaN(amount) || amount <= 0) return [];

  const existing = await prisma.expense.findFirst({
    where: {
      groupId,
      description: { equals: row.description.trim(), mode: "insensitive" },
      amountInr: amount,
    },
  });

  if (!existing) return [];

  return [anomaly(
    "DUPLICATE_EXPENSE_DB",
    "approval",
    rowNumber,
    `An expense with description '${row.description}' and amount ₹${amount} already exists in the database`,
    row.description
  )];
}

// ----------------------------------------------------------------
// detectUnknownSplitMembers — validates split_with members
// ----------------------------------------------------------------
function detectUnknownSplitMembers(rawRow, rowNumber, memberships) {
  const row = normalizeRow(rawRow);
  if (!row.splitWith.trim()) return [];

  const names = row.splitWith.split(";").map((n) => n.trim()).filter(Boolean);
  const anomalies = [];
  const expenseDateResult = parseDate(row.date);

  for (const name of names) {
    const { member, isTypo } = findMember(name, memberships);

    if (!member) {
      anomalies.push(anomaly(
        "UNKNOWN_SPLIT_MEMBER",
        "error",
        rowNumber,
        `Split member '${name}' is not a member of this group`,
        name
      ));
      continue;
    }

    if (isTypo) {
      anomalies.push(anomaly(
        "SPLIT_MEMBER_NAME_TYPO",
        "info",
        rowNumber,
        `Split member '${name}' auto-corrected to '${member.user.name}'`,
        name, member.user.name, "auto_fixed"
      ));
    } else {
      // Check case mismatch
      if (normalizeName(name) !== normalizeName(member.user.name)) {
        anomalies.push(anomaly(
          "SPLIT_MEMBER_CASE_MISMATCH",
          "info",
          rowNumber,
          `Split member name case mismatch: '${name}' vs '${member.user.name}'`,
          name, member.user.name, "auto_fixed"
        ));
      }
    }

    anomalies.push(...checkMemberTimeframe(
      member, expenseDateResult, rowNumber, "SPLIT_MEMBER", member.user.name
    ));
  }

  return anomalies;
}

module.exports = {
  detectUnknownUser,
  detectDuplicateCsvRow,
  detectDuplicateExpenseInDb,
  detectUnknownSplitMembers,
  findMember
};