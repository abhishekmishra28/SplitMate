# AI Usage in Development

This project was built through a highly collaborative Pair Programming session between a Human Engineer and an AI Assistant (Antigravity by Google DeepMind). 

The Human provided the strict business rules, complex edge cases, and CSV samples, while the AI operated autonomously inside the codebase to read/write files, analyze database errors, and structure the architecture.

## AI Tools Used
- **Agent:** ChatGPT
- **Primary Tools Invoked:**
  - `view_file` / `read_file` to ingest existing React components and Prisma schemas.
  - `replace_file_content` / `write_to_file` to author business logic and GUI components.
  - `run_command` to execute terminal scripts (`npm run dev`, `npx prisma migrate dev`), parse error logs, and hunt down text using `Select-String`.
  - Internal Artifact generation (`implementation_plan.md`) to align on technical architectures before execution.

## Key Prompts Used
1. *"Fix the irritating loading after each request"* -> This prompted the AI to refactor the frontend data fetching layer, bypassing a full-screen `setLoading(true)` spinner and instead implementing a `silent` parameter for background refreshing after state mutations.
2. *"Transaction API error: Transaction not found... showing multiple errors like Already approved ... and error in import... just fix it completely"* -> This prompted the AI to deeply investigate the Prisma `P2028` timeout error during CSV ingestion and decouple the database writes from a single transaction block.
3. *"Still facing problem in detecting accurate anomalies in the csv file ... fix it properly ... handle every logic efficiently"* -> This drove the AI to build out the 19-stage anomaly detection engine inside `importValidationService.js`.

---

## AI Mistakes & Human Corrections

While the AI was highly capable at writing boilerplate and logic, it occasionally made incorrect assumptions about the data structures and real-world environment limits. The Human had to step in and correct the AI's trajectory. Here are three concrete cases:

### 1. Date Parsing Failures (DD/MM/YYYY vs MM/DD/YYYY)
- **What the AI did wrong:** The AI initially parsed CSV dates using standard JavaScript `new Date(row.date)`.
- **How it was caught:** The human provided a sample CSV where a date like `01/02/2026` (meaning February 1st) was being interpreted by JS as January 2nd (US format).
- **What was changed:** The AI had to ditch the native `Date` object and write a robust `parseDate` utility using `date-fns`. The utility now uses regex to explicitly check for `DD/MM/YYYY` vs `MM/DD/YYYY` and parses them accurately based on strict token formats.

### 2. Prisma Transaction Timeouts (The P2028 Error)
- **What the AI did wrong:** During Phase 3 of the CSV import, the AI wrapped the entire execution loop (creating expenses, expense splits, and audit activities for 40+ rows) inside a single `prisma.$transaction`.
- **How it was caught:** When the human triggered an actual CSV upload, the application crashed with a `PrismaClientKnownRequestError: P2028`. The Neon Postgres database took slightly longer than 5 seconds over the wire to complete the massive multi-insert, causing Prisma to silently drop the transaction lock.
- **What was changed:** The AI completely refactored `importController.js`. It removed the `prisma.$transaction` wrapper entirely and switched to a sequential `for...of` loop with individual `try/catch` blocks. If one row fails, it logs an error but no longer crashes the database.

### 3. Parsing Numerical Amounts with Commas
- **What the AI did wrong:** The AI attempted to cast string amounts from the CSV directly to floats using `parseFloat(row.amount)`.
- **How it was caught:** The human uploaded a CSV where large numbers were formatted with commas (e.g., `"1,200"`). `parseFloat("1,200")` returned `NaN`, causing a massive database validation crash since Prisma expects a Float.
- **What was changed:** The AI updated the CSV cleaning phase in `importValidationService.js` to strip commas out of the string (`String(row.amount).replace(/,/g, "")`) before attempting any numerical casting. This completely resolved the NaN errors.
