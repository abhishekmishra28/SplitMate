# Shared Expenses App

A robust, full-stack web application designed for flatmates and friends to track shared expenses, handle complex split logic, and process messy CSV exports from other platforms.

## Overview

This application solves the problem of "who owes whom" with absolute mathematical precision. It was specifically built to handle real-world complexities like:
- People moving in or out mid-month (temporal membership).
- Complex splits (Equal, Unequal, Percentages, and Shares).
- Floating-point currency errors (leaking pennies).
- Messy CSV data imports containing duplicates, casing errors, and settlements disguised as expenses.

## Built with AI (Antigravity by Google DeepMind)

This project was developed using a highly collaborative Pair Programming methodology between a human engineer and the **Antigravity AI agent**. The AI operated autonomously inside the codebase, using system tools to read/write files, analyze database errors, and restructure components on the fly. 

*(For a detailed breakdown of the AI's workflow and mistakes it made along the way, see [AI_USAGE.md](./AI_USAGE.md))*

## Tech Stack

- **Frontend**: React (Vite), Tailwind CSS v3, React Router, Axios, Lucide Icons
- **Backend**: Node.js, Express, JSON Web Tokens (JWT)
- **Database**: NeonDB
- **Deployment**: Vercel (Frontend), Render (Backend + Database)

## Features

- **JWT Authentication**: Secure login and registration.
- **Dynamic Split Engine**: Split expenses by exact amounts, percentages, shares, or equally.
- **Temporal Group Memberships**: Tracks exact `joinedAt` and `leftAt` dates to ensure members aren't charged for expenses outside their residency window.
- **Smart Importer**: A 3-step CSV upload wizard that parses files, runs 19 distinct anomaly detection algorithms, and forces user review before writing to the database.
- **Settlements**: Record direct peer-to-peer payments that reduce net balances.
- **Audit Breakdowns**: Transparently shows exactly how a user's net balance was calculated ("No magic numbers").

## Local Setup

### Prerequisites
- Node.js (v18+)
- NeonDB

### Backend Setup
1. `cd server`
2. `npm install`
3. Copy `.env.example` to `.env` and fill in your PostgreSQL URL, JWT Secret, and `UsdRate` (e.g., `95.11`).
4. Run migrations: `npx prisma migrate dev --name init`
5. Start server: `npm run dev`

### Frontend Setup
1. `cd client`
2. `npm install`
3. Copy `.env.example` to `.env` (pointing `VITE_API_URL` to `http://localhost:5000/api`)
4. Start dev server: `npm run dev`

## File Structure

```text
ExpenseTracker/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # Reusable UI (Modals, Cards, Lists)
│   │   ├── contexts/       # Global state (AuthContext)
│   │   ├── pages/          # Route-level components (Dashboard, GroupView)
│   │   ├── services/       # Axios API handlers
│   │   └── index.css       # Tailwind entry and design tokens
├── server/                 # Express backend
│   ├── prisma/             # Schema and migrations
│   ├── src/
│   │   ├── controllers/    # Route handlers (auth, group, import, expense)
│   │   ├── middleware/     # Auth and error handling
│   │   ├── routes/         # Express routers
│   │   ├── services/       # Core business logic (splits, balances, CSV parsing)
│   │   └── constants/      # Activity types and constants
│   └── server.js           # Server entry point
```
