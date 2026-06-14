import API from "./api";

export const getExpenses = async (groupId) => {
  const res = await API.get(
    `/expenses/group/${groupId}`
  );

  return res.data.expenses;
};

export const createExpense = async (data) => {
  const res = await API.post(
    "/expenses",
    data
  );

  return res.data.expense;
};

export const deleteExpense = async (expenseId) => {
  await API.delete(`/expenses/${expenseId}`);
};