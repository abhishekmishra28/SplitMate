# Decision Log

This log captures the significant architectural and design decisions made throughout the development of the application, particularly those handling real-world constraints, performance, and messy data.

---

## 1. User Membership Model (Guests vs Registered Users)

**Context:** The assignment dataset contained both registered users and non-platform participants. Real expense groups often include people who have not yet created an account.

**Options Considered:**

1. Force every participant to register before being added to a group.
2. Maintain a separate Guest table.
3. Allow Membership to reference either a User or a guest name.

**Decision:** We chose **Option 3**.

**Why:** Real-world expense splitting should not require every participant to create an account. By allowing `Membership.userId` to be nullable and storing `guestName`, groups can contain both platform users and temporary guests without duplicating relationship logic.

---

## 2. Expense Split Modeling Strategy

**Context:** Expenses can be split equally, by exact amounts, percentages, shares, or custom distributions.

**Options Considered:**

1. Store only final balances and discard split details.
2. Store split information inside a JSON column.
3. Create a dedicated ExpenseSplit table.

**Decision:** We chose **Option 3**.

**Why:** A dedicated `ExpenseSplit` table preserves full auditability and allows recalculation of balances at any time. It also supports all split methods while keeping the schema normalized and queryable.

---

## 3. Balance Computation Strategy

**Context:** The application constantly needs to show current balances, pending debts, and settlement recommendations.

**Options Considered:**

1. Store running balances in the database and update them after every expense.
2. Recompute balances dynamically from Expenses and Settlements.
3. Maintain a separate Balance table.

**Decision:** We chose **Option 2**.

**Why:** Persisting balances introduces synchronization problems and makes corrections difficult. Computing balances from source-of-truth transactions guarantees consistency and ensures that historical edits automatically propagate through the system.

---

## 4. Settlement Representation

**Context:** When a user settles a debt, the system must reflect that payment in future balance calculations.

**Options Considered:**

1. Update balances directly without storing settlements.
2. Create synthetic negative expenses.
3. Maintain a dedicated Settlement model.

**Decision:** We chose **Option 3**.

**Why:** Settlements represent a fundamentally different business event from expenses. Keeping them in a separate table improves reporting, auditability, and allows the balance engine to clearly distinguish spending from debt repayment.

---

## 5. Activity Feed Architecture

**Context:** Users need visibility into actions happening inside a group such as expenses, settlements, member additions, and imports.

**Options Considered:**

1. Generate activity dynamically from all tables.
2. Create a dedicated Activity table and log events when they occur.
3. Store activity only on the frontend.

**Decision:** We chose **Option 2**.

**Why:** Dynamic reconstruction becomes increasingly expensive as data grows. A dedicated `Activity` model provides a chronological audit trail, improves dashboard performance, and enables future notification features without additional computation.

---

## 6. Dashboard Aggregation Strategy

**Context:** The dashboard requires data from memberships, groups, expenses, balances, settlements, and activity feeds.

**Options Considered:**

1. Make separate API requests for every dashboard widget.
2. Build a dedicated dashboard aggregation endpoint.
3. Perform all calculations on the frontend.

**Decision:** We chose **Option 2**.

**Why:** Dashboard data depends on multiple interconnected calculations. Aggregating server-side reduces frontend complexity, minimizes network requests, and ensures all widgets are derived from a consistent dataset.

---

## 7. CSV Import Validation Before Execution

**Context:** Imported files may contain malformed rows, invalid amounts, unknown users, duplicate records, or inconsistent split definitions.

**Options Considered:**

1. Import immediately and reject rows on failure.
2. Validate the entire file first and present a review report.
3. Accept all rows regardless of quality.

**Decision:** We chose **Option 2**.

**Why:** Users need visibility into data quality issues before records are inserted. The review stage allows anomaly detection, reduces accidental corruption, and provides a safer import workflow.

---

## 8. Import Report Persistence

**Context:** After validation, users may need to review import results later or retry failed imports.

**Options Considered:**

1. Keep validation results only in memory.
2. Store reports on the frontend.
3. Persist reports in the database using ImportReport.

**Decision:** We chose **Option 3**.

**Why:** Persisted reports create a permanent audit trail of imports, allow users to revisit validation outcomes, and support long-running workflows without losing state.

---

## 9. Backend-Centric Business Logic

**Context:** Balance calculations, split generation, debt simplification, activity logging, and imports involve complex financial logic.

**Options Considered:**

1. Perform calculations on the frontend.
2. Split logic between frontend and backend.
3. Centralize all business logic in backend services.

**Decision:** We chose **Option 3**.

**Why:** Financial calculations must remain deterministic and secure. Centralizing logic inside backend services ensures consistency across all clients, prevents manipulation, and keeps the frontend focused purely on presentation.


## 10. Handling Prisma Transaction Timeouts during CSV Import
**Context:** When users import a CSV, a single file might contain upwards of 40-50 expenses. The original implementation wrapped the entire execution (looping through rows, creating Expenses, mapping ExpenseSplits, logging Activities) inside a single `prisma.$transaction`.
**Options Considered:**
1. Keep `prisma.$transaction` to guarantee atomicity (rollback everything if one row fails).
2. Increase the timeout limit heavily on the Prisma client.
3. Switch to sequential direct writes (one row at a time) with idempotency guards.
**Decision:** We chose **Option 3 (Sequential Writes with Idempotency)**.
**Why:** The database (Neon PostgreSQL) experienced latency over the wire, causing `PrismaClientKnownRequestError: P2028 (Transaction API error: Transaction not found)` because the transaction took longer than the default 5s timeout. By switching to sequential writes within `importController.js` and wrapping each row in a separate `try/catch`, one faulty row won't crash the entire import, and it completely bypassed the P2028 timeout issue.

## 11. Foreign Currency (USD to INR) Conversion
**Context:** The user (`Priya`) required handling of USD expenses, but the app's base currency is `INR` (used for all calculations, balances, and UI visualizations).
**Options Considered:**
1. Call an external API (like ExchangeRate-API) on the fly to get live rates.
2. Store expenses strictly as `USD` and calculate `INR` dynamically on the frontend.
3. Hardcode a `.env` exchange rate (`UsdRate=95.11`) and convert at import/creation time.
**Decision:** We chose **Option 3**.
**Why:** Calling an API introduces network failure risks during a massive CSV loop. Storing expenses dynamically breaks mathematical determinism (a ₹1000 debt from last month shouldn't fluctuate to ₹1050 today just because the exchange rate changed). Converting at creation time and saving both `amount` (50 USD) and `amountInr` (4755.50 INR) plus `exchangeRate` ensures historical audits remain perfectly static and mathematically sound forever.

## 12. Delete Group Implementation (Cascading Removes)
**Context:** The app needs a way for admins to fully delete a group, but the group is tied to dozens of dependencies (ImportReports, Activities, Settlements, Expenses, ExpenseSplits, Memberships).
**Options Considered:**
1. Add `ON DELETE CASCADE` to all relations in `schema.prisma`.
2. Soft-delete the group by adding an `isActive: false` boolean.
3. Manually execute a sequential cascade delete in the controller (`deleteGroup`).
**Decision:** We chose **Option 3** (with Prisma handling Expense->Split cascades).
**Why:** Manually enforcing the deletion order (`ImportReport` -> `Activity` -> `Settlement` -> `Expense` -> `Membership` -> `Group`) ensures complete control over the cleanup process. It prevents orphan rows from floating around and avoids relying entirely on database-level triggers which can sometimes fail silently or mask underlying dependency errors during development.

## 13. Import Button Idempotency (Preventing Double-Clicks)
**Context:** During the CSV import `Execute` phase, if a user impatiently double-clicks the "Approve and Import" button, the frontend sends two concurrent HTTP requests, resulting in duplicate DB entries or racing errors.
**Options Considered:**
1. Strictly disable the button state on the frontend (`setLoading(true)`).
2. Make the backend API idempotent (safe to call multiple times).
**Decision:** We did **Both**.
**Why:** Frontend logic isn't fully secure against network retries or malicious spam. The backend `importController.js` now checks `if (report.status === 'COMPLETED') return res.status(200)`. If a duplicate request arrives, it simply returns success instead of throwing a "Report already approved" error, preventing the frontend from crashing into an error state.

## 14. UI Loading Flicker (Silent Refreshing)
**Context:** Whenever a user added an expense, deleted a settlement, or removed a member, the frontend called `loadData()`, which blindly set `loading = true`, turning the entire screen into a loading spinner for a split second.
**Options Considered:**
1. Build an Optimistic UI update (update frontend state instantly, sync in background).
2. Pass a `silent` parameter to `loadData()` to refresh data without mounting the loading screen.
**Decision:** We chose **Option 2**.
**Why:** Optimistic UI for expenses is incredibly hard because adding an expense completely recalculates the complex `Split Engine` and `Balance Sheet`. By adding a `silent=true` parameter, we can let the backend do the heavy lifting of recalculating the math, wait 200ms for the HTTP response, and softly merge the new data into React state without blinding the user with a full-page spinner.

## 15. Greedy Settlement Algorithm ("Simplify Debts")
**Context:** When flatmates owe each other overlapping amounts (e.g. A owes B 100, B owes C 100, C owes A 50), the system needs to reduce this to the absolute minimum number of peer-to-peer transfers.
**Options Considered:**
1. Keep all pairwise debts exactly as incurred (messy, 10+ transactions).
2. Implement a Max-Flow Min-Cut network routing algorithm.
3. Implement a Greedy Algorithm (highest debtor pays highest creditor).
**Decision:** We chose **Option 3**.
**Why:** The greedy algorithm is O(N log N) (due to sorting) and guarantees settling N people in at most N-1 transactions. It perfectly matches the user requirement ("Aisha's requirement: Who pays whom, done") without the overhead and complexity of an enterprise-grade network flow library.
