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

### 9. Authentication & User Management
* **Dual-Mode System**:
  * **Email & Password**: Registration with password strength checks, confirmation, and password reset.
  * **1-Click Instant Demo Login**: Frictionless authentication designed for iframe preview environments without popup blockers.
  * **Google Sign-In**: Firebase OAuth with mutex guards preventing popup concurrency assertion errors.

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
* **Auth**: Firebase Authentication (Email/Password, Google OAuth, Local Session).

---

## 📁 Repository Structure

```
├── server.ts                       # Express backend API & Gemini proxy
├── src/
│   ├── App.tsx                     # Main application entry point
│   ├── main.tsx                    # React DOM client mount
│   ├── components/
│   │   ├── AuthView.tsx            # Login, Registration & Demo user management
│   │   ├── assistant/              # Floating AI Assistant widget & block renderers
│   │   ├── DashboardView.tsx       # Central KPI analytics & charts
│   │   ├── FinanceView.tsx         # Financial transactions ledger (₹ INR)
│   │   ├── ForecastingView.tsx     # 1,200-record ML regression & projections
│   │   ├── GoalsView.tsx           # SMART goal roadmaps & milestones
│   │   ├── HabitsView.tsx          # 7-day interactive consistency matrix
│   │   ├── Navbar.tsx              # Navigation bar & user account status
│   │   ├── QuickLogModal.tsx       # Rapid multi-module entry modal
│   │   ├── SimulationView.tsx      # What-If decision sliders & risk score
│   │   └── StudyView.tsx           # Cognitive learning sessions tracker
│   ├── context/
│   │   └── AuthContext.tsx         # Firebase Auth & Demo session provider
│   ├── db/
│   │   ├── index.ts                # PostgreSQL connection pool
│   │   ├── schema.ts               # Drizzle relational schema definitions
│   │   └── users.ts                # User synchronization helpers
│   └── types/
│       └── index.ts                # TypeScript domain models
├── scripts/
│   └── ml_forecasting.py           # Python 3 ML ridge regression engine
└── package.json
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

## 🛠️ Database Management Scripts

| Command | Script | Purpose |
| :--- | :--- | :--- |
| `npm run db:setup` | `tsx scripts/setup-db.ts` | **Idempotent, non-destructive bootstrap.** Creates database if missing and pushes schema tables if absent. Never drops or alters populated tables. |
| `npm run db:check` | `tsx scripts/check-db.ts` | **Read-only audit.** Inspects connection, verifies the presence of all 8 tables, and displays live row counts. |
| `npm run db:push` | `drizzle-kit push` | **Manual schema push.** Applies Drizzle schema changes directly to the target database. |
| `npm test` | Node test runner | Runs all unit and pure health-shaping tests across `src/**/*.test.ts` and `scripts/**/*.test.ts`. |

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
