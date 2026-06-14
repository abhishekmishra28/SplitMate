# Decision Log

This log captures the significant architectural and design decisions I made throughout the development of the application, particularly when handling real-world constraints, performance considerations, and messy data.

---

## 1. User Membership Model (Guests vs Registered Users)

### Context

The assignment dataset contained both registered users and non-platform participants. Real expense groups often include people who have not yet created an account.

### Options Considered

1. Force every participant to register before being added to a group.
2. Maintain a separate Guest table.
3. Allow Membership to reference either a User or a guest name.

### Decision

I chose **Option 3**.

### Why

Real-world expense splitting should not require every participant to create an account. By allowing `Membership.userId` to be nullable and storing `guestName`, groups can contain both platform users and temporary guests without duplicating relationship logic.

---

## 2. Expense Split Modeling Strategy

### Context

Expenses can be split equally, by exact amounts, percentages, shares, or custom distributions.

### Options Considered

1. Store only final balances and discard split details.
2. Store split information inside a JSON column.
3. Create a dedicated `ExpenseSplit` table.

### Decision

I chose **Option 3**.

### Why

A dedicated `ExpenseSplit` table preserves full auditability and allows recalculation of balances at any time. It also supports all split methods while keeping the schema normalized and queryable.

---

## 3. Balance Computation Strategy

### Context

The application constantly needs to show current balances, pending debts, and settlement recommendations.

### Options Considered

1. Store running balances in the database and update them after every expense.
2. Recompute balances dynamically from Expenses and Settlements.
3. Maintain a separate Balance table.

### Decision

I chose **Option 2**.

### Why

Persisting balances introduces synchronization problems and makes corrections difficult. Computing balances from source-of-truth transactions guarantees consistency and ensures that historical edits automatically propagate through the system.

---

## 4. Settlement Representation

### Context

When a user settles a debt, the system must reflect that payment in future balance calculations.

### Options Considered

1. Update balances directly without storing settlements.
2. Create synthetic negative expenses.
3. Maintain a dedicated Settlement model.

### Decision

I chose **Option 3**.

### Why

Settlements represent a fundamentally different business event from expenses. Keeping them in a separate table improves reporting, auditability, and allows the balance engine to clearly distinguish spending from debt repayment.

---

## 5. Activity Feed Architecture

### Context

Users need visibility into actions happening inside a group such as expenses, settlements, member additions, and imports.

### Options Considered

1. Generate activity dynamically from all tables.
2. Create a dedicated Activity table and log events when they occur.
3. Store activity only on the frontend.

### Decision

I chose **Option 2**.

### Why

Dynamic reconstruction becomes increasingly expensive as data grows. A dedicated `Activity` model provides a chronological audit trail, improves dashboard performance, and enables future notification features without additional computation.

---

## 6. Dashboard Aggregation Strategy

### Context

The dashboard requires data from memberships, groups, expenses, balances, settlements, and activity feeds.

### Options Considered

1. Make separate API requests for every dashboard widget.
2. Build a dedicated dashboard aggregation endpoint.
3. Perform all calculations on the frontend.

### Decision

I chose **Option 2**.

### Why

Dashboard data depends on multiple interconnected calculations. Aggregating server-side reduces frontend complexity, minimizes network requests, and ensures all widgets are derived from a consistent dataset.

---

## 7. CSV Import Validation Before Execution

### Context

Imported files may contain malformed rows, invalid amounts, unknown users, duplicate records, or inconsistent split definitions.

### Options Considered

1. Import immediately and reject rows on failure.
2. Validate the entire file first and present a review report.
3. Accept all rows regardless of quality.

### Decision

I chose **Option 2**.

### Why

Users need visibility into data quality issues before records are inserted. The review stage allows anomaly detection, reduces accidental corruption, and provides a safer import workflow.

---

## 8. Import Report Persistence

### Context

After validation, users may need to review import results later or retry failed imports.

### Options Considered

1. Keep validation results only in memory.
2. Store reports on the frontend.
3. Persist reports in the database using `ImportReport`.

### Decision

I chose **Option 3**.

### Why

Persisted reports create a permanent audit trail of imports, allow users to revisit validation outcomes, and support long-running workflows without losing state.

---

## 9. Backend-Centric Business Logic

### Context

Balance calculations, split generation, debt simplification, activity logging, and imports involve complex financial logic.

### Options Considered

1. Perform calculations on the frontend.
2. Split logic between frontend and backend.
3. Centralize all business logic in backend services.

### Decision

I chose **Option 3**.

### Why

Financial calculations must remain deterministic and secure. Centralizing logic inside backend services ensures consistency across all clients, prevents manipulation, and keeps the frontend focused purely on presentation.

---

## 10. Handling Prisma Transaction Timeouts During CSV Import

### Context

When users import a CSV, a single file might contain upwards of 40–50 expenses. The original implementation wrapped the entire execution inside a single `prisma.$transaction`.

### Options Considered

1. Keep `prisma.$transaction` to guarantee atomicity.
2. Increase Prisma timeout limits.
3. Switch to sequential writes with idempotency guards.

### Decision

I chose **Option 3 (Sequential Writes with Idempotency)**.

### Why

Neon PostgreSQL introduced network latency, causing `PrismaClientKnownRequestError: P2028`. Sequential writes eliminated transaction timeout issues and prevented one bad row from failing the entire import.

---

## 11. Foreign Currency (USD to INR) Conversion

### Context

The dataset required handling USD expenses while the application's base currency is INR.

### Options Considered

1. Fetch live exchange rates from an external API.
2. Store expenses in USD and convert dynamically.
3. Convert at creation time using a configured exchange rate.

### Decision

I chose **Option 3**.

### Why

Live exchange rates introduce network failures and historical inconsistency. Saving `amount`, `amountInr`, and `exchangeRate` ensures all historical calculations remain deterministic forever.

---

## 12. Delete Group Implementation (Cascading Removes)

### Context

Groups contain multiple dependent entities such as Activities, Expenses, Settlements, Memberships, and Import Reports.

### Options Considered

1. Rely completely on database cascade deletes.
2. Soft-delete groups.
3. Implement manual deletion order in the controller.

### Decision

I chose **Option 3**.

### Why

Manual deletion guarantees complete cleanup and prevents orphaned records. The deletion sequence is:

`ImportReport → Activity → Settlement → Expense → Membership → Group`

while Prisma handles `Expense → ExpenseSplit` cascades.

---

## 13. Import Button Idempotency (Preventing Double-Clicks)

### Context

Users could accidentally submit multiple import requests by clicking the approval button repeatedly.

### Options Considered

1. Disable the button on the frontend.
2. Make the backend endpoint idempotent.

### Decision

I implemented **both approaches**.

### Why

Frontend protection improves UX, while backend idempotency protects against retries, race conditions, and malicious requests. Duplicate import requests now safely return success.

---

## 14. UI Loading Flicker (Silent Refreshing)

### Context

Refreshing group data after every mutation caused the entire page to flash a loading spinner.

### Options Considered

1. Implement optimistic updates.
2. Add a silent refresh mode.

### Decision

I chose **Option 2**.

### Why

Expense creation affects balances, settlements, and debt simplification simultaneously. Silent refreshes allow the backend to recalculate everything while updating the UI smoothly without full-screen flicker.

---

## 15. Greedy Settlement Algorithm ("Simplify Debts")

### Context

The application needed to reduce complex debt graphs into the minimum number of payments.

### Options Considered

1. Preserve all original pairwise debts.
2. Implement a Max-Flow Min-Cut algorithm.
3. Use a Greedy Debtor-Creditor matching algorithm.

### Decision

I chose **Option 3**.

### Why

The greedy approach runs in `O(N log N)` and settles debts in at most `N - 1` transactions. It produces intuitive results while remaining simple, efficient, and easy to maintain.
