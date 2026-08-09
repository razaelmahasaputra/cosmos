// writeLog import removed
import dns from 'dns';
import dotenv from 'dotenv';
import toolsHandler from '#/tools/handler.js';

import { loadEnvFromSupabase } from '#/utils/cloudEnv.js';
import { startAutoBackup } from '#/utils/backup.js';
import { connectToWhatsApp } from '#/utils/connectionManager.js';
import { getAllSessionCategories } from '#/utils/prismaAuthState.js';

dns.setDefaultResultOrder('ipv4first');

dotenv.config();

// Start auto backup (on startup and daily at 00:00 WIB)
startAutoBackup();

async function startSystem(): Promise<void> {
    await toolsHandler.loadTools();
    await loadEnvFromSupabase();

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

    // Load and connect all existing sub-bots
    const categories = await getAllSessionCategories();
    for (const category of categories) {
        if (category.startsWith('subbot_')) {
            console.log(`[System] Initializing sub-bot session: ${category}`);
            // Provide a dummy number for reconnecting if it already has creds.
            // If it doesn't have creds (e.g. pending pairing), it needs the actual number.
            // But since it's saved in DB, it should already be registered.
            connectToWhatsApp({
                sessionId: category,
                // Optional: we can extract number from 'subbot_<number>'
                phoneNumber: category.replace('subbot_', '')
            });
        }
    }
}

startSystem();
