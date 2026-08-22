import dns from 'dns';
import dotenv from 'dotenv';
import toolsHandler from '#/tools/handler.js';

import { startAutoBackup } from '#/utils/backup.js';
import { connectToWhatsApp } from '#/utils/connectionManager.js';

dns.setDefaultResultOrder('ipv4first');

dotenv.config();

// Start auto backup (on startup and daily at 00:00 WIB)
startAutoBackup();

async function startSystem(): Promise<void> {
    await toolsHandler.loadTools();

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
