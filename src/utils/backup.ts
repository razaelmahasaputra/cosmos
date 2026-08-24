import fs from 'fs';
import path from 'path';
import axios from 'axios';
import FormData from 'form-data';
import cron from 'node-cron';

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
            maxBodyLength: Infinity
        });
        console.log('[Backup] Database backup sent successfully to Telegram.');
    } catch (err: any) {
        console.error('[Backup] Failed to send database backup to Telegram:', err.response?.data || err.message);
    }
}

/**
 * Sends a text notification through the same Telegram bot used for database
 * backups. Returns true only when the message was delivered successfully.
 */
export async function sendTelegramBotNotification(text: string): Promise<boolean> {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
        console.warn('[Backup] TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is missing. Skipping Telegram notification.');
        return false;
    }

    try {
        await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
            chat_id: chatId,
            text,
            parse_mode: 'HTML',
            disable_web_page_preview: true
        });
        return true;
    } catch (err: any) {
        console.error('[Backup] Failed to send Telegram notification:', err.response?.data || err.message);
        return false;
    }
}

export function startAutoBackup(): void {
    // Jalankan backup sekali saat bot baru mulai
    sendBackupToTelegram();

    // Jadwalkan backup setiap jam 00:00 WIB (Asia/Jakarta)
    cron.schedule(
        '0 0 * * *',
        () => {
            sendBackupToTelegram();
        },
        {
            timezone: 'Asia/Jakarta'
        }
    );

    console.log(`[Backup] Auto-backup started on startup and scheduled at 00:00 WIB daily.`);
}
