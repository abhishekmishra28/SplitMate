import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import API from '../services/api';
import toast from 'react-hot-toast';
import { format, parseISO } from 'date-fns';
import {
  ArrowLeft, Plus, Upload, Users, Receipt, BarChart3, ArrowRight,
  Trash2, TrendingUp, TrendingDown, CheckCircle,
  X, Search, Calendar, SplitSquareHorizontal, Wallet, CreditCard
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';

const COLORS = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#6366f1'];
const SPLIT_TYPES = ['equal', 'exact', 'percentage', 'share'];

// ── Modals ────────────────────────────────────────────────────

function AddExpenseModal({ groupId, members, currentUser, onClose, onAdded }) {
  const [form, setForm] = useState({
    description: '',
    amount: '',
    currency: 'INR',
    paidBy: currentUser.id,
    splitType: 'equal',
    expenseDate: new Date().toISOString().split('T')[0],
    notes: '',
    isRefund: false,
  });
  const [splitAmounts, setSplitAmounts] = useState({});
  const [selectedMembers, setSelectedMembers] = useState(members.map(m => m.user?.id || m.userId).filter(Boolean));
  const [loading, setLoading] = useState(false);

  const USD_RATE = 83.5;
  const amountInr = form.currency === 'USD'
    ? (parseFloat(form.amount) || 0) * USD_RATE
    : (parseFloat(form.amount) || 0);

  const perPerson = selectedMembers.length > 0 ? amountInr / selectedMembers.length : 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const amt = parseFloat(form.amount);
      if (!amt || isNaN(amt)) { toast.error('Invalid amount'); return; }
      if (!form.description.trim()) { toast.error('Description required'); return; }
      if (selectedMembers.length === 0) { toast.error('Select at least one member'); return; }

      let reqPayload = {
        groupId,
        description: form.description.trim(),
        paidById: form.paidBy,
        amount: Math.abs(amt),
        currency: form.currency,
        splitType: form.splitType,
        expenseDate: new Date(form.expenseDate).toISOString(),
        notes: form.notes,
        isRefund: form.isRefund,
        memberIds: selectedMembers
      };

      if (form.splitType === 'exact') {
        const customAmounts = {};
        selectedMembers.forEach(uid => {
          customAmounts[uid] = parseFloat(splitAmounts[uid] || 0);
        });
        const total = Object.values(customAmounts).reduce((s, a) => s + a, 0);
        if (Math.abs(total - amountInr) > 0.5) {
          toast.error(`Exact amounts sum to ₹${total.toFixed(2)} but expense is ₹${amountInr.toFixed(2)}`);
          return;
        }
        reqPayload.customAmounts = customAmounts;
      } else if (form.splitType === 'percentage') {
        const percentages = {};
        selectedMembers.forEach(uid => {
          percentages[uid] = parseFloat(splitAmounts[uid] || 0);
        });
        const totalPct = Object.values(percentages).reduce((s, p) => s + p, 0);
        if (Math.abs(totalPct - 100) > 0.1) {
          toast.error(`Percentages sum to ${totalPct.toFixed(1)}% (must be 100%)`);
          return;
        }
        reqPayload.percentages = percentages;
      } else if (form.splitType === 'share') {
        const shares = {};
        selectedMembers.forEach(uid => {
          shares[uid] = parseFloat(splitAmounts[uid] || 1);
        });
        reqPayload.shares = shares;
      }

      await API.post('/expenses', reqPayload);
      toast.success('Expense added!');
      onAdded();
      onClose();
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Failed to add expense');
    } finally {
      setLoading(false);
    }
  };

  const memberUsers = members.map(m => m.user).filter(Boolean);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg shadow-2xl my-4">
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
              <Plus className="w-4 h-4 text-violet-400" />
            </div>
            <h2 className="text-white font-semibold">Add Expense</h2>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto max-h-[70vh]">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-gray-400 text-xs mb-1">Description *</label>
              <input
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="e.g., Dinner at Zomato"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-gray-400 text-xs mb-1">Amount *</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                placeholder="0.00"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-gray-400 text-xs mb-1">Currency</label>
              <select
                value={form.currency}
                onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-violet-500 text-sm"
              >
                <option value="INR">INR (₹)</option>
                <option value="USD">USD ($)</option>
              </select>
            </div>
            {form.currency === 'USD' && (
              <div className="col-span-2 bg-amber-900/20 border border-amber-700/30 rounded-xl p-2 text-amber-300 text-xs">
                ${ parseFloat(form.amount) || 0} USD = ₹{((parseFloat(form.amount) || 0) * USD_RATE).toFixed(2)} INR (rate: 83.5)
              </div>
            )}
            <div>
              <label className="block text-gray-400 text-xs mb-1">Paid by</label>
              <select
                value={form.paidBy}
                onChange={e => setForm(f => ({ ...f, paidBy: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-violet-500 text-sm"
              >
                {memberUsers.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-gray-400 text-xs mb-1">Date</label>
              <input
                type="date"
                value={form.expenseDate}
                onChange={e => setForm(f => ({ ...f, expenseDate: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-violet-500 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-gray-400 text-xs mb-2">Split Type</label>
            <div className="grid grid-cols-4 gap-1.5">
              {SPLIT_TYPES.map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, splitType: t }))}
                  className={`py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${
                    form.splitType === t
                      ? 'bg-violet-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-gray-400 text-xs mb-2">
              Split with ({selectedMembers.length} members)
              {form.splitType === 'equal' && amountInr > 0 && (
                <span className="ml-2 text-violet-400">₹{(amountInr / Math.max(selectedMembers.length, 1)).toFixed(2)} each</span>
              )}
            </label>
            <div className="space-y-1.5">
              {memberUsers.map(u => {
                const isSelected = selectedMembers.includes(u.id);
                return (
                  <div
                    key={u.id}
                    className={`flex items-center gap-3 p-2.5 rounded-xl border transition-colors ${
                      isSelected ? 'border-violet-500/30 bg-violet-500/5' : 'border-gray-800 opacity-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => setSelectedMembers(prev =>
                        isSelected ? prev.filter(id => id !== u.id) : [...prev, u.id]
                      )}
                      className="accent-violet-500"
                    />
                    <div className="w-7 h-7 rounded-full bg-violet-500/30 flex items-center justify-center text-violet-300 text-xs font-bold flex-shrink-0">
                      {u.name[0]}
                    </div>
                    <span className="text-white text-sm flex-1">{u.name}</span>
                    {isSelected && form.splitType !== 'equal' && (
                      <div className="flex items-center gap-1">
                        {form.splitType === 'percentage' && <span className="text-gray-500 text-xs">%</span>}
                        {form.splitType === 'share' && <span className="text-gray-500 text-xs">×</span>}
                        {form.splitType === 'exact' && <span className="text-gray-500 text-xs">₹</span>}
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={splitAmounts[u.id] || ''}
                          onChange={e => setSplitAmounts(prev => ({ ...prev, [u.id]: e.target.value }))}
                          placeholder={form.splitType === 'share' ? '1' : form.splitType === 'percentage' ? '0' : '0.00'}
                          className="w-20 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-white text-xs focus:outline-none focus:border-violet-500"
                        />
                      </div>
                    )}
                    {isSelected && form.splitType === 'equal' && (
                      <span className="text-violet-300 text-xs font-medium">₹{perPerson.toFixed(2)}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-gray-400 text-xs mb-1">Notes (optional)</label>
              <input
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Any notes..."
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 text-sm"
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isRefund}
                  onChange={e => setForm(f => ({ ...f, isRefund: e.target.checked }))}
                  className="accent-violet-500"
                />
                <span className="text-gray-400 text-sm">Mark as refund</span>
              </label>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-700 text-gray-400 hover:text-white text-sm">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium">
              Add Expense
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SettleModal({ groupId, members, currentUser, debts, onClose, onSettled }) {
  const [form, setForm] = useState({
    from: currentUser.id,
    to: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const myDebts = debts.filter(d => d.fromUserId === currentUser.id || d.toUserId === currentUser.id);
  const memberUsers = members.map(m => m.user).filter(Boolean).filter(u => u.id !== currentUser.id);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const amt = parseFloat(form.amount);
    if (!amt || isNaN(amt) || amt <= 0) { toast.error('Invalid amount'); return; }
    if (!form.to) { toast.error('Select recipient'); return; }

    try {
      await API.post('/settlements', {
        groupId,
        fromUserId: form.from,
        toUserId: form.to,
        amount: amt,
        settledAt: new Date(form.date).toISOString(),
        notes: form.notes,
      });

      toast.success('Settlement recorded!');
      onSettled();
      onClose();
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Failed to record settlement');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
            </div>
            <h2 className="text-white font-semibold">Record Settlement</h2>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        {myDebts.length > 0 && (
          <div className="px-6 pt-4">
            <p className="text-gray-400 text-xs mb-2">Suggested settlements</p>
            <div className="space-y-1.5">
              {myDebts.map((d, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, from: d.fromUserId, to: d.toUserId, amount: d.amount.toFixed(2) }))}
                  className="w-full flex items-center gap-2 p-2 bg-gray-800 hover:bg-gray-700 rounded-xl text-left transition-colors"
                >
                  <span className="text-sm text-gray-300">{d.fromUserName}</span>
                  <ArrowRight className="w-3 h-3 text-gray-500" />
                  <span className="text-sm text-gray-300">{d.toUserName}</span>
                  <span className="ml-auto text-violet-400 text-sm font-medium">₹{d.amount.toFixed(0)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-gray-400 text-xs mb-1">From</label>
              <select
                value={form.from}
                onChange={e => setForm(f => ({ ...f, from: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
              >
                {members.map(m => {
                  const u = m.user;
                  return u ? <option key={u.id} value={u.id}>{u.name}</option> : null;
                })}
              </select>
            </div>
            <div>
              <label className="block text-gray-400 text-xs mb-1">To</label>
              <select
                value={form.to}
                onChange={e => setForm(f => ({ ...f, to: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
                required
              >
                <option value="">Select...</option>
                {members.map(m => {
                  const u = m.user;
                  return u ? <option key={u.id} value={u.id}>{u.name}</option> : null;
                })}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-gray-400 text-xs mb-1">Amount (₹)</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
                required
              />
            </div>
            <div>
              <label className="block text-gray-400 text-xs mb-1">Date</label>
              <input
                type="date"
                value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-gray-400 text-xs mb-1">Notes</label>
            <input
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="e.g., UPI transfer"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
            />
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-700 text-gray-400 text-sm">Cancel</button>
            <button type="submit" className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium">Record</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ManageMembersModal({ group, memberships, onClose, onUpdated }) {
  const [searchQ, setSearchQ] = useState('');
  const [users, setUsers] = useState([]);
  const activeMembers = memberships.filter(m => !m.leftAt);

  useEffect(() => {
    const searchUsers = async () => {
      if (!searchQ.trim()) {
        setUsers([]);
        return;
      }
      try {
        const response = await API.get(`/users/search?q=${searchQ}`);
        setUsers(response.data.users || []);
      } catch (error) {
        console.error(error);
      }
    };
    const timeoutId = setTimeout(searchUsers, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQ]);

  const filtered = users.filter(u =>
    !activeMembers.some(m => m.user?.id === u.id)
  );

  const addMember = async (userId) => {
    try {
      await API.post(`/groups/${group.id}/members`, { userId });
      toast.success('Member added!');
      onUpdated();
    } catch (error) {
      toast.error('Failed to add member');
    }
  };

  const removeMember = async (membership) => {
    try {
      await API.delete(`/groups/${group.id}/members/${membership.user?.id || membership.userId}`);
      toast.success('Member removed');
      onUpdated();
    } catch (error) {
      toast.error('Failed to remove member');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
              <Users className="w-4 h-4 text-blue-400" />
            </div>
            <h2 className="text-white font-semibold">Manage Members</h2>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <p className="text-gray-400 text-xs mb-2">Active Members ({activeMembers.length})</p>
            <div className="space-y-1.5">
              {activeMembers.map(m => {
                const u = m.user;
                if (!u) return null;
                const isCreator = group.createdById === u.id || group.creator?.id === u.id;
                return (
                  <div key={m.id} className="flex items-center gap-3 p-2.5 bg-gray-800/50 rounded-xl">
                    <div className="w-7 h-7 rounded-full bg-violet-500/30 flex items-center justify-center text-violet-300 text-xs font-bold">
                      {u.name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm">{u.name}</p>
                      <p className="text-gray-500 text-xs">Joined {format(parseISO(m.joinedAt || m.createdAt || new Date().toISOString()), 'MMM d, yyyy')}</p>
                    </div>
                    {isCreator ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300">Admin</span>
                    ) : (
                      <button
                        onClick={() => removeMember(m)}
                        className="text-gray-600 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-gray-400 text-xs mb-2">Add Member</p>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                placeholder="Search users..."
                className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-9 pr-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 text-sm"
              />
            </div>
            <div className="max-h-40 overflow-y-auto space-y-1">
              {filtered.slice(0, 6).map(u => (
                <div key={u.id} className="flex items-center gap-3 p-2 hover:bg-gray-800 rounded-xl">
                  <div className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center text-gray-300 text-xs font-bold">
                    {u.name[0]}
                  </div>
                  <div className="flex-1">
                    <p className="text-white text-sm">{u.name}</p>
                    <p className="text-gray-500 text-xs">{u.email}</p>
                  </div>
                  <button
                    onClick={() => addMember(u.id)}
                    className="text-violet-400 hover:text-violet-300"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {filtered.length === 0 && searchQ && (
                <p className="text-gray-600 text-xs text-center py-2">No users found</p>
              )}
            </div>
          </div>

          <button onClick={onClose} className="w-full py-2.5 rounded-xl border border-gray-700 text-gray-400 hover:text-white text-sm">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main GroupView ────────────────────────────────────────────

export default function GroupView() {
  const { groupId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('expenses'); // expenses | balances | analytics | records
  
  const [group, setGroup] = useState(null);
  const [memberships, setMemberships] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [balances, setBalances] = useState([]);
  const [debts, setDebts] = useState([]);
  
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showSettle, setShowSettle] = useState(false);
  const [showManageMembers, setShowManageMembers] = useState(false);
  const [selectedUserBreakdown, setSelectedUserBreakdown] = useState(null);
  const [filterSearch, setFilterSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null); // { type: 'expense'|'settlement'|'group', id, label }

  const loadData = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      else setRefreshing(true);
      const [
        groupRes,
        expensesRes,
        settlementsRes,
        balancesRes,
        debtsRes
      ] = await Promise.all([
        API.get(`/groups/${groupId}`),
        API.get(`/expenses/group/${groupId}`),
        API.get(`/settlements/group/${groupId}`),
        API.get(`/groups/${groupId}/balances`),
        API.get(`/groups/${groupId}/debts`)
      ]);

      if (groupRes.data.success) {
        setGroup(groupRes.data.group);
        setMemberships(groupRes.data.group.memberships || []);
      }
      if (expensesRes.data.success) setExpenses(expensesRes.data.expenses);
      if (settlementsRes.data.success) setSettlements(settlementsRes.data.settlements);
      if (balancesRes.data.success) setBalances(balancesRes.data.balances);
      if (debtsRes.data.success) setDebts(debtsRes.data.debts);
      
    } catch (error) {
      console.error(error);
      if (!silent) {
        toast.error('Failed to load group details');
        navigate('/dashboard');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [groupId, navigate]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleDeleteExpense = async (expense) => {
    setConfirmDelete({ type: 'expense', id: expense.id, label: expense.description });
  };

  const handleDeleteSettlement = async (settlement) => {
    setConfirmDelete({ type: 'settlement', id: settlement.id, label: `₹${settlement.amount?.toFixed(0)} settlement` });
  };

  const handleDeleteGroup = () => {
    setConfirmDelete({ type: 'group', id: groupId, label: group?.name });
  };

  const executeDelete = async () => {
    if (!confirmDelete) return;
    const { type, id } = confirmDelete;
    setConfirmDelete(null);
    try {
      if (type === 'expense') {
        await API.delete(`/expenses/${id}`);
        setExpenses(prev => prev.filter(e => e.id !== id));
        toast.success('Expense deleted');
        loadData(true);
      } else if (type === 'settlement') {
        await API.delete(`/settlements/${id}`);
        setSettlements(prev => prev.filter(s => s.id !== id));
        toast.success('Settlement removed');
        loadData(true);
      } else if (type === 'group') {
        await API.delete(`/groups/${id}`);
        toast.success('Group deleted');
        navigate('/dashboard');
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || `Failed to delete ${type}`);
    }
  };

  if (loading || !group) return <div className="p-6 text-center text-gray-500">Loading group...</div>;

  const activeMembers = memberships.filter(m => !m.leftAt);
  const isAdmin = group.createdById === user.id || group.creator?.id === user.id;
  const myBalance = balances.find(b => b.userId === user.id);

  const getUserName = (id) => {
    const mem = memberships.find(m => m.user?.id === id);
    return mem?.user?.name || 'Unknown User';
  };

  const filteredExpenses = expenses.filter(e =>
    !filterSearch ||
    e.description.toLowerCase().includes(filterSearch.toLowerCase()) ||
    getUserName(e.paidById).toLowerCase().includes(filterSearch.toLowerCase())
  );

  // Analytics data
  const monthlyData = {};
  expenses.forEach(e => {
    const month = e.expenseDate.substring(0, 7);
    monthlyData[month] = (monthlyData[month] || 0) + e.amountInr;
  });
  const monthlyChart = Object.entries(monthlyData)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, amount]) => ({ month: format(parseISO(month + '-01'), 'MMM'), amount: Math.round(amount) }));

  const payerData = {};
  expenses.forEach(e => {
    const name = getUserName(e.paidById);
    payerData[name] = (payerData[name] || 0) + e.amountInr;
  });
  const payerChart = Object.entries(payerData).map(([name, amount]) => ({ name, amount: Math.round(amount) }));

  // Re-implementing a simple breakdown function to replace the one from balanceCalculator locally
  const getUserExpenseBreakdownLocal = (userId, expList, settList) => {
    const breakdown = [];
    expList.forEach(e => {
      if (e.paidById === userId) {
        breakdown.push({ description: e.description, date: e.expenseDate, type: 'paid', impact: e.amountInr });
      }
      const mySplit = e.splits?.find(s => s.userId === userId);
      if (mySplit && mySplit.amountOwed > 0) {
        breakdown.push({ description: e.description, date: e.expenseDate, type: 'owed', impact: -mySplit.amountOwed });
      }
    });
    settList.forEach(s => {
      if (s.fromUserId === userId) breakdown.push({ description: 'Settlement paid', date: s.settledAt, type: 'settlement', impact: s.amount });
      if (s.toUserId === userId) breakdown.push({ description: 'Settlement received', date: s.settledAt, type: 'settlement', impact: -s.amount });
    });
    return breakdown.sort((a, b) => new Date(b.date) - new Date(a.date));
  };

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => navigate('/dashboard')} className="text-gray-500 hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h1 className="text-white font-bold text-xl">{group.name}</h1>
              <p className="text-gray-500 text-xs">{activeMembers.length} members · {expenses.length} expenses</p>
            </div>
            <div className="flex gap-2">
              {isAdmin && (
                <button
                  onClick={() => setShowManageMembers(true)}
                  className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-xl text-gray-300 text-sm transition-colors"
                >
                  <Users className="w-4 h-4" />
                  <span className="hidden sm:inline">Members</span>
                </button>
              )}
              {isAdmin && (
                <button
                  onClick={handleDeleteGroup}
                  className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-red-900/40 border border-gray-700 hover:border-red-700/50 rounded-xl text-gray-500 hover:text-red-400 text-sm transition-colors"
                  title="Delete group"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => navigate(`/groups/${groupId}/import`)}
                className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-xl text-gray-300 text-sm transition-colors"
              >
                <Upload className="w-4 h-4" />
                <span className="hidden sm:inline">Import CSV</span>
              </button>
              <button
                onClick={() => setShowSettle(true)}
                className="flex items-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-white text-sm transition-colors"
              >
                <CheckCircle className="w-4 h-4" />
                <span className="hidden sm:inline">Settle</span>
              </button>
              <button
                onClick={() => setShowAddExpense(true)}
                className="flex items-center gap-2 px-3 py-2 bg-violet-600 hover:bg-violet-500 rounded-xl text-white text-sm transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Add</span>
              </button>
            </div>
          </div>

          {/* My balance strip */}
          {myBalance && (
            <div className={`flex items-center gap-3 p-3 rounded-xl mb-4 ${
              Math.abs(myBalance.netBalance) < 0.01
                ? 'bg-emerald-900/20 border border-emerald-700/30'
                : myBalance.netBalance > 0
                ? 'bg-blue-900/20 border border-blue-700/30'
                : 'bg-red-900/20 border border-red-700/30'
            }`}>
              {Math.abs(myBalance.netBalance) < 0.01 ? (
                <CheckCircle className="w-4 h-4 text-emerald-400" />
              ) : myBalance.netBalance > 0 ? (
                <TrendingUp className="w-4 h-4 text-blue-400" />
              ) : (
                <TrendingDown className="w-4 h-4 text-red-400" />
              )}
              <span className="text-sm text-gray-300">
                {Math.abs(myBalance.netBalance) < 0.01
                  ? 'You are all settled up in this group!'
                  : myBalance.netBalance > 0
                  ? `You are owed ₹${myBalance.netBalance.toFixed(2)} in this group`
                  : `You owe ₹${Math.abs(myBalance.netBalance).toFixed(2)} in this group`}
              </span>
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-1 bg-gray-800/60 p-1 rounded-xl w-fit">
            {[
              { key: 'expenses', label: 'Expenses', icon: Receipt },
              { key: 'balances', label: 'Balances', icon: Wallet },
              { key: 'analytics', label: 'Analytics', icon: BarChart3 },
              { key: 'records', label: 'All Records', icon: SplitSquareHorizontal },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  tab === key ? 'bg-violet-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6">
        {/* ── TAB: EXPENSES ── */}
        {tab === 'expenses' && (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  value={filterSearch}
                  onChange={e => setFilterSearch(e.target.value)}
                  placeholder="Search expenses..."
                  className="w-full bg-gray-900 border border-gray-800 rounded-xl pl-9 pr-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 text-sm"
                />
              </div>
              <span className="text-gray-500 text-sm">{filteredExpenses.length} expense{filteredExpenses.length !== 1 ? 's' : ''}</span>
            </div>

            {filteredExpenses.length === 0 ? (
              <div className="text-center py-16">
                <Receipt className="w-12 h-12 text-gray-700 mx-auto mb-3" />
                <p className="text-gray-400 font-medium">No expenses yet</p>
                <p className="text-gray-600 text-sm mb-4">Add your first expense or import from CSV</p>
                <div className="flex gap-3 justify-center">
                  <button onClick={() => setShowAddExpense(true)} className="bg-violet-600 hover:bg-violet-500 text-white px-4 py-2 rounded-xl text-sm">
                    Add Expense
                  </button>
                  <button onClick={() => navigate(`/groups/${groupId}/import`)} className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-4 py-2 rounded-xl text-sm">
                    Import CSV
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredExpenses.map(expense => {
                  const paidByName = getUserName(expense.paidById);
                  const mySplit = expense.splits?.find(s => s.userId === user.id);
                  return (
                    <div key={expense.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-4 hover:border-gray-700 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                            expense.isRefund ? 'bg-amber-500/20 border border-amber-500/30' : 'bg-violet-500/20 border border-violet-500/30'
                          }`}>
                            {expense.isRefund ? (
                              <ArrowRight className="w-4 h-4 text-amber-400 rotate-180" />
                            ) : (
                              <Receipt className="w-4 h-4 text-violet-400" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-white font-medium text-sm">{expense.description}</p>
                              {expense.isRefund && (
                                <span className="text-xs px-1.5 py-0.5 rounded bg-amber-900/40 text-amber-300">refund</span>
                              )}
                              <span className="text-xs px-1.5 py-0.5 rounded bg-gray-800 text-gray-500 capitalize">{expense.splitType}</span>
                              {expense.currency === 'USD' && (
                                <span className="text-xs px-1.5 py-0.5 rounded bg-blue-900/40 text-blue-300">USD</span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                              <span>Paid by <span className="text-gray-300">{paidByName}</span></span>
                              <span>·</span>
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {format(parseISO(expense.expenseDate || new Date().toISOString()), 'MMM d, yyyy')}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-white font-bold">₹{Math.abs(expense.amountInr).toFixed(2)}</p>
                          {mySplit && (
                            <p className={`text-xs ${
                              expense.paidById === user.id ? 'text-emerald-400' : 'text-red-400'
                            }`}>
                              {expense.paidById === user.id ? 'you paid' : `you owe ₹${Math.abs(mySplit.amountOwed).toFixed(2)}`}
                            </p>
                          )}
                          <button
                            onClick={() => handleDeleteExpense(expense)}
                            className="text-gray-700 hover:text-red-400 transition-colors mt-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Split details */}
                      {expense.splits?.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-800 flex flex-wrap gap-2">
                          {expense.splits.map(split => {
                            const sName = getUserName(split.userId);
                            return (
                              <span key={split.userId} className="flex items-center gap-1.5 bg-gray-800/60 px-2 py-1 rounded-lg text-xs text-gray-400">
                                <span className="w-4 h-4 rounded-full bg-violet-500/30 flex items-center justify-center text-violet-300 text-[10px] font-bold">{sName[0] || '?'}</span>
                                {sName}: ₹{Math.abs(split.amountOwed).toFixed(2)}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── TAB: BALANCES ── */}
        {tab === 'balances' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-white font-semibold mb-3">Individual Balance Summary</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {balances.map(bal => (
                  <div
                    key={bal.userId}
                    onClick={() => setSelectedUserBreakdown(selectedUserBreakdown === bal.userId ? null : bal.userId)}
                    className={`bg-gray-900 border rounded-2xl p-4 cursor-pointer transition-all ${
                      selectedUserBreakdown === bal.userId ? 'border-violet-500/50' : 'border-gray-800 hover:border-gray-700'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold">
                        {bal.userName[0]}
                      </div>
                      <div>
                        <p className="text-white font-medium text-sm">{bal.userName}</p>
                        <p className="text-gray-500 text-xs">
                          {Math.abs(bal.netBalance) < 0.01 ? 'Settled' : bal.netBalance > 0 ? 'Is owed' : 'Owes'}
                        </p>
                      </div>
                    </div>
                    <div className={`text-xl font-bold ${
                      Math.abs(bal.netBalance) < 0.01 ? 'text-gray-400' :
                      bal.netBalance > 0 ? 'text-emerald-400' : 'text-red-400'
                    }`}>
                      {Math.abs(bal.netBalance) < 0.01 ? '₹0' :
                       bal.netBalance > 0 ? `+₹${bal.netBalance.toFixed(2)}` : `-₹${Math.abs(bal.netBalance).toFixed(2)}`}
                    </div>
                    <div className="flex gap-3 mt-2">
                      <div>
                        <p className="text-gray-600 text-xs">Paid</p>
                        <p className="text-gray-300 text-xs font-medium">₹{(bal.totalPaid || 0).toFixed(0)}</p>
                      </div>
                      <div>
                        <p className="text-gray-600 text-xs">Share</p>
                        <p className="text-gray-300 text-xs font-medium">₹{(bal.totalOwed || 0).toFixed(0)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {selectedUserBreakdown && (
              <div className="bg-gray-900 border border-violet-500/30 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-white font-semibold">
                    Expense Breakdown — {getUserName(selectedUserBreakdown)}
                  </h3>
                  <button onClick={() => setSelectedUserBreakdown(null)} className="text-gray-500 hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {getUserExpenseBreakdownLocal(selectedUserBreakdown, expenses, settlements).map((item, i) => (
                    <div key={i} className="flex items-center gap-3 p-2.5 bg-gray-800/50 rounded-xl">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        item.impact > 0 ? 'bg-emerald-400' : 'bg-red-400'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-gray-300 text-sm truncate">{item.description}</p>
                        <p className="text-gray-600 text-xs">{format(parseISO(item.date), 'MMM d')} · {item.type.replace('_', ' ')}</p>
                      </div>
                      <span className={`text-sm font-medium flex-shrink-0 ${item.impact > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {item.impact > 0 ? '+' : ''}₹{Math.abs(item.impact).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                <ArrowRight className="w-4 h-4 text-violet-400" />
                Who Pays Whom
              </h3>
              {debts.length === 0 ? (
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center">
                  <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
                  <p className="text-white font-medium">All settled up!</p>
                  <p className="text-gray-500 text-sm">No pending debts in this group</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {debts.map((debt, i) => (
                    <div key={i} className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-300 text-xs font-bold">
                          {debt.fromUserName[0]}
                        </div>
                        <span className="text-white text-sm font-medium">{debt.fromUserName}</span>
                      </div>
                      <div className="flex-1 flex items-center gap-2">
                        <div className="flex-1 h-px bg-gray-800" />
                        <div className="bg-amber-900/30 border border-amber-700/30 px-3 py-1 rounded-full text-center">
                          <p className="text-amber-300 font-bold text-sm">₹{debt.amount.toFixed(2)}</p>
                        </div>
                        <div className="flex-1 h-px bg-gray-800" />
                        <ArrowRight className="w-4 h-4 text-gray-600" />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-white text-sm font-medium">{debt.toUserName}</span>
                        <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-300 text-xs font-bold">
                          {debt.toUserName[0]}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {settlements.length > 0 && (
              <div>
                <h3 className="text-white font-semibold mb-3">Settlement History</h3>
                <div className="space-y-2">
                  {settlements.map(s => (
                    <div key={s.id} className="bg-gray-900 border border-gray-800 rounded-xl p-3 flex items-center gap-3">
                      <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-gray-300 text-sm">
                          <span className="text-white font-medium">{getUserName(s.fromUserId)}</span>
                          {' → '}
                          <span className="text-white font-medium">{getUserName(s.toUserId)}</span>
                        </p>
                        <p className="text-gray-500 text-xs">{format(parseISO(s.settledAt), 'MMM d, yyyy')} {s.notes && `· ${s.notes}`}</p>
                      </div>
                      <span className="text-emerald-400 font-bold text-sm">₹{s.amount.toFixed(2)}</span>
                      <button onClick={() => handleDeleteSettlement(s)} className="text-gray-700 hover:text-red-400 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TAB: ANALYTICS ── */}
        {tab === 'analytics' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Total Spent', value: `₹${expenses.reduce((s, e) => s + e.amountInr, 0).toFixed(0)}` },
                { label: 'Avg Expense', value: `₹${expenses.length ? (expenses.reduce((s, e) => s + e.amountInr, 0) / expenses.length).toFixed(0) : 0}` },
                { label: 'Settlements', value: settlements.length },
                { label: 'Active Members', value: activeMembers.length },
              ].map(kpi => (
                <div key={kpi.label} className="bg-gray-900 border border-gray-800 rounded-2xl p-4 text-center">
                  <p className="text-gray-400 text-xs mb-1">{kpi.label}</p>
                  <p className="text-white font-bold text-xl">{kpi.value}</p>
                </div>
              ))}
            </div>

            {monthlyChart.length > 0 && (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <h3 className="text-white font-semibold mb-4">Monthly Spending</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={monthlyChart}>
                    <XAxis dataKey="month" tick={{ fill: '#6b7280', fontSize: 12 }} />
                    <YAxis tick={{ fill: '#6b7280', fontSize: 12 }} />
                    <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#fff' }} />
                    <Bar dataKey="amount" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {payerChart.length > 0 && (
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                  <h3 className="text-white font-semibold mb-4">Who Paid Most</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={payerChart} dataKey="amount" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                        {payerChart.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#fff' }} formatter={(v) => [`₹${v}`, 'Amount']} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}

              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <h3 className="text-white font-semibold mb-4">Group-wise Balances</h3>
                <div className="space-y-3">
                  {balances.map(bal => {
                    const maxAbs = Math.max(...balances.map(b => Math.abs(b.netBalance)), 1);
                    const pct = maxAbs > 0 ? (Math.abs(bal.netBalance) / maxAbs * 100) : 0;
                    return (
                      <div key={bal.userId}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-gray-300">{bal.userName}</span>
                          <span className={bal.netBalance >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                            {bal.netBalance >= 0 ? '+' : ''}₹{bal.netBalance.toFixed(2)}
                          </span>
                        </div>
                        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${bal.netBalance >= 0 ? 'bg-emerald-500' : 'bg-red-500'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB: ALL RECORDS ── */}
        {tab === 'records' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  value={filterSearch}
                  onChange={e => setFilterSearch(e.target.value)}
                  placeholder="Filter records..."
                  className="w-full bg-gray-900 border border-gray-800 rounded-xl pl-9 pr-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 text-sm"
                />
              </div>
            </div>

            {/* Expenses */}
            <div>
              <h3 className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-2">Expenses ({filteredExpenses.length})</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800">
                      <th className="text-left py-3 px-4 text-gray-500 font-medium">Date</th>
                      <th className="text-left py-3 px-4 text-gray-500 font-medium">Description</th>
                      <th className="text-left py-3 px-4 text-gray-500 font-medium">Paid By</th>
                      <th className="text-left py-3 px-4 text-gray-500 font-medium">Split</th>
                      <th className="text-right py-3 px-4 text-gray-500 font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredExpenses.map(e => (
                      <tr key={e.id} className="border-b border-gray-800/50 hover:bg-gray-900/30">
                        <td className="py-3 px-4 text-gray-400 whitespace-nowrap">{format(parseISO(e.expenseDate), 'MMM d, yyyy')}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className="text-white">{e.description}</span>
                            {e.isRefund && <span className="text-xs px-1 py-0.5 rounded bg-amber-900/40 text-amber-300">refund</span>}
                            {e.currency !== 'INR' && <span className="text-xs px-1 py-0.5 rounded bg-blue-900/40 text-blue-300">{e.currency}</span>}
                          </div>
                          {e.notes && <p className="text-gray-600 text-xs">{e.notes}</p>}
                        </td>
                        <td className="py-3 px-4 text-gray-300">{getUserName(e.paidById)}</td>
                        <td className="py-3 px-4">
                          <span className="text-xs px-1.5 py-0.5 rounded-full bg-gray-800 text-gray-400 capitalize">{e.splitType}</span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className={`font-medium ${e.isRefund ? 'text-amber-400' : 'text-white'}`}>
                            {e.isRefund ? '-' : ''}₹{Math.abs(e.amountInr).toFixed(2)}
                          </span>
                          {e.currency === 'USD' && <p className="text-gray-600 text-xs">${Math.abs(e.amount).toFixed(2)}</p>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Settlements */}
            {settlements.length > 0 && (
              <div>
                <h3 className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-2">Settlements ({settlements.length})</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-800">
                        <th className="text-left py-3 px-4 text-gray-500 font-medium">Date</th>
                        <th className="text-left py-3 px-4 text-gray-500 font-medium">From</th>
                        <th className="text-left py-3 px-4 text-gray-500 font-medium">To</th>
                        <th className="text-left py-3 px-4 text-gray-500 font-medium">Notes</th>
                        <th className="text-right py-3 px-4 text-gray-500 font-medium">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {settlements.map(s => (
                        <tr key={s.id} className="border-b border-gray-800/50 hover:bg-gray-900/30">
                          <td className="py-3 px-4 text-gray-400 whitespace-nowrap">{format(parseISO(s.settledAt), 'MMM d, yyyy')}</td>
                          <td className="py-3 px-4 text-white">{getUserName(s.fromUserId)}</td>
                          <td className="py-3 px-4 text-white">{getUserName(s.toUserId)}</td>
                          <td className="py-3 px-4 text-gray-400 text-xs">{s.notes || '-'}</td>
                          <td className="py-3 px-4 text-right text-emerald-400 font-medium">₹{s.amount.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      {showAddExpense && (
        <AddExpenseModal
          groupId={groupId}
          members={activeMembers}
          currentUser={user}
          onClose={() => setShowAddExpense(false)}
          onAdded={() => loadData(true)}
        />
      )}
      {showSettle && (
        <SettleModal
          groupId={groupId}
          members={activeMembers}
          currentUser={user}
          debts={debts}
          onClose={() => setShowSettle(false)}
          onSettled={() => loadData(true)}
        />
      )}
      {showManageMembers && (
        <ManageMembersModal
          group={group}
          memberships={memberships}
          onClose={() => setShowManageMembers(false)}
          onUpdated={() => loadData(true)}
        />
      )}
      {confirmDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold">Confirm Delete</h3>
                <p className="text-gray-400 text-xs">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-gray-300 text-sm mb-5">
              {confirmDelete.type === 'group'
                ? <>Delete group <span className="text-white font-semibold">"{confirmDelete.label}"</span>? All expenses, settlements and data will be permanently removed.</>
                : <>Delete <span className="text-white font-semibold">"{confirmDelete.label}"</span>?</>
              }
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-700 text-gray-400 hover:text-white text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={executeDelete}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-medium transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
