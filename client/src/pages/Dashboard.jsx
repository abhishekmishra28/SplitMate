import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import API from '../services/api';
import CreateGroupModal from '../components/CreateGroupModal';
import toast from 'react-hot-toast';
import {
  Plus, Users, TrendingUp, TrendingDown,
  ArrowRight, Wallet, ChevronRight, Receipt, CreditCard,
  AlertTriangle, CheckCircle, Trash2
} from 'lucide-react';
import { format } from 'date-fns';

function KPICard({ title, value, subtitle, icon: Icon, color, trend }) {
  return (
    <div className={`bg-gray-900 border border-gray-800 rounded-2xl p-5 relative overflow-hidden`}>
      <div className={`absolute top-0 right-0 w-20 h-20 rounded-bl-3xl ${color} opacity-10`} />
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center bg-opacity-20`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        {trend !== undefined && (
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            trend > 0 ? 'text-emerald-400 bg-emerald-900/30' :
            trend < 0 ? 'text-red-400 bg-red-900/30' :
            'text-gray-400 bg-gray-800'
          }`}>
            {trend > 0 ? '↑' : trend < 0 ? '↓' : '→'} {Math.abs(trend).toFixed(0)}%
          </span>
        )}
      </div>
      <p className="text-gray-400 text-sm mb-1">{title}</p>
      <p className="text-white text-2xl font-bold">{value}</p>
      {subtitle && <p className="text-gray-500 text-xs mt-1">{subtitle}</p>}
    </div>
  );
}

function GroupCard({ group, userId, onClick, onDelete, isAdmin }) {
  const activeMembersCount = group.memberCount || 0;
  const myBalance = group.balance || 0;
  
  return (
    <div
      onClick={onClick}
      className="bg-gray-900 border border-gray-800 rounded-2xl p-5 cursor-pointer hover:border-violet-500/50 hover:bg-gray-800/50 transition-all group"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 border border-violet-500/20 flex items-center justify-center">
            <Users className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <h3 className="text-white font-semibold">{group.name}</h3>
            <p className="text-gray-500 text-xs">{activeMembersCount} active member{activeMembersCount !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {isAdmin && (
            <button
              onClick={e => { e.stopPropagation(); onDelete(group); }}
              className="p-1 text-gray-700 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-violet-400 transition-colors" />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-500 text-xs mb-1">Your balance</p>
          <div className="flex items-center gap-1.5">
            {Math.abs(myBalance) < 0.01 ? (
              <span className="text-gray-400 font-semibold text-sm flex items-center gap-1">
                <CheckCircle className="w-4 h-4 text-emerald-400" /> Settled up
              </span>
            ) : myBalance > 0 ? (
              <>
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <span className="text-emerald-400 font-bold">+₹{myBalance.toFixed(0)}</span>
              </>
            ) : (
              <>
                <TrendingDown className="w-4 h-4 text-red-400" />
                <span className="text-red-400 font-bold">-₹{Math.abs(myBalance).toFixed(0)}</span>
              </>
            )}
          </div>
        </div>
        <div className="text-right">
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  
  const [groups, setGroups] = useState([]);
  const [pendingDebts, setPendingDebts] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [kpis, setKpis] = useState({
    totalOwed: 0,
    totalOwe: 0,
    totalGroups: 0,
    totalExpenses: 0,
  });

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [summaryRes, pendingRes, activityRes] = await Promise.all([
        API.get('/dashboard/summary'),
        API.get('/dashboard/pending-settlements'),
        API.get('/dashboard/activity')
      ]);

      if (summaryRes.data.success) {
        setGroups(summaryRes.data.groups);
        setKpis({
          totalOwed: summaryRes.data.summary.youAreOwed,
          totalOwe: summaryRes.data.summary.youOwe,
          totalGroups: summaryRes.data.groups.length,
          totalExpenses: summaryRes.data.summary.totalExpenses
        });
      }

      if (pendingRes.data.success) {
        setPendingDebts(pendingRes.data.pending.slice(0, 5));
      }

      if (activityRes.data.success) {
        setRecentActivity(activityRes.data.activity.slice(0, 5));
      }

    } catch (error) {
      console.error("Failed to load dashboard data", error);
      if (!silent) toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const handleGroupCreated = (group) => {
    setShowCreateGroup(false);
    loadData(true);
    navigate(`/groups/${group.id}`);
  };

  const handleDeleteGroup = async (group) => {
    if (!window.confirm(`Delete group "${group.name}"? This will permanently remove all expenses, settlements and data.`)) return;
    try {
      await API.delete(`/groups/${group.id}`);
      toast.success('Group deleted');
      loadData(true);
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Failed to delete group');
    }
  };

  const netBalance = kpis.totalOwed - kpis.totalOwe;

  if (loading) {
    return <div className="p-6 text-center text-gray-500">Loading dashboard...</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'},{' '}
            <span className="text-violet-400">{user?.name}</span> 👋
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">Here's your expense overview</p>
        </div>
        <button
          onClick={() => setShowCreateGroup(true)}
          className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors shadow-lg shadow-violet-900/40"
        >
          <Plus className="w-4 h-4" />
          New Group
        </button>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KPICard
          title="You are owed"
          value={`₹${kpis.totalOwed.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
          subtitle={`Across ${kpis.totalGroups} group${kpis.totalGroups !== 1 ? 's' : ''}`}
          icon={TrendingUp}
          color="bg-emerald-500"
        />
        <KPICard
          title="You owe"
          value={`₹${kpis.totalOwe.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
          subtitle="Total outstanding"
          icon={TrendingDown}
          color="bg-red-500"
        />
        <KPICard
          title="Net balance"
          value={`${netBalance >= 0 ? '+' : ''}₹${Math.abs(netBalance).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
          subtitle={netBalance >= 0 ? "In your favor" : "You owe more"}
          icon={netBalance >= 0 ? Wallet : CreditCard}
          color={netBalance >= 0 ? "bg-violet-500" : "bg-amber-500"}
        />
        <KPICard
          title="Total expenses"
          value={kpis.totalExpenses.toString()}
          subtitle={`Across ${kpis.totalGroups} group${kpis.totalGroups !== 1 ? 's' : ''}`}
          icon={Receipt}
          color="bg-blue-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Groups Section */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-semibold text-lg">My Groups</h2>
            <button
              onClick={() => setShowCreateGroup(true)}
              className="text-violet-400 hover:text-violet-300 text-sm flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              Create
            </button>
          </div>

          {groups.length === 0 ? (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
              <div className="text-center py-6">
                <div className="w-14 h-14 rounded-2xl bg-violet-500/20 border border-violet-500/20 flex items-center justify-center mx-auto mb-4">
                  <Users className="w-7 h-7 text-violet-400" />
                </div>
                <p className="text-white font-semibold mb-1">Create your first group</p>
                <p className="text-gray-500 text-sm mb-5">Groups let you track shared expenses between people</p>
                <button
                  onClick={() => setShowCreateGroup(true)}
                  className="bg-violet-600 hover:bg-violet-500 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors inline-flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Create First Group
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {groups.map(group => (
                <GroupCard
                  key={group.id}
                  group={group}
                  userId={user.id}
                  onClick={() => navigate(`/groups/${group.id}`)}
                  onDelete={handleDeleteGroup}
                  isAdmin={group.createdById === user.id}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right Sidebar */}
        <div className="space-y-4">
          {/* Pending debts */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              Pending Settlements
            </h3>
            {pendingDebts.length === 0 ? (
              <div className="text-center py-3">
                <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <p className="text-gray-400 text-sm">All settled up!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {pendingDebts.map((debt, idx) => (
                  <div
                    key={idx}
                    onClick={() => navigate(`/groups/${debt.groupId}`)}
                    className="flex items-center gap-2 p-3 bg-gray-800/50 rounded-xl cursor-pointer hover:bg-gray-800 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className={`font-medium ${debt.fromUserId === user.id ? 'text-red-400' : 'text-emerald-400'}`}>
                          {debt.fromUserId === user.id ? 'You' : debt.fromUserName}
                        </span>
                        <ArrowRight className="w-3 h-3 text-gray-600" />
                        <span className="text-gray-300">{debt.toUserId === user.id ? 'You' : debt.toUserName}</span>
                      </div>
                      <p className="text-gray-600 text-xs mt-0.5 truncate">{debt.groupName}</p>
                    </div>
                    <span className={`text-sm font-bold flex-shrink-0 ${debt.fromUserId === user.id ? 'text-red-400' : 'text-emerald-400'}`}>
                      ₹{debt.amount.toFixed(0)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Activity */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <h3 className="text-white font-semibold mb-4">Recent Activity</h3>
            {recentActivity.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-3">No recent activity</p>
            ) : (
              <div className="space-y-2">
                {recentActivity.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => navigate(`/groups/${item.groupId}`)}
                    className="flex items-center gap-3 p-2 hover:bg-gray-800/50 rounded-xl cursor-pointer transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
                      <Receipt className="w-4 h-4 text-violet-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-300 text-xs font-medium truncate">{item.description}</p>
                      <p className="text-gray-600 text-xs">{item.group?.name} · {format(new Date(item.expenseDate), 'MMM d')}</p>
                    </div>
                    <span className="text-gray-400 text-xs font-medium flex-shrink-0">₹{item.amountInr.toFixed(0)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {showCreateGroup && (
        <CreateGroupModal
          onClose={() => setShowCreateGroup(false)}
          onCreated={handleGroupCreated}
        />
      )}
    </div>
  );
}
