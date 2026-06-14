import API from "./api";

export const getGroup = async (groupId) => {
  const res = await API.get(`/groups/${groupId}`);
  return res.data.group;
};

export const getMembers = async (groupId) => {
  const res = await API.get(`/groups/${groupId}/members`);
  return res.data.members;
};

export const addMember = async (groupId, userId) => {
  const res = await API.post(`/groups/${groupId}/members`, {
    userId,
  });

  return res.data;
};