import API from "./api";

export const getSettlements = async (groupId) => {
  const res = await API.get(
    `/settlements/group/${groupId}`
  );

  return res.data.settlements;
};

export const createSettlement = async (data) => {
  const res = await API.post(
    "/settlements",
    data
  );

  return res.data.settlement;
};

export const deleteSettlement = async (id) => {
  await API.delete(
    `/settlements/${id}`
  );
};