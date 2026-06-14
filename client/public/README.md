# SplitMate — Shared Expenses App

A production-quality shared expenses application built for the Flatmates Assignment.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + JavaScript + Vite |
| Styling | Tailwind CSS v4 |
| Database | localStorage (simulating NeonDB/PostgreSQL schema) |
| Charts | Recharts |
| CSV Parsing | PapaParse |
| Routing | React Router DOM |
| Notifications | react-hot-toast |
| Date Handling | date-fns |

## Features

### ✅ Core Features
- **Auth**: Sign up / Login + 6 demo accounts (Aisha, Rohan, Priya, Meera, Sam, Dev)
- **Groups**: Create groups, add/remove members with temporal membership tracking
- **Expenses**: Add expenses with Equal, Exact, Percentage, Share split types
- **Settlements**: Record payments between members
- **Balances**: Per-member balance summary + debt simplification (who pays whom)
- **CSV Import**: Two-phase import with 18 anomaly detection handlers

### ✅ CSV Import (Phase 1 - Analyze, Phase 2 - Confirm)
1. Upload CSV → analyze without writing to DB
2. Review anomaly report (color-coded by severity)
3. Approve/reject items needing manual decision
4. Confirm → bulk insert approved records

### ✅ Analytics
- Group-wise and personal balance summaries
- Monthly spending trends
- Category breakdown (auto-detected from description)
- Top expenses
- Pending debt list

## Demo Accounts

| Name | Email | Password |
|------|-------|----------|
| Aisha | aisha@flat.demo | demo123 |
| Rohan | rohan@flat.demo | demo123 |
| Priya | priya@flat.demo | demo123 |
| Meera | meera@flat.demo | demo123 |
| Sam | sam@flat.demo | demo123 |
| Dev | dev@flat.demo | demo123 |

Or use the **Quick Login buttons** on the auth page.

## Data Import

1. Log in as any demo user
2. Create a group (add other flatmates as members)
3. Go to the group → "Import CSV"
4. Upload `expenses_export.csv` (provided)
5. Review the anomaly report
6. Confirm import

## Anomaly Handling (18 types)

| # | Type | Severity | Action |
|---|------|----------|--------|
| 1 | EXACT_DUPLICATE | APPROVAL | User picks which to keep |
| 2 | NAME_CASE_INCONSISTENCY | INFO | Auto-normalized |
| 3 | IMPRECISE_AMOUNT | INFO | Rounded to 2 decimals |
| 4 | TRUNCATED_NAME | WARN | Fuzzy-matched (Levenshtein) |
| 5 | SETTLEMENT_AS_EXPENSE | APPROVAL | Import as Settlement |
| 6 | PERCENTAGE_OVER_100 | ERROR | Blocked |
| 7 | USD_CONVERSION | INFO | Converted at 83.5 |
| 8 | NON_MEMBER_IN_SPLIT | APPROVAL | Guest placeholder |
| 9 | FUZZY_DUPLICATE | APPROVAL | Side-by-side comparison |
| 10 | NEGATIVE_AMOUNT_REFUND | INFO | Treated as refund |
| 11 | MALFORMED_DATE | APPROVAL | Parsed with year inference |
| 12 | MISSING_CURRENCY | WARN | Defaults to INR |
| 13 | ZERO_AMOUNT | INFO | Row skipped |
| 14 | AMBIGUOUS_DATE | WARN | DD-MM-YYYY assumed |
| 15 | INACTIVE_MEMBER_IN_SPLIT | APPROVAL | Removed from split |
| 16 | DEPOSIT_AS_EXPENSE | APPROVAL | Import as Settlement |
| 17 | SPLIT_TYPE_CONFLICT | INFO | Auto-resolved |
| 18 | EXPENSE_BEFORE_JOIN | APPROVAL | Removed from split |

## Local Setup

```bash
git clone <repo>
cd splitmate
npm install
npm run dev
```

No environment variables needed — data is stored in localStorage.

## AI Used

Claude (Anthropic) — primary development collaborator.
