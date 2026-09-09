# Feature Plan: Job and Salary System

## Overview
Introduce a new Job/Work system that provides users with an alternative, non-gambling method to earn money (balance) in Cosmos. Users can choose from various jobs and receive a salary that fluctuates dynamically based on real-world IDR exchange rates or the current `EconomyMultiplier`.

## 1. Database Schema Updates (`prisma/schema.prisma`)
To support a growing list of jobs dynamically without needing code deployments, we will create a `JobCatalog` model and link it to the `User` model:

```prisma
model JobCatalog {
  id              Int     @id @default(autoincrement())
  name            String  @unique // e.g., 'Mining', 'Office Work'
  description     String
  baseSalary      BigInt  // Base payout before economy multiplier
  cooldownMinutes Int     @default(60)
  requiredItemId  String? // Links to an Item.id (e.g., Pickaxe, MacBook)
  isActive        Boolean @default(true)

  workers         User[]
}

model User {
  // ... existing fields ...
  currentJobId   Int?        // Foreign key to JobCatalog.id
  currentJob     JobCatalog? @relation(fields: [currentJobId], references: [id], onDelete: SetNull)
  lastWorkedAt   DateTime?   // Cooldown tracker for the .work command
}
```

## 2. Job Catalog & Characteristics
We will define a configuration for the available jobs. Each job can have a different base salary and cooldown (or they can share a unified cooldown with varying risks/rewards).

> **Global Requirement**: All jobs strictly require the user to have a registered virtual **ID Card** (`IdCard` in the database). Users without a virtual ID card will not be able to apply or work.

### Proposed Jobs & Salary Structure:
*Note: The base salaries below are listed at their standard rate. Payouts will fluctuate dynamically based on the `EconomyMultiplier`.*

- **Mining**: Structured as **Daily Shifts** (Monthly salary / 30).
  - **Coal Miner**: Rp7.000.000/month (~Rp233.333/day).
  - **Iron Miner**: Rp5.000.000/month (~Rp166.666/day).
  - **Gold Miner**: Rp10.000.000/month (~Rp333.333/day).
  - **Diamond Miner**: Rp20.000.000/month (~Rp666.666/day).
  - *Details*: Requires a Pickaxe (from `UserInventory`). You can mine different locations (e.g., Coal Mine, Diamond Cave) to find ores with varying base values. High risk/variance.
- **Office Work**: Rp7.500.000/month.
  - *Pay Structure*: **Daily Shift** (~Rp250.000/day). Stable income.
  - *Requirements*: Owning a **MacBook** in `UserInventory`.
- **Taxi Driving**: Rp4.000.000/month.
  - *Pay Structure*: **Daily Shift** (~Rp133.333/day).
  - *Requirements*: A **Driver's License**.
- **Cooking**: Rp4.500.000/month.
  - *Pay Structure*: **Daily Shift** (~Rp150.000/day).
- **Gojek**: Rp1.800.000/month.
  - *Pay Structure*: **Hourly / Gig-based** (~Rp2.500/hour or ~Rp60.000/day). Unlike other jobs, Gojek operates on the gig economy. Users will have a much shorter cooldown (e.g., 1 hour) allowing frequent, smaller `.work` claims to simulate individual deliveries.
- **Entrepreneurship**: Rp5.000.000/month.
  - *Pay Structure*: **Weekly Dividends** (~Rp1.250.000/week). Business revenue is calculated and paid out on a weekly cooldown to simulate natural sales cycles and business operations.
  - *Requirements*: Initial investment (deduct balance) **AND** owning a **MacBook or iPhone** in `UserInventory`. Very high potential return but includes a chance to fail or incur losses.

## 3. Dynamic Salary Calculation (IDR Exchange Rate Integration)
The salary for each job will not be static. It will be influenced by the macroeconomic state of the bot.
- **Exchange Rate Influence**: We can read the latest exchange rate from the `ExchangeRateLog` table (populated by `eodhd` API in `services/inflation.ts`).
- **Formula**: `Final Salary = Base Salary * EconomyMultiplier`.
  If the `EconomyMultiplier` is updated by the AI based on the `USDIDR` rate, the salaries will automatically adjust to simulate inflation or deflation.
- *Alternative*: Define base salaries in USD and convert to IDR using the latest `ExchangeRateLog.rate` on the fly.

## 4. Commands to Implement
- **`.job list`**: Displays the list of available jobs, their base salaries, and cooldowns.
- **`.job join <JobName|JobID>`**: Allows a user to apply for or switch to a specific job. The command supports numeric job IDs (e.g., `.job join 1` for Mining) as well as the job name. (May include a cooldown for switching jobs).
- **`.work`**: The primary command to earn a salary.
  - Checks if `lastWorkedAt` is past the cooldown period.
  - Calculates dynamic payout based on the current exchange rate / inflation multiplier.
  - Updates user `balance` and `lastWorkedAt`.
  - Replies with a formalized message detailing the work done and the payout.

## 5. Development Guidelines & Rules to Follow
- **Currency Formatting**: All salary outputs **MUST** use the `formatRupiah` utility from `src/utils/currency.ts` to maintain the standard `Rp` format (e.g., `Rp50.000`).
- **Language**: All output strings and bot responses **MUST** be in **Formal English** (e.g., "You have successfully completed your shift as a Taxi Driver and earned Rp50.000.").
- **Persistency**: Changes to the user's balance and job status must be saved using the `prisma` client.

## 6. Implementation Steps
1. Modify `schema.prisma` and run `pnpm prisma db push` or `pnpm prisma migrate dev` (depending on the environment).
2. Create a new service file (e.g., `src/services/jobs.ts`) to store job definitions and the dynamic payout logic.
3. Add the command handlers for `.job` and `.work` in the appropriate command router.
4. Test the `.work` command to ensure the cooldown logic and currency formatting work correctly.
5. Verify the code using `pnpm typecheck`, `pnpm lint`, and `pnpm format`.

