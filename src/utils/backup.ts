import fs from 'fs';
import path from 'path';
import axios from 'axios';
import FormData from 'form-data';

export async function sendBackupToTelegram(): Promise<void> {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
        console.warn('[Backup] TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is missing. Skipping auto-backup.');
        return;
    }

    const dbPath = path.resolve(process.cwd(), 'storage/database.sqlite');
    if (!fs.existsSync(dbPath)) {
        console.warn('[Backup] SQLite database file not found. Skipping backup.');
        return;
    }

    try {
        const form = new FormData();
        form.append('chat_id', chatId);
        form.append('document', fs.createReadStream(dbPath));
        form.append('caption', `Database Backup - ${new Date().toISOString()}`);

        console.log('[Backup] Sending database backup to Telegram...');
        const url = `https://api.telegram.org/bot${token}/sendDocument`;
        await axios.post(url, form, {
            headers: form.getHeaders(),
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
        });
        console.log('[Backup] Database backup sent successfully to Telegram.');
    } catch (err: any) {
        console.error('[Backup] Failed to send database backup to Telegram:', err.response?.data || err.message);
    }
}

export function startAutoBackup(intervalMs: number = 86400000): void {
    // 86400000 ms = 24 hours
    setInterval(() => {
        sendBackupToTelegram();
    }, intervalMs);
    console.log(`[Backup] Auto-backup started. Interval: ${intervalMs / 1000 / 60 / 60} hours.`);
}
