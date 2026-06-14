# Project Scope

## The Core Problem
Four flatmates (Aisha, Rohan, Priya, Meera) tracked their shared expenses in a messy spreadsheet. As people moved in/out and outsiders joined for trips, the spreadsheet became unmanageable. They need a programmatic solution that enforces exact math and handles their historical messy CSV data.

## Requirements Addressed

### 1. Aisha's Requirement ("Who pays whom, done")
**Addressed in:** `client/src/components/BalanceList.jsx` and `server/src/services/balanceService.js` (`simplifyDebts`).
**Implementation:** We built a Greedy algorithm that takes all net balances and iteratively settles the highest debtor with the highest creditor. This reduces 10+ overlapping debts into the absolute minimum number of transactions (e.g., Rohan pays Aisha ₹200).

### 2. Rohan's Requirement ("No magic numbers")
**Addressed in:** `client/src/components/BalanceList.jsx` (Expandable Audit Panel) and `balanceService.js` (`getUserBalanceBreakdown`).
**Implementation:** Instead of just showing a net balance, the UI provides an audit trail broken into 4 buckets:
1. Expenses you owe for
2. Expenses you paid
3. Settlements you paid
4. Settlements received

### 3. Priya's Requirement ("Convert USD correctly")
**Addressed in:** `server/src/utils/currencyConverter.js` and `server/src/services/importValidationService.js`.
**Implementation:** The database schema explicitly separates `amount` (e.g., 50.00), `currency` (USD), `amountInr` (4175.00), and `exchangeRate` (83.5). The import pipeline automatically flags USD rows, converts them to INR (using the `.env` `UsdRate`), and stores the exchange rate used for future auditing.

### 4. Sam's Requirement ("I moved in mid-April")
**Addressed in:** `server/src/services/splitService.js`, `importAdvancedValidationService.js`, and `client/src/components/MemberList.jsx`.
**Implementation:** `Membership` requires a `joinedAt` and optional `leftAt` date. When computing splits or importing expenses, the engine compares the `expense.date` to the member's residency window. If they weren't living there, they are mathematically blocked from being added to the split (`MEMBER_NOT_IN_GROUP_TIMEFRAME`).

### 5. Meera's Requirement ("Clean duplicates, manual approval")
**Addressed in:** `client/src/pages/ImportCSV.jsx`, `server/src/services/importValidationService.js`, and `importController.js`.
**Implementation:** We built a staging pipeline (`ImportReport`). The CSV is parsed, run against our anomaly detectors, and returned to the frontend. Users review warnings, approve the report, and only then does the backend execute DB writes sequentially.

---

## CSV Import Architecture

The Import Engine is designed as a secure, three-phase asynchronous pipeline to handle potentially millions of broken data points without locking the database:

1. **Phase 1: Upload & Parse (`csvImportService.js`)**
   - Receives the raw CSV over a multipart stream.
   - Cleans invisible BOM characters and normalizes erratic headers (e.g., mapping `paid by` and `Paid_By` uniformly to `paidBy`).
2. **Phase 2: Anomaly Detection Engine (`importValidationService.js` & `importAdvancedValidationService.js`)**
   - The normalized rows are piped through 19 distinct validation rules (see Anomaly Log below).
   - Generates an `ImportReport` in the database storing the `processedRows` as JSON, locking the state pending user review.
3. **Phase 3: Execute & Commit (`importController.js`)**
   - The user reviews the GUI report and triggers `/approve` and `/execute`.
   - The execution loops over valid rows and issues sequential database writes (`prisma.expense.create`), applying any auto-corrections (like spellcheck adjustments) and converting USD rates live.

### The Anomaly Log (Detection Rules)

The detection engine flags problems into `error` (blocks import of that row), `approval` (requires manual review), or `warn` (auto-fixed). 

| Anomaly Code | Type | Trigger | How it is Handled |
| :--- | :--- | :--- | :--- |
| `MISSING_DATE` | `error` | `row.date` is empty | Row rejected. |
| `INVALID_DATE` | `error` | Date fails parsing (e.g. `13/13/2026`) | Tries `DD/MM/YYYY`, `MM/DD/YYYY`, and ISO formats. Rejects if all fail. |
| `MISSING_PAYER` | `error` | `paid_by` is empty | Row rejected. |
| `MISSING_DESCRIPTION` | `error` | `description` is empty | Row rejected. |
| `UNKNOWN_PAYER` | `error` | Payer doesn't match any DB member | Uses Levenshtein distance. Rejects if no match found within threshold. |
| `PAYER_NAME_TYPO` | `warn` | Typo in payer name (e.g. `Priya S`) | **Auto-fixed** to exact DB string (`priya`) using fuzzy matching. |
| `UNKNOWN_SPLIT_MEMBERS`| `error` | `split_with` contains unknown names | Rejects row if names can't be mapped to real users. |
| `SPLIT_MEMBER_TYPO` | `warn` | Typo in split participants | **Auto-fixed** to exact DB strings. |
| `MISSING_AMOUNT` | `error` | `amount` is empty | Row rejected. |
| `NEGATIVE_AMOUNT` | `error` | Amount is < 0 | Row rejected. |
| `ZERO_AMOUNT` | `warn` | Amount is exactly 0 | Ignored during import execution. |
| `COMMAS_IN_AMOUNT` | `warn` | Amount contains commas (e.g. `1,200`) | **Auto-fixed** by sanitizing string `replace(/,/g, "")` to valid Float. |
| `FOREIGN_CURRENCY_USD` | `approval` | Currency is `USD` | Notifies user of live conversion rate (`UsdRate` from `.env`) to INR. |
| `UNSUPPORTED_CURRENCY` | `error` | Currency is not INR/USD | Row rejected. |
| `POSSIBLE_SETTLEMENT` | `approval`| Description implies a settlement | Flags row if keywords like "deposit", "paid back", or "share" are found. |
| `INVALID_SPLIT_TYPE` | `error` | Missing/unknown split type | Falls back to `equal` or rejects if mathematically impossible. |
| `DUPLICATE_CSV_ROW` | `error` | Exact same row appears twice in CSV | Flags duplicate line numbers and drops the clone. |
| `DUPLICATE_DB_EXPENSE` | `approval`| Exact expense already exists in DB | Compares Description, Payer, Date, Amount against live DB. |
| `MEMBER_NOT_IN_GROUP_TIMEFRAME` | `error` | Expense date is outside member residency| Rejects if `expenseDate < joinedAt` or `expenseDate > leftAt`. |

---

## Database Schema (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum SplitType {
  equal
  exact
  percentage
  share
  custom
}

model User {
  id        String   @id @default(uuid())
  name      String
  email     String   @unique
  password  String
  createdAt DateTime @default(now())

  groupsCreated       Group[]      @relation("GroupCreator")
  memberships         Membership[]
  expensesPaid        Expense[]    @relation("ExpensePayer")
  expensesCreated     Expense[]    @relation("ExpenseCreator")
  settlementsSent     Settlement[] @relation("SettlementSender")
  settlementsReceived Settlement[] @relation("SettlementReceiver")
  activities          Activity[]
  importReports       ImportReport[]
}

model Group {
  id          String   @id @default(uuid())
  name        String
  description String?
  currency    String   @default("INR")
  createdById String
  createdAt   DateTime @default(now())

  creator     User         @relation("GroupCreator", fields: [createdById], references: [id])
  memberships Membership[]
  expenses    Expense[]
  settlements Settlement[]
  activities  Activity[]
  importReports ImportReport[]
}

model Membership {
  id        String    @id @default(uuid())
  groupId   String
  userId    String?
  joinedAt  DateTime  @default(now())
  leftAt    DateTime?
  isGuest   Boolean   @default(false)
  guestName String?

  group Group @relation(fields: [groupId], references: [id])
  user  User? @relation(fields: [userId], references: [id])

  @@unique([groupId, userId])
}

model Expense {
  id           String    @id @default(uuid())
  groupId      String
  description  String
  paidById     String
  amount       Float
  currency     String    @default("INR")
  amountInr    Float
  exchangeRate Float     @default(1)
  splitType    SplitType
  expenseDate  DateTime
  notes        String?
  isRefund     Boolean   @default(false)
  isSettlement Boolean   @default(false)
  createdById  String
  createdAt    DateTime  @default(now())

  group     Group          @relation(fields: [groupId], references: [id])
  paidBy    User           @relation("ExpensePayer", fields: [paidById], references: [id])
  createdBy User           @relation("ExpenseCreator", fields: [createdById], references: [id])
  splits    ExpenseSplit[]
}

model ExpenseSplit {
  id         String  @id @default(uuid())
  expenseId  String
  userId     String?
  guestName  String?
  amountOwed Float
  percentage Float?
  share      Float?

  expense Expense @relation(fields: [expenseId], references: [id], onDelete: Cascade)
}

model Settlement {
  id         String   @id @default(uuid())
  groupId    String
  fromUserId String
  toUserId   String
  amount     Float
  notes      String?
  settledAt  DateTime
  createdAt  DateTime @default(now())

  group    Group @relation(fields: [groupId], references: [id])
  fromUser User  @relation("SettlementSender", fields: [fromUserId], references: [id])
  toUser   User  @relation("SettlementReceiver", fields: [toUserId], references: [id])
}

model Activity {
  id          String   @id @default(uuid())
  groupId     String
  userId      String?
  type        String
  title       String
  description String?
  metadata    Json?
  createdAt   DateTime @default(now())

  group Group @relation(fields: [groupId], references: [id], onDelete: Cascade)
  user  User? @relation(fields: [userId], references: [id])

  @@index([groupId])
  @@index([createdAt])
}

model ImportReport {
  id           String    @id @default(uuid())
  groupId      String
  importedById String
  filename     String
  status       String
  totalRows    Int
  importedRows Int       @default(0)
  skippedRows  Int       @default(0)
  report       Json
  createdAt    DateTime  @default(now())
  completedAt  DateTime?

  group      Group @relation(fields: [groupId], references: [id])
  importedBy User  @relation(fields: [importedById], references: [id])

  @@index([groupId])
}
```
