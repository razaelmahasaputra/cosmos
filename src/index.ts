import dns from 'dns';
import dotenv from 'dotenv';
import { loadAutoDlSettings } from '#/utils/autodl.js';
import toolsHandler from '#/tools/handler.js';

import { startAutoBackup } from '#/utils/backup.js';
import { connectToWhatsApp } from '#/utils/connectionManager.js';
import { getTelegramClient, isTelegramConfigured } from '#/utils/telegramClient.js';

dns.setDefaultResultOrder('ipv4first');

dotenv.config();

// Start auto backup (on startup and daily at 00:00 WIB)
startAutoBackup();

async function startSystem(): Promise<void> {
    await toolsHandler.loadTools();
    await loadAutoDlSettings();

    // Connect the Telegram dummy account in the background when it has been paired,
    // so private group content can be proxied.
    if (isTelegramConfigured()) {
        getTelegramClient()
            .then(() => console.log('[System] Telegram dummy account ready for private media proxying.'))
            .catch((err) => console.error('[System] Telegram dummy account failed to connect:', err));
    } else {
        console.log('[System] Telegram dummy account is not configured; private content proxying is disabled.');
    }

    // Connect default bot
    connectToWhatsApp({
        sessionId: 'default'
    });
}

startSystem();
