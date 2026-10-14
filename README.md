# OmniLife Studio 🚀
### Integrated Personal Intelligence, Multivariate ML Forecasting & AI Decision Simulation System

OmniLife Studio is a full-stack personal analytics and decision-support web platform. It unifies four fundamental pillars of self-mastery—**Cognitive Study Tracking, Financial Management (in Indian Rupees ₹), Routine Habit Consistency, and SMART Goal Roadmaps**—into a single relational data platform.

Beyond passive logging, OmniLife features a **1,200-record multivariate Machine Learning predictive engine**, an interactive **What-If Decision Simulator** with quantitative risk modeling, and a server-side **Google Gemini Tool-Calling Assistant** for analytics, forecasts, and guided record management.

---

## 🌟 Key Modules & Capabilities

### 1. Central Analytics Dashboard
* **Life Synergy Index (0–100)**: Multi-domain algorithm aggregating study focus (40%), savings velocity (20%), habit momentum (25%), and goal fulfillment (15%).
* **Interactive SVG Visualizations**:
  * Study Duration vs. Focus Depth trend curves.
  * Money Allocation breakdown (Inflow vs. Outflow vs. Savings vs. Investments).
  * 7-day habit streak momentum bars.
  * Goal milestone progress indicators.
* **Launchpad Quick Log**: Global entry modal committing multi-category records in milliseconds.

### 2. Cognitive Study Tracker
* **Metric Logging**: Subject, topic, duration (minutes), technique (Pomodoro, Deep Work, Active Recall, Feynman), subjective focus score (1–10), and energy rating.
* **Goal Syncing**: Completed hours automatically link to target study goals.

### 3. Financial Flow & Wealth Manager (₹ INR)
* **Localized Currency**: Standardized strictly in **Indian Rupees (₹ / INR)**.
* **Categorized Ledgers**: Inflow (Salary, Freelance), Outflow (Tech, Food, Utilities), Investments (Mutual Funds, Equity), and Emergency Reserves.
* **Savings Velocity**: Automated net surplus and savings rate calculation.

### 4. Interactive Habit Matrix
* **7-Day Consistency Grid**: Interactive day check-ins toggling completion directly in PostgreSQL.
* **Streak Gamification**: Dynamic calculation of current unbroken streaks, longest streaks, and completion rates.

### 5. SMART Goal Roadmaps
* **Milestone Checklists**: Sub-tasks with interactive completion states.
* **Confetti Celebration**: Physics-based confetti celebration triggers when goals reach 100%.

### 6. Multivariate Machine Learning Forecasting (1,200 Records)
* **Dataset Scale**: Trained across 1,200 records with 6 multivariate features (Deep work ratio, sleep hours, distractions, baseline performance, savings rate, routine compounding).
* **Statistical Performance**: Ridge regression pipeline delivering $R^2 > 0.85$, Mean Absolute Error (MAE), and Mean Squared Error (MSE).
* **Feature Importance Chart**: Normalized weight coefficients displaying highest-leverage input drivers.
* **Multi-Horizon Trajectory**: 7-day to 365-day forecast curves with 95% confidence interval shaded error bands.
* **Custom Dataset Import**: Drag-and-drop CSV uploader for retraining models on personalized data.

### 7. What-If Decision Simulation Engine
* **Dynamic Sliders**: Study hours, deep work ratio, sleep duration, savings rate, expected annual returns, and screen time.
* **Real-Time Differential Modeling**: Compares simulated future curves directly against the status-quo baseline.
* **Quantitative Risk Score (0–100)**: Evaluates burnout risk from sleep deprivation and frugality fatigue from excessive spending cuts.
* **Strategic Prescriptions**: Actionable recommendations with projected quantified gains.

### 8. Gemini Tool-Calling Assistant
* **Tool-Calling Architecture**: Stateless Express agent executing structured tools (`build_report`, `list_entries`, `get_forecast`, `propose_entry`, `propose_delete`).
* **Client-Confirmed Actions**: Writes and deletes require explicit user confirmation cards before execution.
* **Currency Enforcement**: Strict numerical generation in **Indian Rupees (₹)**.

### 9. Strict Authentication & Registration Gating
* **Strict Gate**: Every user action is gated behind authentic Firebase Authentication and registered PostgreSQL profiles. Guest logins, un-isolated demo sessions, and fallback accounts have been completely removed.
* **Email & Password**: Registration with client-side password strength validation and atomic backend registration (`POST /api/auth/register`).
* **Google Sign-In**: Firebase OAuth with mutex guards preventing popup concurrency assertion errors, paired with automatic profile registration on first sign-in.
* **Security & Isolation Enforcement**:
  * Unauthenticated requests are rejected immediately with HTTP 401 Unauthorized.
  * Tokens from users not yet registered in PostgreSQL receive HTTP 403 Forbidden with `{ error: 'User is not registered in OmniLife Studio', code: 'NOT_REGISTERED' }`, prompting the client to register or sign out.
* **Public Endpoints (Unauthenticated)**:
  * `GET /api/health`: Database and service availability check.
  * `GET /api/download-guide-pdf`: User manual PDF.
  * `GET /api/download-presentation-script-pdf`: Presentation script PDF.
  * `GET /api/download-ieee-paper-pdf`: Academic IEEE paper PDF.
* **Firebase Console Prerequisites**:
  * Enable the **Email/Password** sign-in provider in the Firebase Console under Authentication > Sign-in method.
  * Ensure your domain (e.g. `localhost`) is listed in Firebase Console under Authentication > Settings > Authorized domains.
  * Set `FIREBASE_PROJECT_ID` in `.env` (or ensure `projectId` is populated in `firebase-applet-config.json`).

### 10. Locked Dashboard Preview & Sign-In Modal (Unauthenticated Visitors)
* **Default Unauthenticated View**: Unauthenticated visitors opening the root page see the real dashboard layout in a locked, non-interactive preview state filled with clearly labelled sample data, replacing the previous standalone full-page sign-in screen.
* **Visual Lock Affordances**:
  * Persistent top ribbon: *"Locked preview · Sample data · Sign in to use your own"*.
  * Lock icons (`lucide-react`) on all navigation tabs and hero shortcuts.
  * Transparent capture layer over an `inert` preview DOM region displaying a lock cursor and hover hint (`Sign in to unlock`).
  * Frosted bottom gradient fade with a centered call-to-action (*"Create a free account to see your own analytics"*).
  * Accessible keyboard path: Top navigation bar includes explicit, focusable **Sign In** and **Register** buttons, and the ribbon contains a focusable unlock button.
* **Zero `/api/*` Requests in Preview (Hard Guarantee)**:
  * Preview data is bundled as static, typed fixtures (`previewData.ts`) matching backend API response interfaces.
  * Live-fetching container views (`DashboardView`, `StudyView`, `FinanceView`, `HabitsView`, `GoalsView`, `ForecastingView`, `SimulationView`, `AssistantWidget`) are **never mounted** in preview mode; only the pure presentational `DashboardContent` is rendered with static fixtures.
  * Zero network requests are made to any `/api/*` route while in preview mode, verified by automated unit tests and browser network monitoring.
  * No guest IDs, mock identities, or sessions are created in localStorage or the database.
* **Interactive Sign-In / Sign-Up Modal**:
  * Any click on tabs, hero launchpad shortcuts (Forecasting, Simulation, Assistant, Log New Activity), cards, chart links, or the floating assistant button intercepts the action and displays an accessible modal dialog (`role="dialog"`, `aria-modal="true"`).
  * The modal displays a targeted context line explaining the trigger (e.g. *"Sign in to use Forecasting (ML)"*).
  * Focus is trapped inside the modal while open, body scroll is locked, and pressing `Escape` or clicking the backdrop/close button closes the modal and returns focus to the triggering element.
  * Built using `motion/react` with smooth entrance animations (automatically disabled when `prefers-reduced-motion` is active) and responsive full-screen sheet styling on viewports below 480px.
  * **Intent Preservation**: The user's intended destination tab is preserved in React state. Upon successful authentication, the preview unmounts and the user lands directly on their requested tab with their real account data.
  * Signing out returns the user to the locked preview with the modal closed.

---

## 🔒 Data Isolation & Forecast Data Thresholds

### Clean New-User State
* **Zero Automatic Seeding**: Newly registered accounts start completely clean with 0 records in all modules.
* **Neutral Synergy Index**: The Central Dashboard displays `--/100` (`null`) for the Life Synergy Index until a user has logged records across at least two distinct domains.
* **Strict User Partitioning**: Every database query filters explicitly by `user_id = req.user.id`.

### Forecast & Simulation Thresholds
* **14-Day Minimum**: Predictive ML forecasting (`POST /api/ml/train`) and What-If decision simulations (`POST /api/simulation/run`) require at least **14 distinct active days** of real activity in the selected domain.
* **HTTP 422 Rejection**: Requests submitted with fewer than 14 active days are rejected server-side with HTTP 422 `INSUFFICIENT_DATA` before invoking the Python engine.
* **Custom CSV Training**: User-uploaded CSV datasets require a minimum of 14 valid data rows.
* **Readiness UI**: Visual progress bars and confidence badges indicate progress toward the 14-day calibration mark and the 28-day high-reliability mark.

---

## 🛠️ Technology Stack Architecture

```
┌────────────────────────────────────────────────────────┐
│                   Frontend Client                      │
│     React 19 · TypeScript · Tailwind CSS · Vite        │
└───────────────────────────┬────────────────────────────┘
                            │ REST / JSON (Port 3000)
┌───────────────────────────▼────────────────────────────┐
│                    Backend Server                      │
│            Node.js · Express · TSX Runtime             │
└───────┬───────────────────┬────────────────────┬───────┘
        │ Drizzle ORM       │ Child Process      │ @google/genai
┌───────▼───────────┐ ┌─────▼──────────┐ ┌───────▼────────┐
│ Cloud SQL (PG)    │ │ Python 3 ML    │ │ Gemini AI SDK  │
│ Relational Schema │ │ Ridge Reg / R² │ │ Context Ground │
└───────────────────┘ └────────────────┘ └────────────────┘
```

* **Frontend**: React 19, TypeScript, Tailwind CSS, Lucide Icons, Canvas Confetti.
* **Backend**: Node.js, Express, TSX.
* **Database**: Cloud SQL PostgreSQL with Drizzle ORM.
* **Machine Learning**: Python 3 (`scripts/ml_forecasting.py`).
* **AI Engine**: `@google/genai` SDK with Gemini 3.7 / 3.5 / 3.8 Flash.
* **Auth**: Firebase Authentication (Email/Password, Google OAuth) with strict server-side PostgreSQL registration gating.

---

## 📁 Monorepo Architecture & Structure

OmniLife Studio is organized as a maintainable full-stack monorepo using npm workspaces:

```
├── frontend/                        # Client-side React 19 application
│   ├── index.html                   # HTML entry point with Vite module script
│   ├── vite.config.ts               # Vite configuration (React, Tailwind, proxy)
│   ├── tsconfig.json                # Frontend TypeScript configuration
│   ├── package.json                 # Frontend dependencies (React, Recharts, Lucide, Firebase)
│   ├── public/                      # Static assets & datasets
│   │   └── datasets/                # Sample 1,200-record CSV datasets (study, finance, habits)
│   └── src/
│       ├── App.tsx                  # Main application shell & tab routing
│       ├── main.tsx                 # Client DOM mount
│       ├── index.css                # Global styles & Tailwind utilities
│       ├── features/                # Domain-driven feature modules
│       │   ├── auth/                # Firebase Auth view & AuthContext
│       │   ├── dashboard/           # KPI metrics & Synergy Index view
│       │   ├── study/               # Cognitive session tracker view
│       │   ├── finance/             # Income & expense ledger view (₹ INR)
│       │   ├── habits/              # Habit consistency matrix view
│       │   ├── goals/               # SMART goal roadmap view
│       │   ├── forecasting/         # 1,200-record ML regression view
│       │   ├── simulation/          # What-If scenario simulation view
│       │   └── assistant/           # Floating Gemini chat widget & rich blocks
│       ├── components/              # Shared UI components (Navbar, QuickLogModal, AlertBanner)
│       ├── services/                # API client (apiFetch) & Firebase client SDK
│       └── types/                   # TypeScript domain models & assistant types
│
├── backend/                         # Express REST API, Database & Server integrations
│   ├── package.json                 # Backend dependencies (Express, Drizzle, pg, Firebase Admin)
│   ├── tsconfig.json                # Backend TypeScript configuration
│   ├── drizzle.config.ts            # Drizzle ORM configuration for PostgreSQL
│   ├── python_service/              # Machine learning engine
│   │   └── ml_engine.py             # Python 3 Ridge regression & What-If simulation engine
│   ├── scripts/                     # Database bootstrapping and maintenance tooling
│   │   ├── setup-db.ts              # Non-destructive schema setup & table verification
│   │   ├── check-db.ts              # Connection diagnostic & live row count audit
│   │   └── seed.ts                  # 30-day realistic historical data seeder
│   └── src/
│       ├── server.ts                # Express entry point & Vite dev/prod orchestrator
│       ├── routes/index.ts          # Central API router aggregator (/api/*)
│       ├── middleware/auth.ts       # Firebase ID token verification & guest mode fallback
│       ├── config/firebase-admin.ts # Server-side Firebase Admin SDK initialization
│       ├── db/                      # PostgreSQL persistence layer
│       │   ├── index.ts             # Connection pool (pg.Pool) & Drizzle instance
│       │   ├── schema.ts            # Drizzle relational schema definitions
│       │   ├── health.ts            # Database health verification & masking logic
│       │   ├── envCheck.ts          # Database credentials & environment validator
│       │   ├── users.ts             # User profile synchronization helpers
│       │   └── seedDefaults.ts      # Default profile seeding
│       └── modules/                 # Modular API feature routers & services
│           ├── health/              # Health check endpoint (/api/health)
│           ├── users/               # Profile synchronization (/api/user/sync)
│           ├── study/               # Study sessions CRUD (/api/study)
│           ├── finance/             # Financial transactions CRUD (/api/finance)
│           ├── habits/              # Habits & check-in logs (/api/habits)
│           ├── goals/               # Goal roadmaps & progress (/api/goals)
│           ├── forecasting/         # Python ML training bridge (/api/ml)
│           ├── simulation/          # Scenario simulation engine (/api/simulation)
│           ├── dashboard/           # Aggregated analytics (/api/dashboard/overview)
│           ├── documents/           # PDFKit document generator (/api/download-*-pdf)
│           └── assistant/           # Gemini AI agent, tool calling & RAG pipeline
│
├── docs/                            # Documentation
│   └── IEEE_PAPER_DOCUMENTATION.md  # Academic paper documentation
├── scripts/                         # Root maintenance tooling
│   └── clean-cache.mjs              # Dev & build cache cleaner
├── firebase-applet-config.json      # Firebase project credentials
├── docker-compose.yml               # PostgreSQL 16 container definition
├── .env.example                     # Environment template
└── package.json                     # Root monorepo workspace configuration
```

---

## 🚀 How to Run in VS Code (Windows / Mac / Linux)

### 1. Prerequisites
* **Node.js**: Version 20 or higher installed on your computer ([Download Node.js](https://nodejs.org/)).
* **PostgreSQL**: Version 15 or 16+ running locally (or via Docker).
* **Python**: Version 3.10+ (optional, for custom ML script execution).

---

### 2. Step-by-Step Instructions

#### Step 1: Open Terminal in VS Code
Open VS Code, press ``Ctrl + ` `` (or go to **Terminal** > **New Terminal**).

#### Step 2: Install All Dependencies
```bash
npm install
```
> 💡 **Peer Dependencies Note (`.npmrc`):**
> The repository includes an `.npmrc` with `legacy-peer-deps=true`. This is required because `@tailwindcss/vite` declares a peer dependency on Vite 8 / esbuild `^0.27 || ^0.28`, while Vite installs `esbuild@0.25.x`. A future dependency bump will resolve this upstream conflict.

#### Step 3: Configure Environment Variables
Copy the template configuration file:
```bash
cp .env.example .env
```
Open `.env` and fill in your real PostgreSQL password and Gemini API key:
- `SQL_PASSWORD`: Your local PostgreSQL user password (replace `YOUR_SQL_PASSWORD_HERE`).
- `SQL_ADMIN_PASSWORD`: Your PostgreSQL superuser/admin password (if separate, or leave equal to `SQL_PASSWORD`).
- `GEMINI_API_KEY`: Your Google AI Studio API key.

#### Step 4: Run the Development Server
```bash
npm run dev
```
> 🛡️ **Self-Healing Bootstrap:** `npm run dev` automatically triggers `predev` (`npm run db:setup`), which connects to PostgreSQL, creates the database if missing, and verifies all 8 schema tables before starting the web server.

#### Step 5: Open in Your Browser
Once the server starts, open your browser and go to:
```
http://localhost:3000
```

---

## 🗄️ Local Database Setup

OmniLife Studio uses PostgreSQL with Drizzle ORM. You can run PostgreSQL either natively or with Docker.

### Option A: Native PostgreSQL Service

#### Windows
1. Download and run the PostgreSQL installer from [postgresql.org](https://www.postgresql.org/download/windows/) (or install via `winget install PostgreSQL.PostgreSQL`).
2. Ensure the Windows service is running in PowerShell:
   ```powershell
   Get-Service -Name postgresql*
   # If stopped, start it:
   Start-Service -Name postgresql*
   ```
3. Set your postgres user password during installation and mirror it in `.env` as `SQL_PASSWORD="your_password"`.

#### macOS / Linux
```bash
# macOS (Homebrew)
brew install postgresql@16
brew services start postgresql@16

# Ubuntu / Debian
sudo apt update && sudo apt install -y postgresql postgresql-contrib
sudo systemctl start postgresql
```

### Option B: Docker Compose (Convenience)
If you prefer Docker, a `docker-compose.yml` is provided:
```bash
# Start PostgreSQL 16 in the background
docker compose up -d

# Verify container is running
docker compose ps
```

---

## 🛠️ Management & Verification Scripts

| Command | Workspace / Script | Purpose |
| :--- | :--- | :--- |
| `npm run dev` | Full-Stack (`backend/src/server.ts`) | Launches Express backend + Vite dev middleware orchestrator on port 3000. |
| `npm run build` | Frontend (`frontend/vite.config.ts`) | Compiles production client bundle into `frontend/dist`. |
| `npm run test` | Monorepo (`backend` & `frontend`) | Runs test suites across backend and frontend services. |
| `npm run lint` | Monorepo (`tsc --noEmit`) | Strict TypeScript compiler validation across all monorepo source files. |
| `npm run db:setup` | Backend (`backend/scripts/setup-db.ts`) | **Idempotent bootstrap.** Creates database if missing and verifies schema tables without altering data. |
| `npm run db:check` | Backend (`backend/scripts/check-db.ts`) | **Read-only audit.** Inspects connection, audits rows grouped by identity class (`firebase`, `guest_`, `usr_`, `demo_`, `default`), and warns on un-isolated accounts. |
| `npm run db:seed -- --email <email>` | Backend (`backend/scripts/seed.ts`) | Populates 30 days of realistic multi-domain demo data for a registered user. Requires `--email`. |
| `npm run db:clear-user -- --email <email>` | Backend (`backend/scripts/clear-user-data.ts`) | Safely wipes domain records for a specific user (FK-safe order). Dry run by default; use `--execute --yes`. Add `--delete-user` to also remove profile. |
| `npm run db:purge-legacy` | Backend (`backend/scripts/purge-legacy.ts`) | Purges legacy test accounts (`guest_*`, `usr_*`, `demo_*`, `default_user_101`). Dry run by default; use `--execute --yes`. |
| `npm run db:push` | Backend (`drizzle-kit push`) | Applies Drizzle relational schema changes directly to the target database. |
| `npm run clean:cache` | Root tooling (`scripts/clean-cache.mjs`) | Clears `.vite`, `.next`, and build caches across the monorepo. |

> 💡 **Escape Hatch:** If you want to bypass database setup verification during `npm run dev` (e.g. in CI or custom environments), run:
> ```bash
> DB_SETUP_SKIP=true npm run dev
> ```

---

## ⚠️ Troubleshooting Guide

| Error / Symptom | Root Cause | Solution |
| :--- | :--- | :--- |
| `password authentication failed for user "postgres"` (HTTP 500) | `SQL_PASSWORD` or `SQL_ADMIN_PASSWORD` in `.env` is incorrect or contains placeholder text (`YOUR_...`). | Update `.env` with your actual PostgreSQL password. Run `npm run db:setup` to confirm credentials. |
| `relation "finance_transactions" does not exist` (HTTP 500) | Database exists but schema tables have not been created yet. | Run `npm run db:setup` to push all 8 schema tables without dropping data. |
| `connect ECONNREFUSED 127.0.0.1:5432` | PostgreSQL service is stopped or port `5432` is not reachable. | Start your PostgreSQL service (`Start-Service postgresql*` on Windows, `brew services start postgresql@16` on Mac, or `docker compose up -d`). |
| `'tsx' is not recognized as an internal or external command` | `npm install` has not been run. | Run `npm install` in your terminal, then rerun `npm run dev`. |
| PowerShell: `running scripts is disabled on this system` | Windows execution policy restriction. | Run `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned` in PowerShell. |

---

## 📜 License
Apache-2.0 License.
