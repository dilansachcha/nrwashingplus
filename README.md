# NRWashingPlus 🧺💻

A production-grade, multi-tenant Point of Sale (POS) and management system built for a multi-branch laundry business. This project balances complex relational database management with a lightning-fast retail workflow, designed entirely from the ground up.

---

## 🏗️ The Core Tech Stack

### Backend Architecture
* **Framework:** NestJS (Node.js ecosystem).
* **Pattern:** Modular REST API utilizing a strict separation of Controllers, Services, and Modules.
* **ORM:** Prisma. Chosen for strict type safety, reliable schema migrations, and handling complex relational queries.
* **Database Engine:** Relational Database (MySQL/PostgreSQL).

### Frontend Architecture
* **Framework:** Vanilla JavaScript SPA (Single Page Application). 
  * *Niche Detail:* Deliberately avoided heavy frameworks to maximize performance on low-end retail tablets. Built a custom reactive state-rendering system (`render()`, template literals) that mimics React’s component-driven architecture without the overhead.
* **Styling:** Tailwind CSS (Utility-first, mobile-responsive layouts without custom CSS files).
* **Assets:** Inline SVG icons generated dynamically via JavaScript functions to maintain a tiny bundle size.

### Authentication & Security
* **Standard:** Stateless JWT (JSON Web Tokens) via `@nestjs/jwt` and Passport.js.
* **Shift-Optimized Sessions:** Configured tokens to `expiresIn: '7d'`. This specific business decision prevents staff from being logged out mid-shift on shared retail tablets while maintaining cryptographic security.

---

## ☁️ Cloud Infrastructure & Cost Optimization

Instead of relying on expensive managed services, this application is deployed using a highly cost-optimized, self-managed AWS architecture.

* **The Server (AWS Lightsail):** Deployed on a Linux VPS. Deliberately selected the 1 vCPU / 1GB RAM / 40GB SSD tier. *Why not the base tier?* Running a Node backend, a relational database, and the OS simultaneously requires more than 512MB RAM to prevent out-of-memory crashes under retail load.
* **Network Reliability:** Chose the specific IPv4 bundle over cheaper IPv6 alternatives to guarantee 100% connectivity across older Sri Lankan ISP routers (SLT/Dialog) and mobile hot-spots used in the shops.
* **Self-Hosted Database Strategy:** Bypassed expensive managed database services (like AWS RDS at $15+/mo) by installing the database engine directly inside the same Linux instance, allowing ultra-fast `localhost` communication.
* **Disaster Recovery:** Enabled AWS Automatic Daily Snapshots to ensure the business never loses financial or customer data in the event of a critical hardware failure.

---

## ✨ Core Features & Business Logic

### 🛒 The Point of Sale (Counter Board)
* **Dynamic Order Codes:** Auto-generating sequential identifiers formatted for business clarity (e.g., `NR-A-YYMMDD-0001`).
* **Intelligent Auto-Fill:** A lookup function that triggers upon typing a phone number (`077...`), instantly fetching the customer’s name, address, and preferences to accelerate checkout.
* **Hardware Integration:** The search architecture is optimized to accept rapid inputs from external Barcode Scanners, allowing staff to scan a ticket and instantly open the order.

### 🧮 Dynamic Pricing Engine
* **Database-Driven Turnaround Times (TAT):** Transitioned from hardcoded pricing to a dynamic `ServiceType` schema.
* **Real-time Multipliers:** The system calculates final totals by applying custom multipliers (e.g., Normal = 1.0x, One-Day = 1.5x, Express = 1.85x) to base catalog items instantly.

### 👥 Customer Data Strategy ("Silent Reactivation")
* **The Problem:** Deleting customers breaks financial history; keeping thousands of inactive customers slows down the POS search.
* **The Solution:** Implemented an `isArchived` flag. Archiving hides the customer from the active UI. If that same phone number returns months later, the backend "silently reactivates" the profile, updating details without triggering "Duplicate Number" database crashes.

### 🔐 Role-Based Access Control (RBAC)
* **ADMIN:** Full system access. Can view 'All Branches' data, access financial dashboards, modify the item catalog, and alter service speeds.
* **STAFF:** Branch-locked. Can only view and create orders for their assigned branch. The UI dynamically disables dropdowns and hides Admin features based on the decoded JWT payload.

### 📊 Financial & Operational Dashboards
* **Live Revenue Tracking:** Aggregates `paidAmount` to show actual cash currently in the till.
* **Debt Collection Metric:** Calculates "Unpaid (Ready)"—revenue tied up in washed clothes awaiting customer pickup.
* **Bottleneck Analysis:** A visual Order Status chart highlighting workflow traffic (e.g., too many in WASHING, not enough READY).

---

## 🛠️ Niche UI/UX Details

* **Transaction Safety:** Utilized Prisma's `$transaction` blocks on the backend. When creating an order with 10 line items, the system ensures either *all* 10 items save successfully, or *none* do, preventing corrupted "half-orders" if a network drop occurs mid-save.
* **Responsive Grid Fixes:** Engineered the frontend using CSS Grid (`grid-cols-1 sm:grid-cols-2 lg:flex`) to ensure complex filter dropdowns (Date, Branch, Status, Paid) stack perfectly on portrait-oriented tablets without overlapping.
* **Centralized State UI:** Built a global state manager for the frontend that triggers unified error handling, success Toasts, and confirmation modals (e.g., *"Are you sure you want to Archive?"*) seamlessly across the SPA.
