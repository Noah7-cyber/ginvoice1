
GInvoice: The Market OS for Nigerian Traders 🇳🇬
GInvoice is a specialized inventory management and invoicing application designed to streamline operations for Nigerian market traders, boutique owners, and retail shops. It bridges the gap between traditional bookkeeping and modern digital efficiency.

🚀 Key Features
Smart Invoicing: Generate professional digital receipts and invoices in seconds. Optimized for mobile sharing.

Inventory Tracking: Real-time stock monitoring with low-inventory alerts and bulk category management.

Nigerian Tax Compliance: Built-in calculation engine using the latest Nigeria Tax Act rules (Finance Acts). Automatically calculates VAT and taxable profit.

Compliance Shield: A unique dashboard widget that shows your business's tax health at a glance.

Dual-Role Security: Separate Owner and Staff PINs to ensure sensitive financial data remains private while enabling staff to process sales.

Offline-Ready (PWA): Works seamlessly on mobile devices even with spotty internet connections.

🛠 Tech Stack
Frontend: React, TypeScript, Tailwind CSS (Vite)

Backend: Node.js, Express, Mongoose

Database: MongoDB

PWA: Service Workers for offline capabilities and native-like mobile experience.

## Smart Stock Verification (Risk-based cycle counting)

This release adds low-noise micro-counting so users verify only a tiny high-value queue each day.

- **Queue defaults:** 3–8+ style micro-queues (practically capped by `maxQueuePerDay` with dynamic catalog sizing).
- **Daily-noise guardrails:** max one proactive verification notification per business per 24h, with **Start verification**, **Snooze 24h**, and **Dismiss** actions.
- **Risk factors:** age since last verify, sales velocity (7d), value proxy, manual stock edits, and prior variance.
- **Risk decay:** after verification, risk drops by `riskDecayOnVerify` so the same product is not repeatedly nagged.
- **Audit log:** every verification is append-only and records expected qty, counted qty, variance, reason, riskBefore/riskAfter, and who verified.

### Stock verification settings knobs
Available under `business.settings.stockVerification` (all optional, backward compatible):

- `enabled` (default `true`)
- `maxQueuePerDay` (default `5`)
- `minDaysBetweenPrompts` (default `1`)
- `verifyCooldownHours` (default `24`)
- `ageHalfLifeDays` (default `14`)
- `velocityWindowDays` (default `7`)
- `riskDecayOnVerify` (default `0.6`)
- `highVarianceBoost` (default `15`)
- `riskThreshold` (default `35`)
- `snoozeUntil`, `lastNotificationAt`
