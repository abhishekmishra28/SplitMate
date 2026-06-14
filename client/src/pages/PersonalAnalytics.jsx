import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import API from '../services/api';

import { format, parseISO, startOfMonth, endOfMonth } from 'date-fns';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend, AreaChart, Area
} from 'recharts';
import {
  TrendingUp, TrendingDown, Wallet, Receipt, Users, ArrowRight,
  Calendar, CreditCard, BarChart3, DollarSign, CheckCircle, AlertTriangle
} from 'lucide-react';

const COLORS = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#6366f1', '#14b8a6'];

function StatCard({ title, value, subtitle, icon: Icon, color = 'violet', trend }) {
  const colors = {
    violet: 'from-violet-500/20 to-purple-500/20 border-violet-500/20 text-violet-400',
    emerald: 'from-emerald-500/20 to-teal-500/20 border-emerald-500/20 text-emerald-400',
    red: 'from-red-500/20 to-pink-500/20 border-red-500/20 text-red-400',
    blue: 'from-blue-500/20 to-cyan-500/20 border-blue-500/20 text-blue-400',
    amber: 'from-amber-500/20 to-orange-500/20 border-amber-500/20 text-amber-400',
  };
  const c = colors[color];
  return (
    <div className={`bg-gradient-to-br ${c} border rounded-2xl p-5`}>
      <div className="flex items-start justify-between mb-3">
        <Icon className={`w-5 h-5 ${c.split(' ').find(x => x.startsWith('text-'))}`} />
        {trend !== undefined && (
          <span className={`text-xs font-medium ${trend >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend).toFixed(0)}%
          </span>
        )}
      </div>
      <p className="text-gray-400 text-sm mb-1">{title}</p>
      <p className="text-white text-2xl font-bold">{value}</p>
      {subtitle && <p className="text-gray-500 text-xs mt-1">{subtitle}</p>}
    </div>
  );
}

export default function PersonalAnalytics() {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState(null);
  const [timeRange, setTimeRange] = useState('all'); // all | 3m | 6m | 1y
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const groupsRes = await API.get('/groups');
        const groups = groupsRes.data.groups || [];

        const now = new Date();
        const cutoff = {
          all: null,
          '3m': new Date(now.getFullYear(), now.getMonth() - 3, 1),
          '6m': new Date(now.getFullYear(), now.getMonth() - 6, 1),
          '1y': new Date(now.getFullYear() - 1, now.getMonth(), 1),
        }[timeRange];

        let totalPaid = 0;
        let totalOwed = 0;
        let totalNetBalance = 0;
        const groupBreakdown = [];
        const monthlySpending = {};
        const categoryBreakdown = {};
        const topExpenses = [];
        let totalSettled = 0;
        const allDebts = [];

        // Fetch data for each group concurrently
        const groupDataPromises = groups.map(group =>
          Promise.all([
            API.get(`/groups/${group.id}`), // to get members
            API.get(`/expenses/group/${group.id}`),
            API.get(`/settlements/group/${group.id}`),
            API.get(`/groups/${group.id}/balances`),
            API.get(`/groups/${group.id}/debts`)
          ])
            .then(([gRes, eRes, sRes, bRes, dRes]) => ({
              group,
              memberships: gRes.data.group?.memberships || [],
              expenses: eRes.data.expenses || [],
              settlements: sRes.data.settlements || [],
              balances: bRes.data.balances || [],
              debts: dRes.data.debts || [],
            }))
            .catch(() => null)
        );

        const groupsData = (await Promise.all(groupDataPromises)).filter(Boolean);

        for (const data of groupsData) {
          const { group, memberships, expenses: allExp, settlements, balances, debts } = data;
          
          const activeMembers = memberships.filter(m => !m.leftAt);
          
          let expenses = allExp;
          if (cutoff) {
            expenses = expenses.filter(e => new Date(e.expenseDate) >= cutoff);
          }

          let groupTotalSpent = 0;
          let groupMyPaid = 0;

          for (const expense of expenses) {
            if (expense.isSettlement) continue; // safety check

            if (expense.paidById === user.id) {
              totalPaid += expense.amountInr;
              groupMyPaid += expense.amountInr;
            }

            const mySplit = expense.splits?.find(s => s.userId === user.id);
            if (mySplit) {
              totalOwed += Math.abs(mySplit.amountOwed);
            }

            groupTotalSpent += expense.amountInr;

            // Monthly
            const month = expense.expenseDate.substring(0, 7);
            if (!monthlySpending[month]) monthlySpending[month] = { paid: 0, owed: 0 };
            if (expense.paidById === user.id) monthlySpending[month].paid += expense.amountInr;
            if (mySplit) monthlySpending[month].owed += Math.abs(mySplit.amountOwed);

            // Category
            const desc = expense.description.toLowerCase();
            let category = 'Other';
            if (desc.includes('groceries') || desc.includes('supermarket') || desc.includes('bigbasket')) category = 'Groceries';
            else if (desc.includes('dinner') || desc.includes('lunch') || desc.includes('breakfast') || desc.includes('food') || desc.includes('restaurant') || desc.includes('zomato') || desc.includes('swiggy')) category = 'Food';
            else if (desc.includes('electricity') || desc.includes('rent') || desc.includes('bill') || desc.includes('wifi') || desc.includes('internet') || desc.includes('gas') || desc.includes('water')) category = 'Utilities';
            else if (desc.includes('uber') || desc.includes('ola') || desc.includes('cab') || desc.includes('metro') || desc.includes('transport') || desc.includes('petrol') || desc.includes('bus') || desc.includes('flight')) category = 'Transport';
            else if (desc.includes('movie') || desc.includes('netflix') || desc.includes('hotstar') || desc.includes('prime') || desc.includes('sport')) category = 'Entertainment';
            else if (desc.includes('trip') || desc.includes('hotel') || desc.includes('hostel') || desc.includes('travel')) category = 'Travel';
            else if (desc.includes('medicine') || desc.includes('pharmacy') || desc.includes('doctor') || desc.includes('medical')) category = 'Health';

            categoryBreakdown[category] = (categoryBreakdown[category] || 0) + (mySplit ? Math.abs(mySplit.amountOwed) : 0);

            if (expense.paidById === user.id || mySplit) {
              topExpenses.push({ ...expense, groupName: group.name });
            }
          }

          const myBal = balances.find(b => b.userId === user.id);
          const netBal = myBal?.netBalance || 0;
          totalNetBalance += netBal;

          groupBreakdown.push({
            groupId: group.id,
            groupName: group.name,
            netBalance: netBal,
            totalSpent: groupTotalSpent,
            myPaid: groupMyPaid,
            memberCount: activeMembers.length,
          });

          debts.forEach(d => {
            if (d.fromUserId === user.id || d.toUserId === user.id) {
              allDebts.push({ ...d, groupName: group.name });
            }
          });

          settlements
            .filter(s => s.fromUserId === user.id || s.toUserId === user.id)
            .forEach(s => { totalSettled += s.amount; });
        }

        const monthlyChart = Object.entries(monthlySpending)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([month, data]) => ({
            month: format(parseISO(month + '-01'), 'MMM yy'),
            paid: Math.round(data.paid),
            owed: Math.round(data.owed),
          }));

        const categoryChart = Object.entries(categoryBreakdown)
          .filter(([, v]) => v > 0)
          .sort(([, a], [, b]) => b - a)
          .map(([name, amount]) => ({ name, amount: Math.round(amount) }));

        topExpenses.sort((a, b) => b.amountInr - a.amountInr);

        setAnalytics({
          totalPaid: Math.round(totalPaid * 100) / 100,
          totalOwed: Math.round(totalOwed * 100) / 100,
          totalNetBalance: Math.round(totalNetBalance * 100) / 100,
          totalGroups: groups.length,
          monthlyChart,
          categoryChart,
          groupBreakdown,
          topExpenses: topExpenses.slice(0, 5),
          allDebts,
          totalSettled: Math.round(totalSettled * 100) / 100,
        });

      } catch (error) {
        console.error("Failed to load analytics", error);
      } finally {
        setLoading(false);
      }
    };

    if (user) fetchData();
  }, [user, timeRange]);

  if (loading || !analytics) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const avgMonthly = analytics.monthlyChart.length > 0
    ? analytics.monthlyChart.reduce((s, m) => s + m.owed, 0) / analytics.monthlyChart.length
    : 0;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-violet-400" />
            Personal Analytics
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">Your expense overview across all groups</p>
        </div>
        <div className="flex gap-1 bg-gray-800 p-1 rounded-xl">
          {[
            { key: 'all', label: 'All Time' },
            { key: '6m', label: '6M' },
            { key: '3m', label: '3M' },
          ].map(r => (
            <button
              key={r.key}
              onClick={() => setTimeRange(r.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                timeRange === r.key ? 'bg-violet-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          title="Total Paid"
          value={`₹${analytics.totalPaid.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
          subtitle="You advanced for others"
          icon={CreditCard}
          color="blue"
        />
        <StatCard
          title="My Share"
          value={`₹${analytics.totalOwed.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
          subtitle="Your portion of expenses"
          icon={Receipt}
          color="amber"
        />
        <StatCard
          title="Net Balance"
          value={`${analytics.totalNetBalance >= 0 ? '+' : ''}₹${Math.abs(analytics.totalNetBalance).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
          subtitle={analytics.totalNetBalance >= 0 ? 'Others owe you' : 'You owe others'}
          icon={analytics.totalNetBalance >= 0 ? TrendingUp : TrendingDown}
          color={analytics.totalNetBalance >= 0 ? 'emerald' : 'red'}
        />
        <StatCard
          title="Total Settled"
          value={`₹${analytics.totalSettled.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
          subtitle={`${analytics.totalGroups} groups`}
          icon={CheckCircle}
          color="violet"
        />
      </div>

      {/* Additional KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {[
          { label: 'Avg Monthly Spend', value: `₹${Math.round(avgMonthly).toLocaleString('en-IN')}`, icon: Calendar },
          { label: 'Active Groups', value: analytics.totalGroups, icon: Users },
          { label: 'Pending Debts', value: analytics.allDebts.length, icon: AlertTriangle },
          { label: 'Top Category', value: analytics.categoryChart[0]?.name || 'N/A', icon: BarChart3 },
        ].map(kpi => (
          <div key={kpi.label} className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
            <kpi.icon className="w-4 h-4 text-gray-500 mb-2" />
            <p className="text-gray-500 text-xs mb-1">{kpi.label}</p>
            <p className="text-white font-bold text-lg">{kpi.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Monthly spending trend */}
        {analytics.monthlyChart.length > 0 && (
          <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <h3 className="text-white font-semibold mb-4">Monthly Spending Trend</h3>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={analytics.monthlyChart}>
                <defs>
                  <linearGradient id="paidGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="owedGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="month" tick={{ fill: '#6b7280', fontSize: 11 }} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} />
                <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#fff' }} formatter={(v) => [`₹${v}`, '']} />
                <Legend />
                <Area type="monotone" dataKey="paid" name="Amount Paid" stroke="#8b5cf6" fill="url(#paidGrad)" strokeWidth={2} />
                <Area type="monotone" dataKey="owed" name="My Share" stroke="#06b6d4" fill="url(#owedGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Category breakdown */}
        {analytics.categoryChart.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <h3 className="text-white font-semibold mb-4">Spending by Category</h3>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={analytics.categoryChart}
                  dataKey="amount"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={65}
                  innerRadius={35}
                >
                  {analytics.categoryChart.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#fff' }} formatter={(v) => [`₹${v}`, '']} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-1.5 mt-3">
              {analytics.categoryChart.slice(0, 5).map((c, i) => (
                <div key={c.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                    <span className="text-gray-400 text-xs">{c.name}</span>
                  </div>
                  <span className="text-gray-300 text-xs font-medium">₹{c.amount.toLocaleString('en-IN')}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Group breakdown */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <h3 className="text-white font-semibold mb-4">Balance by Group</h3>
          {analytics.groupBreakdown.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-6">No groups yet</p>
          ) : (
            <div className="space-y-3">
              {analytics.groupBreakdown.map(g => (
                <div key={g.groupId} className="bg-gray-800/50 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-white text-sm font-medium">{g.groupName}</p>
                      <p className="text-gray-500 text-xs">{g.memberCount} members · ₹{g.totalSpent.toFixed(0)} total</p>
                    </div>
                    <span className={`text-sm font-bold ${
                      Math.abs(g.netBalance) < 0.01 ? 'text-gray-400' :
                      g.netBalance > 0 ? 'text-emerald-400' : 'text-red-400'
                    }`}>
                      {Math.abs(g.netBalance) < 0.01 ? '₹0' :
                       g.netBalance > 0 ? `+₹${g.netBalance.toFixed(0)}` : `-₹${Math.abs(g.netBalance).toFixed(0)}`}
                    </span>
                  </div>
                  <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${g.netBalance >= 0 ? 'bg-emerald-500' : 'bg-red-500'}`}
                      style={{
                        width: `${Math.min(100, (Math.abs(g.netBalance) / (Math.max(...analytics.groupBreakdown.map(x => Math.abs(x.netBalance)), 1))) * 100)}%`
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pending debts + top expenses */}
        <div className="space-y-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              Pending Settlements
            </h3>
            {analytics.allDebts.length === 0 ? (
              <div className="text-center py-3">
                <CheckCircle className="w-7 h-7 text-emerald-500 mx-auto mb-1" />
                <p className="text-gray-400 text-sm">All settled up!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {analytics.allDebts.slice(0, 5).map((debt, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm p-2 bg-gray-800/40 rounded-xl">
                    <span className={debt.fromUserId === user.id ? 'text-red-400' : 'text-emerald-400'}>
                      {debt.fromUserId === user.id ? 'You' : debt.fromUserName}
                    </span>
                    <ArrowRight className="w-3 h-3 text-gray-600" />
                    <span className="text-gray-300 flex-1">
                      {debt.toUserId === user.id ? 'You' : debt.toUserName}
                      <span className="text-gray-600 text-xs ml-1">({debt.groupName})</span>
                    </span>
                    <span className={`font-medium ${debt.fromUserId === user.id ? 'text-red-400' : 'text-emerald-400'}`}>
                      ₹{debt.amount.toFixed(0)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <h3 className="text-white font-semibold mb-3">Top Expenses</h3>
            {analytics.topExpenses.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-3">No expenses yet</p>
            ) : (
              <div className="space-y-2">
                {analytics.topExpenses.map((e, i) => (
                  <div key={e.id} className="flex items-center gap-3 p-2 hover:bg-gray-800/40 rounded-xl">
                    <div className="w-6 h-6 rounded-full bg-violet-500/20 flex items-center justify-center text-violet-400 text-xs font-bold">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-300 text-sm truncate">{e.description}</p>
                      <p className="text-gray-600 text-xs">{e.groupName} · {format(parseISO(e.expenseDate), 'MMM d')}</p>
                    </div>
                    <span className="text-white font-medium text-sm">₹{e.amountInr.toFixed(0)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
