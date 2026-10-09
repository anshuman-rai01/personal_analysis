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
* **Python**: Version 3.10+ (optional, for custom ML script execution).

---

### 2. Step-by-Step Instructions

#### Step 1: Open Terminal in VS Code
Open VS Code, press ``Ctrl + ` `` (or go to **Terminal** > **New Terminal**).

#### Step 2: Install All Dependencies (Crucial First Step)
Before running the project, you must install the packages (`node_modules`):
```bash
npm install
```
> 💡 **Why this is required:** When downloading the project zip, `node_modules` is not included. Running `npm install` installs `tsx`, `express`, `react`, `drizzle-kit`, and all build tools.

#### Step 3: Run the Development Server
```bash
npm run dev
```

#### Step 4: Open in Your Browser
Once the server starts, open your browser and go to:
```
http://localhost:3000
```

---

### ⚠️ Common Troubleshooting on Windows

#### Issue A: `'tsx' is not recognized as an internal or external command`
* **Cause**: You ran `npm run dev` before running `npm install`.
* **Fix**: Simply run `npm install` in your terminal, wait for it to complete, and then run `npm run dev`.

#### Issue B: `drizzle.config.json file does not exist`
* **Fix**: A root `drizzle.config.ts` has been provided. If pushing database schema, simply run:
  ```bash
  npx drizzle-kit push
  ```

#### Issue C: PowerShell Execution Policy Restriction
* If PowerShell gives a script error like `running scripts is disabled on this system`:
  Run this in PowerShell:
  ```powershell
  Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
  ```
  Or run using Command Prompt (`cmd`) inside VS Code.

---

## 📜 License
Apache-2.0 License.
