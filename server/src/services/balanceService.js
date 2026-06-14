function round(value) {
  return Math.round(value * 100) / 100;
}

function calculateBalances(
  expenses,
  settlements,
  memberIds,
  memberMap
) {
  const net = {};

  memberIds.forEach((id) => {
    net[id] = 0;
  });

  for (const expense of expenses) {
    if (expense.isSettlement) continue;

    net[expense.paidById] += expense.amountInr;

    for (const split of expense.splits) {
      if (!split.userId) continue;

      net[split.userId] -= split.amountOwed;
    }
  }

  for (const settlement of settlements) {
    net[settlement.fromUserId] += settlement.amount;

    net[settlement.toUserId] -= settlement.amount;
  }

  return memberIds.map((userId) => ({
    userId,
    userName: memberMap[userId],
    netBalance: Math.round(net[userId] * 100) / 100
  }));
}

function simplifyDebts(balances) {
  const creditors = balances
    .filter((u) => u.netBalance > 0.01)
    .map((u) => ({
      ...u,
      amount: u.netBalance
    }));

  const debtors = balances
    .filter((u) => u.netBalance < -0.01)
    .map((u) => ({
      ...u,
      amount: Math.abs(u.netBalance)
    }));

  const transactions = [];

  let i = 0;
  let j = 0;

  while (
    i < creditors.length &&
    j < debtors.length
  ) {
    const creditor = creditors[i];
    const debtor = debtors[j];

    const amount = Math.min(
      creditor.amount,
      debtor.amount
    );

    transactions.push({
      fromUserId: debtor.userId,
      fromUserName: debtor.userName,

      toUserId: creditor.userId,
      toUserName: creditor.userName,

      amount: Number(amount.toFixed(2))
    });

    creditor.amount -= amount;
    debtor.amount -= amount;

    if (creditor.amount < 0.01) i++;
    if (debtor.amount < 0.01) j++;
  }

  return transactions;
}

function getUserExpenseBreakdown(
  userId,
  expenses,
  settlements
) {
  const rows = [];

  for (const expense of expenses) {

    if (expense.paidById === userId) {
      rows.push({
        type: "paid",
        description: expense.description,
        amount: expense.amountInr,
        date: expense.expenseDate
      });
    }

    const split = expense.splits.find(
      s => s.userId === userId
    );

    if (split) {
      rows.push({
        type: "owed",
        description: expense.description,
        amount: split.amountOwed,
        date: expense.expenseDate
      });
    }
  }

  for (const settlement of settlements) {

    if (settlement.fromUserId === userId) {
      rows.push({
        type: "settlement_sent",
        amount: settlement.amount,
        date: settlement.settledAt
      });
    }

    if (settlement.toUserId === userId) {
      rows.push({
        type: "settlement_received",
        amount: settlement.amount,
        date: settlement.settledAt
      });
    }
  }

  return rows;
}

module.exports = {
  calculateBalances,
  simplifyDebts,
  getUserExpenseBreakdown
};