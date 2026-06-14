# Decision Log

This log captures the significant architectural and design decisions made throughout the development of the application, particularly those handling real-world constraints, performance, and messy data.

---

## 1. Handling Prisma Transaction Timeouts during CSV Import
**Context:** When users import a CSV, a single file might contain upwards of 40-50 expenses. The original implementation wrapped the entire execution (looping through rows, creating Expenses, mapping ExpenseSplits, logging Activities) inside a single `prisma.$transaction`.
**Options Considered:**
1. Keep `prisma.$transaction` to guarantee atomicity (rollback everything if one row fails).
2. Increase the timeout limit heavily on the Prisma client.
3. Switch to sequential direct writes (one row at a time) with idempotency guards.
**Decision:** We chose **Option 3 (Sequential Writes with Idempotency)**.
**Why:** The database (Neon PostgreSQL) experienced latency over the wire, causing `PrismaClientKnownRequestError: P2028 (Transaction API error: Transaction not found)` because the transaction took longer than the default 5s timeout. By switching to sequential writes within `importController.js` and wrapping each row in a separate `try/catch`, one faulty row won't crash the entire import, and it completely bypassed the P2028 timeout issue.

## 2. Foreign Currency (USD to INR) Conversion
**Context:** The user (`Priya`) required handling of USD expenses, but the app's base currency is `INR` (used for all calculations, balances, and UI visualizations).
**Options Considered:**
1. Call an external API (like ExchangeRate-API) on the fly to get live rates.
2. Store expenses strictly as `USD` and calculate `INR` dynamically on the frontend.
3. Hardcode a `.env` exchange rate (`UsdRate=95.11`) and convert at import/creation time.
**Decision:** We chose **Option 3**.
**Why:** Calling an API introduces network failure risks during a massive CSV loop. Storing expenses dynamically breaks mathematical determinism (a ₹1000 debt from last month shouldn't fluctuate to ₹1050 today just because the exchange rate changed). Converting at creation time and saving both `amount` (50 USD) and `amountInr` (4755.50 INR) plus `exchangeRate` ensures historical audits remain perfectly static and mathematically sound forever.

## 3. Delete Group Implementation (Cascading Removes)
**Context:** The app needs a way for admins to fully delete a group, but the group is tied to dozens of dependencies (ImportReports, Activities, Settlements, Expenses, ExpenseSplits, Memberships).
**Options Considered:**
1. Add `ON DELETE CASCADE` to all relations in `schema.prisma`.
2. Soft-delete the group by adding an `isActive: false` boolean.
3. Manually execute a sequential cascade delete in the controller (`deleteGroup`).
**Decision:** We chose **Option 3** (with Prisma handling Expense->Split cascades).
**Why:** Manually enforcing the deletion order (`ImportReport` -> `Activity` -> `Settlement` -> `Expense` -> `Membership` -> `Group`) ensures complete control over the cleanup process. It prevents orphan rows from floating around and avoids relying entirely on database-level triggers which can sometimes fail silently or mask underlying dependency errors during development.

## 4. Import Button Idempotency (Preventing Double-Clicks)
**Context:** During the CSV import `Execute` phase, if a user impatiently double-clicks the "Approve and Import" button, the frontend sends two concurrent HTTP requests, resulting in duplicate DB entries or racing errors.
**Options Considered:**
1. Strictly disable the button state on the frontend (`setLoading(true)`).
2. Make the backend API idempotent (safe to call multiple times).
**Decision:** We did **Both**.
**Why:** Frontend logic isn't fully secure against network retries or malicious spam. The backend `importController.js` now checks `if (report.status === 'COMPLETED') return res.status(200)`. If a duplicate request arrives, it simply returns success instead of throwing a "Report already approved" error, preventing the frontend from crashing into an error state.

## 5. UI Loading Flicker (Silent Refreshing)
**Context:** Whenever a user added an expense, deleted a settlement, or removed a member, the frontend called `loadData()`, which blindly set `loading = true`, turning the entire screen into a loading spinner for a split second.
**Options Considered:**
1. Build an Optimistic UI update (update frontend state instantly, sync in background).
2. Pass a `silent` parameter to `loadData()` to refresh data without mounting the loading screen.
**Decision:** We chose **Option 2**.
**Why:** Optimistic UI for expenses is incredibly hard because adding an expense completely recalculates the complex `Split Engine` and `Balance Sheet`. By adding a `silent=true` parameter, we can let the backend do the heavy lifting of recalculating the math, wait 200ms for the HTTP response, and softly merge the new data into React state without blinding the user with a full-page spinner.

## 6. Greedy Settlement Algorithm ("Simplify Debts")
**Context:** When flatmates owe each other overlapping amounts (e.g. A owes B 100, B owes C 100, C owes A 50), the system needs to reduce this to the absolute minimum number of peer-to-peer transfers.
**Options Considered:**
1. Keep all pairwise debts exactly as incurred (messy, 10+ transactions).
2. Implement a Max-Flow Min-Cut network routing algorithm.
3. Implement a Greedy Algorithm (highest debtor pays highest creditor).
**Decision:** We chose **Option 3**.
**Why:** The greedy algorithm is O(N log N) (due to sorting) and guarantees settling N people in at most N-1 transactions. It perfectly matches the user requirement ("Aisha's requirement: Who pays whom, done") without the overhead and complexity of an enterprise-grade network flow library.