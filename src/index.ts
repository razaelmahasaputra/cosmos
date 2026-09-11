import dns from 'dns';
import dotenv from 'dotenv';
import { loadAutoDlSettings } from '#utils/autodl.js';
import toolsHandler from '#tools/handler.js';

import { startAutoBackup } from '#utils/backup.js';
import { startBankInterestCron } from '#services/bankService.js';
import { connectToWhatsApp } from '#utils/connectionManager.js';
import { getTelegramClient, isTelegramConfigured } from '#utils/telegramClient.js';
import { seedItems } from '#seed_item.js';
import { prisma } from '#db.js';

dns.setDefaultResultOrder('ipv4first');

dotenv.config();

// Start auto backup (on startup and daily at 00:00 WIB)
startAutoBackup();

// Start scheduled daily bank interest distribution (daily at 00:00 WIB)
startBankInterestCron();

async function startSystem(): Promise<void> {
    await toolsHandler.loadTools();
    await loadAutoDlSettings();

    // Ensure initial shop items are seeded if not present
    try {
        const itemCount = await prisma.item.count();
        if (itemCount === 0) {
            console.log('[System] Initializing shop items in database...');
            await seedItems();
        }
    } catch (err) {
        console.error('[System] Error checking/seeding shop items:', err);
    }

    // Connect the Telegram dummy account in the background when it has been paired,
    // so private group content can be proxied.
    if (isTelegramConfigured()) {
        getTelegramClient()
            .then(() => console.log('[System] Telegram dummy account ready for private media proxying.'))
            .catch((err) => console.error('[System] Telegram dummy account failed to connect:', err));
    } else {
        console.log('[System] Telegram dummy account is not configured; private content proxying is disabled.');
    }

    const phoneNumber = process.env.BOT_PHONE_NUMBER;
    if (!phoneNumber) {
        console.error('BOT_PHONE_NUMBER is not set in .env');
        process.exit(1);
    }

    // Connect default bot
    connectToWhatsApp({
        sessionId: 'default',
        phoneNumber
    });
}

startSystem();
