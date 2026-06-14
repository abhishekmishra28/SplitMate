import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import API from "../services/api";
import { X, Users, Search } from "lucide-react";
import toast from "react-hot-toast";

export default function CreateGroupModal({
  onClose,
  onCreated,
}) {

  const { user } = useAuth();

  const [name, setName] =
    useState("");

  const [description, setDescription] =
    useState("");

  const [searchQ, setSearchQ] =
    useState("");

  const [users, setUsers] =
    useState([]);

  const [selectedMembers, setSelectedMembers] =
    useState([]);

  useEffect(() => {

    const searchUsers =
      async () => {

        try {

          const response =
            await API.get(
              `/users/search?q=${searchQ}`
            );

          const results =
            response.data.users || [];

          setUsers(
            results.filter(
              u => u.id !== user.id
            )
          );

        } catch (error) {

          console.error(error);
        }
      };

    searchUsers();

  }, [searchQ, user.id]);

  const toggleMember = (member) => {

    setSelectedMembers(prev =>
      prev.some(
        m => m.id === member.id
      )
        ? prev.filter(
            m => m.id !== member.id
          )
        : [...prev, member]
    );
  };

  const handleCreate =
    async () => {

      try {

        if (!name.trim()) {
          toast.error(
            "Group name is required"
          );
          return;
        }

        const response =
          await API.post(
            "/groups",
            {
              name: name.trim(),
              description:
                description.trim(),
              currency: "INR",

              memberIds:
                selectedMembers.map(
                  member => member.id
                ),
            }
          );

        toast.success(
          "Group created successfully"
        );

        onCreated(
          response.data.group
        );

      } catch (error) {

        toast.error(
          error?.response?.data
            ?.message ||
            "Failed to create group"
        );
      }
    };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md shadow-2xl">

        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
              <Users className="w-4 h-4 text-violet-400" />
            </div>

            <h2 className="text-white font-semibold">
              Create Group
            </h2>
          </div>

          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">

          <div>
            <label className="block text-gray-400 text-sm mb-1.5">
              Group Name *
            </label>

            <input
              type="text"
              value={name}
              onChange={e =>
                setName(
                  e.target.value
                )
              }
              placeholder="e.g., Flat Expenses"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white"
            />
          </div>

          <div>
            <label className="block text-gray-400 text-sm mb-1.5">
              Description
            </label>

            <input
              type="text"
              value={description}
              onChange={e =>
                setDescription(
                  e.target.value
                )
              }
              placeholder="Optional"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white"
            />
          </div>

          <div>
            <label className="block text-gray-400 text-sm mb-1.5">
              Add Members
            </label>

            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />

              <input
                type="text"
                value={searchQ}
                onChange={e =>
                  setSearchQ(
                    e.target.value
                  )
                }
                placeholder="Search users..."
                className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-9 pr-4 py-2.5 text-white"
              />
            </div>

            {selectedMembers.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">

                {selectedMembers.map(
                  member => (
                    <span
                      key={member.id}
                      className="flex items-center gap-1 bg-violet-500/20 border border-violet-500/30 text-violet-300 text-xs px-2 py-1 rounded-lg"
                    >
                      {member.name}

                      <button
                        onClick={() =>
                          toggleMember(
                            member
                          )
                        }
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )
                )}
              </div>
            )}

            <div className="max-h-40 overflow-y-auto space-y-1">

              {users.map(user => (
                <div
                  key={user.id}
                  onClick={() =>
                    toggleMember(user)
                  }
                  className={`flex items-center gap-3 p-2 rounded-xl cursor-pointer transition-colors ${
                    selectedMembers.some(
                      m =>
                        m.id === user.id
                    )
                      ? "bg-violet-500/20 border border-violet-500/30"
                      : "hover:bg-gray-800"
                  }`}
                >

                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
                    {user.name[0]}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium">
                      {user.name}
                    </p>

                    <p className="text-gray-500 text-xs truncate">
                      {user.email}
                    </p>
                  </div>
                </div>
              ))}

            </div>
          </div>

          <div className="bg-gray-800/50 rounded-xl p-3 text-gray-400 text-xs">
            You will be added automatically as group creator.
          </div>

        </div>

        <div className="flex gap-3 p-6 pt-0">

          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-700 text-gray-400"
          >
            Cancel
          </button>

          <button
            onClick={handleCreate}
            className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium"
          >
            Create Group
          </button>

        </div>
      </div>
    </div>
  );
}