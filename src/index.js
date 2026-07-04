import './logger.js';
import { makeWASocket, useMultiFileAuthState, Browsers, DisconnectReason } from '@whiskeysockets/baileys';
import pino from 'pino';
import dotenv from 'dotenv';
import { handleMessage } from './handlers/message.js';

dotenv.config();

const logger = pino({ level: 'silent' });

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger,
        browser: ['Ubuntu', 'Chrome', '20.0.04'],
        syncFullHistory: false,
        generateHighQualityLinkPreview: true
    });

    if (!sock.authState.creds.registered) {
        const phoneNumber = process.env.BOT_PHONE_NUMBER;
        if (!phoneNumber) {
            console.error('BOT_PHONE_NUMBER is not set in .env');
            process.exit(1);
        }
        console.log(`Requesting pairing code for ${phoneNumber}...`);
        setTimeout(async () => {
            try {
                const code = await sock.requestPairingCode(phoneNumber);
                console.log(`Pairing code: ${code}`);
            } catch (err) {
                console.error('Failed to request pairing code:', err);
            }
        }, 3000);
    }

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Connection closed due to', lastDisconnect.error, ', reconnecting', shouldReconnect);
            if (shouldReconnect) connectToWhatsApp();
        } else if (connection === 'open') {
            console.log('Opened connection');
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        for (const msg of messages) {
            try {
                await handleMessage(sock, msg);
            } catch (error) {
                console.error('Error handling message:', error);
            }
        }
    });
}

import { execSync } from 'child_process';
try {
    console.log('Mencoba update dari Github...');
    // Mengatasi error 'dubious ownership' di Pterodactyl docker
    execSync('git config --global --add safe.directory "*"', { stdio: 'inherit' });
    
    // Mendukung private repo jika GITHUB_TOKEN diset di .env
    const token = process.env.GITHUB_TOKEN;
    const repoUrl = token 
        ? `https://${token}@github.com/razaeldotexe/waf.git`
        : 'https://github.com/razaeldotexe/waf.git';

    execSync(`git fetch ${repoUrl} main`, { stdio: 'inherit' });
    execSync('git reset --hard FETCH_HEAD', { stdio: 'inherit' });
    console.log('Update dari Github berhasil.');
} catch (err) {
    const safeErrorMsg = err.message.replace(/https:\/\/(.*?)@github\.com/g, 'https://***@github.com');
    console.error('Gagal melakukan update dari Github, melanjutkan startup...', safeErrorMsg);
}

connectToWhatsApp();
