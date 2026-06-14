/**
 * Normalizes a raw CSV row to a consistent shape regardless of header casing.
 * CSV headers: date, description, paid_by, amount, currency, split_type, split_with, split_details, notes
 */
function normalizeRow(raw) {
  return {
    date:         raw.date          || raw.Date          || "",
    description:  raw.description   || raw.Description   || "",
    paidBy:       raw.paid_by       || raw.paidBy        || raw.PaidBy       || "",
    amount:       raw.amount        || raw.Amount        || "",
    currency:     raw.currency      || raw.Currency      || "",
    splitType:    raw.split_type    || raw.splitType     || raw.SplitType    || "",
    splitWith:    raw.split_with    || raw.splitWith     || raw.SplitWith    || "",
    splitDetails: raw.split_details || raw.splitDetails  || raw.SplitDetails || "",
    notes:        raw.notes         || raw.Notes         || "",
  };
}

/**
 * Parses a date string that may be in:
 *  - DD/MM/YYYY   e.g. "01/02/2026"
 *  - DD-MM-YYYY   e.g. "05-04-2026"
 *  - Mon-DD       e.g. "Mar-14"  (malformed — no year)
 *  - YYYY-MM-DD   standard ISO
 * Returns { date: Date|null, isValid: bool, isMalformed: bool }
 */
function parseDate(dateStr) {
  if (!dateStr || !dateStr.trim()) return { date: null, isValid: false, isMalformed: false };

  const str = dateStr.trim();

  // DD/MM/YYYY
  const slashMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, dd, mm, yyyy] = slashMatch;
    const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
    const valid = d.getFullYear() === Number(yyyy) && d.getMonth() === Number(mm) - 1 && d.getDate() === Number(dd);
    return { date: d, isValid: valid, isMalformed: false };
  }

  // DD-MM-YYYY
  const dashFull = str.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dashFull) {
    const [, dd, mm, yyyy] = dashFull;
    const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
    const valid = d.getFullYear() === Number(yyyy) && d.getMonth() === Number(mm) - 1 && d.getDate() === Number(dd);
    return { date: d, isValid: valid, isMalformed: false };
  }

  // YYYY-MM-DD ISO
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const d = new Date(str);
    return { date: d, isValid: !isNaN(d.getTime()), isMalformed: false };
  }

  // Anything else (e.g. "Mar-14", "Mar 14") — malformed
  return { date: null, isValid: false, isMalformed: true };
}

const VALID_SPLIT_TYPES = ["equal", "exact", "percentage", "share", "custom"];

function anomaly(type, severity, rowNumber, message, originalValue = "", suggestedValue = null, action = "needs_approval") {
  return { id: `${type}_${rowNumber}_${Date.now()}`, type, severity, rowNumber, message, originalValue, suggestedValue, action };
}

function validateRow(rawRow, rowNumber) {
  const row = normalizeRow(rawRow);
  const anomalies = [];

  // ---------- DESCRIPTION ----------
  if (!row.description.trim()) {
    anomalies.push(anomaly("MISSING_DESCRIPTION", "error", rowNumber, "Description is required"));
  } else {
    // Settlement disguised as expense
    const desc = row.description.toLowerCase();
    if (desc.includes("paid back") || desc.includes("paid aisha back") ||
        desc.includes("settlement") || desc.includes("deposit share")) {
      anomalies.push(anomaly("SETTLEMENT_AS_EXPENSE", "approval", rowNumber,
        "This row looks like a settlement payment, not a shared expense", row.description));
    }
  }

  // ---------- AMOUNT ----------
  let amountStr = String(row.amount).trim();
  if (!amountStr || amountStr === "undefined" || amountStr === "null") {
    anomalies.push(anomaly("MISSING_AMOUNT", "error", rowNumber, "Amount is required"));
  } else {
    // Strip commas e.g. "1,200"
    const hadCommas = amountStr.includes(",");
    if (hadCommas) {
      const fixed = amountStr.replace(/,/g, "");
      anomalies.push(anomaly("COMMAS_IN_AMOUNT", "info", rowNumber,
        `Amount '${amountStr}' contains commas — auto-corrected to '${fixed}'`,
        amountStr, fixed, "auto_fixed"));
      amountStr = fixed;
    }

    const amount = Number(amountStr);
    if (isNaN(amount)) {
      anomalies.push(anomaly("INVALID_AMOUNT", "error", rowNumber, `Amount '${row.amount}' is not a valid number`, row.amount));
    } else {
      // Excessive decimal places e.g. 899.995
      if (amountStr.includes(".") && amountStr.split(".")[1].length > 2) {
        const rounded = Number(amount.toFixed(2)).toString();
        anomalies.push(anomaly("INVALID_PRECISION", "info", rowNumber,
          `Amount '${row.amount}' has excessive decimal places — auto-rounded to '${rounded}'`,
          row.amount, rounded, "auto_fixed"));
      }
      // Zero amount
      if (amount === 0) {
        anomalies.push(anomaly("ZERO_AMOUNT", "approval", rowNumber,
          "Amount is zero — may be a data correction or placeholder", row.amount));
      }
      // Negative amount (refund)
      if (amount < 0) {
        anomalies.push(anomaly("NEGATIVE_AMOUNT", "approval", rowNumber,
          "Negative amount implies a refund", row.amount));
      }
    }
  }

  // ---------- PAYER ----------
  if (!row.paidBy.trim()) {
    anomalies.push(anomaly("MISSING_PAYER", "error", rowNumber, "paid_by field is required"));
  }

  // ---------- DATE ----------
  if (!row.date.trim()) {
    anomalies.push(anomaly("MISSING_DATE", "error", rowNumber, "Date is required"));
  } else {
    const { isValid, isMalformed } = parseDate(row.date);
    if (isMalformed) {
      anomalies.push(anomaly("INVALID_DATE_FORMAT", "error", rowNumber,
        `Date '${row.date}' is malformed (expected DD/MM/YYYY or DD-MM-YYYY)`, row.date));
    } else if (!isValid) {
      anomalies.push(anomaly("INVALID_DATE", "error", rowNumber,
        `Date '${row.date}' is not a valid calendar date`, row.date));
    }
  }

  // ---------- SPLIT TYPE ----------
  if (!row.splitType.trim()) {
    anomalies.push(anomaly("MISSING_SPLIT_TYPE", "error", rowNumber, "split_type field is required"));
  } else if (!VALID_SPLIT_TYPES.includes(row.splitType.toLowerCase().trim())) {
    anomalies.push(anomaly("INVALID_SPLIT_TYPE", "error", rowNumber,
      `Invalid split type '${row.splitType}'`, row.splitType));
  }

  // ---------- SPLIT WITH ----------
  if (!row.splitWith.trim()) {
    anomalies.push(anomaly("MISSING_SPLIT_MEMBERS", "approval", rowNumber,
      "No split_with members provided — expense is unsplit"));
  }

  // ---------- PERCENTAGE VALIDATION ----------
  if (row.splitType.toLowerCase().trim() === "percentage" && row.splitDetails.trim()) {
    // Format: "Aisha:50;Rohan:50" or "Aisha:40;Rohan:40;Priya:40;Sam:0"
    const parts = row.splitDetails.split(";");
    const sum = parts.reduce((acc, part) => {
      const colonIdx = part.lastIndexOf(":");
      if (colonIdx === -1) return acc;
      const val = Number(part.slice(colonIdx + 1).trim());
      return acc + (isNaN(val) ? 0 : val);
    }, 0);
    if (Math.abs(sum - 100) > 0.01) {
      anomalies.push(anomaly("INVALID_PERCENTAGE_SUM", "error", rowNumber,
        `Percentages sum to ${sum.toFixed(2)}% instead of 100%`, row.splitDetails));
    }
  }

  // ---------- CURRENCY ----------
  if (!row.currency.trim()) {
    anomalies.push(anomaly("MISSING_CURRENCY", "info", rowNumber,
      "Currency missing — defaulting to INR", "", "INR", "auto_fixed"));
  } else {
    const cur = row.currency.toUpperCase().trim();
    if (cur === "USD") {
      const usdRate = parseFloat(process.env.UsdRate) || 95.11;
      const amountStr = String(row.amount).replace(/,/g, "").trim();
      const amount = Number(amountStr);
      const inrEquiv = isNaN(amount) ? "" : ` (≈ ₹${(amount * usdRate).toFixed(2)} @ ₹${usdRate}/USD)`;
      anomalies.push(anomaly("FOREIGN_CURRENCY_USD", "approval", rowNumber,
        `Amount is in USD${inrEquiv} — will be converted to INR on import`, row.currency));
    } else if (cur !== "INR") {
      anomalies.push(anomaly("UNSUPPORTED_CURRENCY", "error", rowNumber,
        `Currency '${row.currency}' is not supported`, row.currency));
    }
  }

  return anomalies;
}

module.exports = { validateRow, normalizeRow, parseDate };