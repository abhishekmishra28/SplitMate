function round(value) {
  return Math.round(value * 100) / 100;
}

function calculateEqualSplit(amount, memberIds) {
  const splits = [];

  const perPerson = round(amount / memberIds.length);

  let totalAssigned = 0;

  memberIds.forEach((userId, index) => {
    let share = perPerson;

    if (index === 0) {
      share = round(amount - perPerson * (memberIds.length - 1));
    }

    totalAssigned += share;

    splits.push({
      userId,
      amountOwed: share,
    });
  });

  return splits;
}

function calculateExactSplit(customAmounts) {
  return Object.entries(customAmounts).map(([userId, amount]) => ({
    userId,
    amountOwed: round(Number(amount)),
  }));
}

function calculatePercentageSplit(amount, percentages) {
  const splits = [];

  Object.entries(percentages).forEach(([userId, percentage]) => {
    splits.push({
      userId,
      amountOwed: round((Number(percentage) / 100) * amount),
      percentage: Number(percentage),
    });
  });

  return splits;
}

function calculateShareSplit(amount, shares) {
  const totalShares = Object.values(shares).reduce(
    (sum, share) => sum + Number(share),
    0
  );

  return Object.entries(shares).map(([userId, share]) => ({
    userId,
    amountOwed: round((Number(share) / totalShares) * amount),
    share: Number(share),
  }));
}

function calculateCustomSplit(customAmounts) {
  return Object.entries(customAmounts).map(([userId, amount]) => ({
    userId,
    amountOwed: round(Number(amount)),
  }));
}

function generateSplits({
  amount,
  splitType,
  memberIds,
  customAmounts,
  percentages,
  shares,
}) {
  switch (splitType) {
    case "equal":
      return calculateEqualSplit(amount, memberIds);

    case "exact":
      return calculateExactSplit(customAmounts);

    case "percentage":
      return calculatePercentageSplit(amount, percentages);

    case "share":
      return calculateShareSplit(amount, shares);

    case "custom":
      return calculateCustomSplit(customAmounts);

    default:
      throw new Error("Invalid split type");
  }
}

module.exports = {
  generateSplits,
  calculateEqualSplit,
  calculateExactSplit,
  calculatePercentageSplit,
  calculateShareSplit,
  calculateCustomSplit,
};