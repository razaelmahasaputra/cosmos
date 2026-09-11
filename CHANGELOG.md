# Changelog

All notable changes to the **Cosmos WhatsApp Bot Framework** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

---

## [1.1.0] - 2026-09-11

### Added

- **AI-Underwritten Bank Loan System (`src/services/loanService.ts`, `src/tools/loan.ts`):**
    - AI Credit Risk Underwriting using Groq LLM Native Function Calling (`evaluate_loan_application`) with deterministic offline fallback.
    - Dynamic Credit Scoring algorithm (clamped strictly 0–1000) evaluating 30-day activity logs (`LOAN_REPAYMENT`, `LOAN_DEFAULT`, `CASINO_LOSS`, `CASINO_WIN`, `REAL_ESTATE_PURCHASE`, and Net Worth).
    - 4 Dynamic Credit Tiers: `Poor` (denied), `Fair` (up to Rp15.000.000), `Good` (up to Rp50.000.000), and `Excellent` (up to Rp100.000.000).
    - ACID double-entry disbursement directly into `BankAccount` ledger and repayment support with credit score rehabilitation.
- **Automated Default Penalties & Asset Liquidation:**
    - Automatic account freezing (`status = 'FROZEN'`) upon overdue loan default.
    - Selective asset seizure algorithm (`seizeUserAssetsForDebt`) liquidating owned inventory items and real estate properties (`PropertyCatalog`) ranked by highest value first until debt is satisfied.
    - Status transition to `'Pawned'`, preventing seized assets from being listed in `.inventory` or sold via `.sell`.
    - Automatic account unfreezing once debt is recovered.
- **Scheduled Background Workers & Cron:**
    - Automated 5-day repayment reminder worker (`processLoanReminders`).
    - Hourly background cron (`startLoanSchedulerCron`) checking for defaults and reminders.
- **Multi-Layer Race Condition & Concurrency Defense:**
    - In-flight memory mutexes (`activeAssessments`, `activeDisbursements`, `activeRepayments`) preventing duplicate concurrent API triggers.
    - Strict re-verification inside `prisma.$transaction(async (tx) => ...)` to serialize write transactions and reject parallel disbursements or balance overdrafts.
    - Instant session consumption on `confirm` to prevent re-entrant approvals.
- **Command Interfaces & Interactive Cancellation:**
    - `.loan apply <amount> [collateral]` with 3-minute interactive confirmation window.
    - `.loan pay [amount]` for partial or full repayments.
    - `.loan status` displaying active loan status, principal, interest, due date, and days remaining.
    - `.loan info` displaying credit score, reputation tier, net worth breakdown, and borrow limit.
    - Full integration with global cancellation manager (`.cancel`, `cancel`, `batal`).
- **Database Models (`prisma/schema.prisma`):**
    - `Loan`: Tracks principal, interest rate, due date, status (`ACTIVE`, `PAID`, `DEFAULTED`), and collateral.
    - `ActivityLog`: Comprehensive financial event history.
    - `LoanReminder`: Persistent queue for scheduled 5-day notifications.
    - Added `creditScore` to `User` and `status` (`ACTIVE`, `FROZEN`, `SUSPENDED`) to `BankAccount`.
- **Developer Documentation & Agent Skills:**
    - Added dedicated skill in `.agents/skills/bank-loan-system/SKILL.md`.
    - Added Rule Q to `AGENTS.md`.
    - Complete 10-suite unit test coverage in `tests/loan.test.ts`.

### Fixed

- Fixed race condition vulnerability allowing concurrent double-borrowing when multiple disbursement calls were issued in parallel.
- Fixed potential account balance overdrafts by validating balances directly inside database transactions.

---

## [1.0.0] - 2026-09-06

### Added

- **Cosmos Central Bank (CCB) Subsystem (`src/services/bankService.ts`, `src/tools/bank.ts`):**
    - ACID double-entry ledger tracking `BankAccount` and immutable `BankTransaction` audit records with `balanceAfter`.
    - Account registration gate requiring verified Virtual ID Card (`IdCard` / KTP).
    - Deposit (`.bank deposit`), withdrawal (`.bank withdraw`), and interactive transfers (`.bank transfer`).
    - 3-minute interactive transfer confirmation flow with `.cancel` support.
    - Daily transfer limit tracking (default Rp50.000.000) reset daily.
    - Daily compound interest distribution (0.1% per day for balances >= Rp100.000).
- **Virtual Identity Card System (`src/utils/idCard.ts`, `src/tools/idcard.ts`):**
    - Dynamic 16-digit NIK generation and identity card verification.
    - Canvas / Sharp image generation for realistic KTP card previews.
- **Real Estate & Property Catalog (`src/tools/property_buy.ts`, `src/tools/property_sell.ts`, `src/tools/property_inventory.ts`):**
    - Purchasing and owning properties from `PropertyCatalog`.
    - AI broker negotiation system via Groq LLM for pawning/selling properties.
    - Deterministic catalog ordering and inventory asset valuation.
- **Multilingual Localization & Internationalization (i18n):**
    - Full English (`en`) and Indonesian (`id`) locale files across all tools and messages.
    - Build script asset synchronization (`scripts/copy-locales.ts`).
- **Standardized Currency Formatting:**
    - Indonesian Rupiah standard (`formatRupiah`, `parseCurrencyAmount` in `src/utils/currency.ts`).

### Changed

- Complete framework rebranding from WAF to **Cosmos WhatsApp Bot Framework**.
- Upgraded Groq model configuration to utilize dynamic `GROQ_MODEL` environment variable.
- Improved property selling syntax to support prefix matching and ID-based buying/selling.

### Fixed

- Fixed JID vs LID mismatch by deduplicating users and linking identifiers in user queries.
- Fixed currency parsing with decimal abbreviations (e.g., `1.5jt`, `500k`, `Rp10.000`).
- Downgraded `better-sqlite3` to fix build and compilation issues on Node.js 24 environments.

---

## [0.9.0] - 2026-08-15 (Beta)

### Added

- Initial Baileys v7 integration for WhatsApp Web API.
- Casino minigames: Buckshot Roulette, Slot machine, Dice.
- Media handling: sticker maker, YouTube downloader, TikTok downloader, Pinterest downloader.
- Speech-to-text integration using Groq Whisper.
- Auto-sticker and auto-downloading features.
- SQLite persistence with Prisma ORM.

---

## Source Code Architecture

Below is the directory architecture of the Cosmos WhatsApp Bot codebase:

```text
cosmos/
├── .agents/skills/            # Agent guidelines and specialized engineering skills
│   ├── bank-loan-system/      # Bank loan system underwriting, credit & seizure rules
│   ├── cosmos-central-bank/   # CCB double-entry ledger & transfer rules
│   ├── global-cancellation/   # Cancellation manager standards (.cancel)
│   └── ...
├── prisma/
│   └── schema.prisma          # Database schema (User, BankAccount, Loan, etc.)
├── scripts/
│   └── copy-locales.ts        # Locale synchronization during compilation
├── src/
│   ├── generated/             # Generated Prisma client
│   ├── handlers/
│   │   └── message.ts         # High-level message router & command dispatcher
│   ├── locales/               # Multilingual JSON dictionary (en, id)
│   ├── services/
│   │   ├── bankService.ts     # Central Bank transactions, limits & interest
│   │   ├── loanService.ts     # Loan underwriting, credit score & asset seizure
│   │   └── shopService.ts     # Item store and purchasing service
│   ├── tools/
│   │   ├── bank.ts            # .bank command handler
│   │   ├── loan.ts            # .loan command handler
│   │   ├── property_buy.ts    # .buy property handler
│   │   ├── property_sell.ts   # .sell / .pawn property handler
│   │   └── ...
│   ├── utils/
│   │   ├── cancellationManager.ts # Global .cancel interactive registry
│   │   ├── casino.ts          # JID/LID matching & mention formatting
│   │   ├── currency.ts        # Indonesian Rupiah formatting & parsing
│   │   └── idCard.ts          # Virtual ID Card / KTP verification
│   └── index.ts               # Application entrypoint & cron scheduler startup
├── tests/
│   ├── bank.test.ts           # Central Bank test suite (9 tests)
│   └── loan.test.ts           # Bank Loan System test suite (10 tests)
├── AGENTS.md                  # Mandatory AI Agent rules and regulations
└── package.json               # NPM workspace scripts and dependencies
```

---

## Core Data Models

```prisma
model User {
  id             String    @id // WA JID (e.g. 628123456789@s.whatsapp.net)
  lid            String?   @unique // WhatsApp Local Identifier (LID)
  pushName       String?
  balance        BigInt    @default(10000)
  creditScore    Int       @default(500)
  bankAccount    BankAccount?
  loans          Loan[]
  activities     ActivityLog[]
  inventories    UserInventory[]
}

model BankAccount {
  accountNumber String   @id
  userJid       String   @unique
  balance       BigInt   @default(0)
  status        String   @default("ACTIVE") // ACTIVE, FROZEN, SUSPENDED
  transactions  BankTransaction[]
}

model Loan {
  id              String         @id @default(uuid())
  userId          String
  principalAmount BigInt
  interestRate    Float
  dueDate         DateTime
  status          String         @default("ACTIVE") // ACTIVE, PAID, DEFAULTED
  collateralItems String?
  reminders       LoanReminder[]
}
```
