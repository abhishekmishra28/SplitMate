// ============================================================
// CORE DATA TYPES
// ============================================================

export interface User {
  id: string;
  name: string;
  email: string;
  password: string; // hashed (simple for demo)
  createdAt: string;
  isDemo?: boolean;
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  createdBy: string; // user id
  createdAt: string;
  currency: string; // default INR
}

export interface Membership {
  id: string;
  groupId: string;
  userId: string;
  joinedAt: string; // ISO date string
  leftAt?: string | null; // null = active
  isGuest?: boolean;
  guestName?: string; // for non-registered participants
}

export type SplitType = 'equal' | 'exact' | 'percentage' | 'share' | 'custom';

export interface ExpenseSplit {
  userId: string;
  amountOwed: number; // in INR
  percentage?: number;
  share?: number;
}

export interface Expense {
  id: string;
  groupId: string;
  description: string;
  paidBy: string; // user id
  amount: number; // original amount
  currency: string; // INR or USD
  amountInr: number; // always INR for calculations
  exchangeRate: number; // 1.0 for INR
  splitType: SplitType;
  splits: ExpenseSplit[];
  expenseDate: string; // ISO date string
  notes?: string;
  isRefund?: boolean;
  isSettlement?: boolean;
  importedFrom?: string; // import_log id
  createdAt: string;
  createdBy: string;
}

export interface Settlement {
  id: string;
  groupId: string;
  fromUserId: string; // who paid
  toUserId: string; // who received
  amount: number; // always positive INR
  settledAt: string;
  notes?: string;
  createdAt: string;
}

export interface Balance {
  userId: string;
  userName: string;
  netBalance: number; // positive = owed money, negative = owes money
  totalPaid: number;
  totalOwed: number;
}

export interface DebtTransaction {
  from: string; // userId who pays
  fromName: string;
  to: string; // userId who receives
  toName: string;
  amount: number;
}

// ============================================================
// IMPORT TYPES
// ============================================================

export type AnomalySeverity = 'info' | 'warn' | 'error' | 'approval';
export type AnomalyAction = 'auto_fixed' | 'blocked' | 'needs_approval' | 'skipped';

export interface Anomaly {
  id: string;
  type: string;
  severity: AnomalySeverity;
  rowNumber: number;
  message: string;
  originalValue: string;
  suggestedValue?: string;
  action: AnomalyAction;
  approved?: boolean;
  field?: string;
}

export interface ParsedRow {
  rowNumber: number;
  date: string;
  description: string;
  paidBy: string;
  amount: string;
  currency: string;
  splitType: string;
  splitWith: string;
  splitDetails: string;
  category?: string;
  notes?: string;
  raw: Record<string, string>;
}

export interface ProcessedRow {
  rowNumber: number;
  original: ParsedRow;
  expense?: Partial<Expense>;
  settlement?: Partial<Settlement>;
  anomalies: Anomaly[];
  status: 'ok' | 'warn' | 'error' | 'approval' | 'skip';
  skipReason?: string;
}

export interface ImportReport {
  id: string;
  groupId: string;
  importedBy: string;
  filename: string;
  status: 'pending' | 'reviewing' | 'completed' | 'failed';
  totalRows: number;
  importedRows: number;
  skippedRows: number;
  anomalies: Anomaly[];
  processedRows: ProcessedRow[];
  createdAt: string;
  completedAt?: string;
}

// ============================================================
// AUTH TYPES
// ============================================================

export interface AuthState {
  user: User | null;
  token: string | null;
}

// ============================================================
// ANALYTICS TYPES
// ============================================================

export interface PersonalAnalytics {
  totalSpent: number;
  totalPaid: number;
  totalOwed: number;
  netBalance: number;
  groupBreakdown: {
    groupId: string;
    groupName: string;
    netBalance: number;
    totalSpent: number;
  }[];
  monthlySpending: {
    month: string;
    amount: number;
  }[];
  categoryBreakdown: {
    category: string;
    amount: number;
  }[];
  topExpenses: Expense[];
}
