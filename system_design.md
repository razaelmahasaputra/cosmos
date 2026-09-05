# System Design & Code Examples

**Related Documents:**

- [High-Level Plan](../README.md)
- [UI/UX & WhatsApp Commands](./ui_ux_design.md)

This document outlines the technical design, database schemas, and code examples for the WAF Bot's real-time inflation system.

## 1. Database Schema (Prisma)

_Note: All new models below are to be appended to the **existing** `prisma/schema.prisma` file in the `waf` bot. We will use the existing SQLite `.db` file; **no duplicate database** will be created._

```prisma
// prisma/schema.prisma

model ExchangeRateLog {
  id        Int      @id @default(autoincrement())
  rate      Float    // Example: 15500.50 (USD to IDR) - stored as float, displayed as Rp15.500
  source    String   // e.g., "EODHD"
  createdAt DateTime @default(now())
}

model EconomyMultiplier {
  id         Int      @id @default(autoincrement())
  multiplier Float    // Example: 1.02 (2% inflation)
  reasoning  String?  // AI's reasoning for this change
  appliedAt  DateTime @default(now())
}

// Existing model in waf
model WhitelistedGroup {
  jid String @id
}
```

## 2. Cron Job & API Fetching (Node.js)

```typescript
// src/services/inflation.ts
import cron from 'node-cron';
import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Run every day at 00:00 (Midnight)
cron.schedule('0 0 * * *', async () => {
    try {
        console.log('Fetching daily exchange rate...');

        // 1. Fetch data
        const apiKey = process.env.EODHD_API_KEY;
        const response = await axios.get(`https://eodhd.com/api/real-time/USDIDR.FOREX?api_token=${apiKey}&fmt=json`);
        const idrRate = response.data.close;

        // 2. Save to database for persistence
        await prisma.exchangeRateLog.create({
            data: {
                rate: idrRate,
                source: 'EODHD'
            }
        });

        // 3. Trigger AI Analysis
        await analyzeEconomyWithAI(idrRate);
    } catch (error) {
        console.error('Failed to update inflation data:', error);
    }
});
```

## 3. AI Analysis Integration (Groq)

```typescript
// src/services/ai.ts
import Groq from 'groq-sdk';
import { PrismaClient } from '@prisma/client';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const prisma = new PrismaClient();

export async function analyzeEconomyWithAI(currentRate: number) {
    // 1. Fetch last 7 days of rates
    const recentRates = await prisma.exchangeRateLog.findMany({
        take: 7,
        orderBy: { createdAt: 'desc' }
    });

    const ratesList = recentRates.map((r) => r.rate).join(', ');

    // 2. Prompt Groq LLM
    const completion = await groq.chat.completions.create({
        messages: [
            {
                role: 'system',
                content: 'You are an economic AI for a bot. Output ONLY valid JSON.'
            },
            {
                role: 'user',
                content: `Recent USD to IDR rates: ${ratesList}. Current rate: ${currentRate}. Calculate the inflation multiplier and provide a short reasoning.`
            }
        ],
        model: 'llama3-8b-8192',
        response_format: { type: 'json_object' }
    });

    const aiResponse = JSON.parse(completion.choices[0].message.content);

    // 3. Check if multiplier changed to avoid spamming
    const lastMultiplierData = await prisma.economyMultiplier.findFirst({
        orderBy: { appliedAt: 'desc' }
    });

    if (lastMultiplierData && lastMultiplierData.multiplier === aiResponse.multiplier) {
        console.log('Inflation multiplier unchanged. Skipping broadcast.');
        return; // Do not save duplicate or spam groups
    }

    // 4. Save new multiplier
    await prisma.economyMultiplier.create({
        data: {
            multiplier: aiResponse.multiplier,
            reasoning: aiResponse.reasoning
        }
    });

    // 5. Trigger Broadcast
    await broadcastEconomicUpdate(aiResponse.multiplier, aiResponse.reasoning, currentRate);
}
```

## 4. Broadcasting (Baileys)

```typescript
// src/services/broadcast.ts
import { WASocket } from '@whiskeysockets/baileys';
import { PrismaClient } from '@prisma/client';
import { formatRupiah } from '../utils/currency';

const prisma = new PrismaClient();

export async function broadcastEconomicUpdate(sock: WASocket, multiplier: number, reasoning: string, rate: number) {
    const groups = await prisma.whitelistedGroup.findMany();

    const message =
        `*🏦 Cosmos Central Bank Update*\n\n` +
        `*Current Exchange Rate:* $1 = ${formatRupiah(rate)}\n` +
        `*Market Trend:* 📉 AI Evaluated\n\n` +
        `*🔄 Economic Adjustments:*\n` +
        `• Global Inflation Multiplier: *${multiplier}x*\n` +
        `• Shop & Loot: ⬆️ *Adjusted proportionally*\n\n` +
        `_🤖 AI Analyst Note: "${reasoning}"_`;

    for (const group of groups) {
        await sock.sendMessage(group.jid, { text: message });
    }
}
```

## 5. Command Implementation (ToolModule Framework)

All user and admin commands must strictly adhere to the `waf` bot's tool registry architecture, implementing the `ToolModule` interface.

```typescript
// src/tools/market.ts
import { ToolModule, ToolContext } from './types.js';
import { prisma } from '../db.js';
import { formatRupiah } from '../utils/currency.js';

const marketTool: ToolModule = {
    definition: {
        name: 'market',
        aliases: ['economy'],
        description: 'Check the current state of the global economy and inflation.',
        category: 'Economy'
    },
    execute: async (args: Record<string, any>, ctx: ToolContext) => {
        const { msg, sock } = ctx;

        // Fetch latest multiplier
        const latestData = await prisma.economyMultiplier.findFirst({
            orderBy: { appliedAt: 'desc' }
        });

        if (!latestData) {
            await sock.sendMessage(
                msg.key.remoteJid!,
                { text: 'Economy data is currently unavailable.' },
                { quoted: msg }
            );
            return;
        }

        const text =
            `*📊 Current Market Status*\n\n` +
            `• *Multiplier:* ${latestData.multiplier}x\n` +
            `• *Last Updated:* ${latestData.appliedAt.toLocaleString()}\n\n` +
            `_Tip: Sell your loot now while inflation is high! 💰_`;

        await sock.sendMessage(msg.key.remoteJid!, { text }, { quoted: msg });
    }
};

export default marketTool;
```
