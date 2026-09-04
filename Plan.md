# WAF Bot: Real-Time Inflation & Currency Economic System Plan

## 1. Overview

This document outlines the high-level plan for building a dynamic economic system for the **waf** bot.

**Related Documents:**

- [System Design & Code Examples](./Design/system_design.md)
- [UI/UX & WhatsApp Commands](./Design/ui_ux_design.md)

The system will accurately derive inflation and currency values using real-world data, specifically tracking the USD to IDR ($1 = ? IDR) exchange rate. It will leverage a free exchange rate API for data ingestion and a free LLM for analyzing economic trends and applying them to the waf bot's economy.

## 2. Core Components

### 2.1. Real-World Data Source (Free API via Axios)

To fetch the current USD/IDR exchange rate and historical data, we will use a free API fetched using the bot's existing `axios` dependency.

- **Recommended APIs:**
    - **ExchangeRate-API (Free Tier):** Provides reliable daily updates for currency pairs including USD/IDR.
    - **Frankfurter API:** Open-source and free, though primarily tracks ECB rates, it can be used for various currency pairs.
- **Data Points Needed:** Current USD/IDR rate, 30-day historical trend for inflation calculation.

### 2.2. AI Analysis (Groq SDK)

Since the `waf` bot already utilizes the `groq-sdk`, we will use Groq (running a free-tier Llama 3 or similar model) to analyze the raw exchange rate data and translate it into meaningful economic adjustments.

- **Function:** The LLM will take the recent IDR rate fluctuations and output a structured JSON response adjusting the waf bot's in-game item prices, loot drop values, and overall inflation multiplier.

### 2.3. Global Update Messaging System (Baileys)

A broadcast module to announce economic changes via the bot's WhatsApp messaging client (`@whiskeysockets/baileys`).

- **Whitelist System:** A database table (managed via Prisma) specifying which WhatsApp groups are authorized to receive global economic updates.
- **Notification Formatting:** The bot formats the AI's output into a readable global message (e.g., "📉 **Market Update:** The IDR has fluctuated. Inflation multiplier is now **1.02x**. Item prices have been adjusted accordingly!").

## 3. System Architecture

1.  **Data Ingestion Cron Job:** A scheduled task utilizing the existing `node-cron` package (e.g., every 24 hours) fetches the latest USD to IDR exchange rate.
2.  **Data Storage & Persistence:** Store the fetched rate in the bot's **existing** SQLite database utilizing `Prisma` and `better-sqlite3`. No duplicate database will be created; all new models (`ExchangeRateLog`, `EconomyMultiplier`) will be appended directly to the current schema and use the main database file. Implement periodic automated backups of this main `.db` file to prevent data loss.
3.  **AI Processing:**
    - The bot compiles the last 7-30 days of exchange rates from the Prisma database.
    - Sends a prompt via `groq-sdk`: _"Here is the USD/IDR exchange rate for the past week: [Data]. Calculate the short-term inflation rate and suggest a price multiplier for virtual goods."_
4.  **Economic Update:** The LLM returns a multiplier (e.g., `1.02` for 2% inflation). The waf bot applies this multiplier to the virtual economy's pricing tables in the Prisma database.
5.  **Global Broadcast:** Upon successfully updating the economy, the bot iterates through the whitelisted groups stored in the database and dispatches a formatted message detailing the current inflation rate. **Note:** If the LLM determines the multiplier hasn't changed from the previous day, the bot will silently abort the broadcast to prevent spamming groups.

## 4. Implementation Steps

- **Phase 1: Setup & API Integration**
    - Register for the free currency API and obtain an API key.
    - Write the data fetching module using `axios` to retrieve the `$1 = ? IDR` rate within the `src/` directory.
- **Phase 2: Database & Logging (Prisma)**
    - Update the `prisma/schema.prisma` to include models for `ExchangeRateLog` and `EconomyMultiplier` (utilizing the existing `WhitelistedGroup` model for broadcasts).
    - Run `npx prisma db push` or `npx prisma migrate dev` to apply changes to the SQLite database.
    - **Data Permanence:** The existing `src/utils/backup.ts` system already backs up the SQLite `.db` file daily to Telegram, ensuring historical economic data and whitelists are safe out-of-the-box without needing a new script.
- **Phase 3: LLM Integration (Groq)**
    - Implement an analysis function using the existing `groq-sdk`.
    - Design the system prompt to enforce a strict JSON schema for the AI's response.
- **Phase 4: Bot Economy Application & Commands**
    - Create a mechanism to update the waf bot's internal item prices based on the Groq output.
    - Implement user and admin commands (`.market`, `.forceupdate`) as `ToolModule` exports in `src/tools/`, conforming strictly to the `ToolContext` architecture of the `waf` framework.
- **Phase 5: Messaging & Broadcast System**
    - Implement the global broadcast function using Baileys to send formatted WhatsApp updates to groups listed in the `WhitelistedGroup` table.
- **Phase 6: Testing & Tuning**
    - Simulate various real-world economic scenarios using `node-cron` triggers and observe how the waf bot's economy reacts. Adjust the AI prompt as necessary to prevent hyperinflation.
