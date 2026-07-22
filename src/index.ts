import { writeLog } from '#/logger.js';
import { execSync } from 'child_process';
import dns from 'dns';
import { makeWASocket, useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import pino from 'pino';
import dotenv from 'dotenv';
import { handleMessage } from '#/handlers/message.js';
import { cacheMessage, getCachedMessage } from '#/utils/messageCache.js';
import toolsHandler from '#/tools/handler.js';

dns.setDefaultResultOrder('ipv4first');

dotenv.config();

const logger = pino({ level: 'silent' });
let connectionOpenTimeSec = 0;

async function connectToWhatsApp(): Promise<void> {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: logger as any,
        browser: ['Ubuntu', 'Chrome', '20.0.04'],
        syncFullHistory: false,
        generateHighQualityLinkPreview: true,
        keepAliveIntervalMs: 15000,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        retryRequestDelayMs: 2000,
        maxMsgRetryCount: 15,
        markOnlineOnConnect: true,
        getMessage: async (key) => {
            console.log(
                `[getMessage] Request received for key ID: ${key.id}, remoteJid: ${key.remoteJid}, fromMe: ${key.fromMe}`
            );
            try {
                if (key.id) {
                    const cached = getCachedMessage(key.id);
                    if (cached) {
                        console.log(`[getMessage] Found in cache for key ID: ${key.id}`);
                        return cached;
                    }
                }
            } catch (err) {
                console.error('Error in getMessage config:', err);
            }
            return undefined;
        }
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
            const lastDisconnectError = lastDisconnect?.error as any;
            const errorCode = lastDisconnectError?.output?.statusCode || lastDisconnectError?.code;
            const errorMessage = lastDisconnectError?.message || 'Unknown Reason';
            const shouldReconnect = errorCode !== DisconnectReason.loggedOut;

            console.log(
                `[Connection] Closed (Reason: ${errorMessage}, Code: ${errorCode}). Reconnecting: ${shouldReconnect}`
            );

            connectionOpenTimeSec = 0;

            // Log details safely to file for debugging without cluttering console log
            if (lastDisconnect?.error) {
                writeLog('ERROR', `Connection close details: ${errorMessage}`, lastDisconnect.error);
            }

            if (shouldReconnect) connectToWhatsApp();
        } else if (connection === 'open') {
            console.log('Opened connection');
            connectionOpenTimeSec = Math.floor(Date.now() / 1000);
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        console.log(`[DEBUG] messages.upsert type: ${type}, count: ${messages.length}`);
        for (const msg of messages) {
            cacheMessage(msg);
        }

        if (type !== 'notify' && type !== 'append') return;
        for (const msg of messages) {
            try {
                if (msg.key?.fromMe) {
                    console.log(
                        '[DEBUG_SELF_MSG] details:',
                        JSON.stringify({
                            id: msg.key.id,
                            remoteJid: msg.key.remoteJid,
                            messageTimestamp: msg.messageTimestamp,
                            hasMessage: !!msg.message,
                            messageKeys: msg.message ? Object.keys(msg.message) : [],
                            text: msg.message?.conversation || msg.message?.extendedTextMessage?.text || ''
                        })
                    );
                }
                // Ignore historical messages older than 60 seconds
                let msgTime: any = msg.messageTimestamp;
                if (msgTime && typeof msgTime === 'object' && typeof msgTime.toNumber === 'function') {
                    msgTime = msgTime.toNumber();
                } else if (msgTime && typeof msgTime === 'object') {
                    msgTime = Number(msgTime.low ?? msgTime.unsigned ?? 0);
                }
                msgTime = Number(msgTime || 0);

                if (msgTime > 0 && connectionOpenTimeSec > 0) {
                    // Ignore messages sent before the bot finished connecting (history catchup)
                    if (msgTime < connectionOpenTimeSec - 2) {
                        continue;
                    }
                }

                await handleMessage(sock, msg);
            } catch (error) {
                console.error('Error handling message:', error);
            }
        }
    });
}

if (process.env.AUTO_UPDATE === 'true') {
    try {
        console.log('Attempting update from GitHub...');
        // Handle 'dubious ownership' error in Pterodactyl Docker environments
        execSync('git config --global --add safe.directory "*"', { stdio: 'inherit' });

        // Support private repositories if GITHUB_TOKEN is set in .env
        const token = process.env.GITHUB_TOKEN;
        const repoUrl = token
            ? `https://${token}@github.com/razaeldotexe/waf.git`
            : 'https://github.com/razaeldotexe/waf.git';

        execSync(`git fetch ${repoUrl} main`, { stdio: 'inherit' });
        execSync('git reset --hard FETCH_HEAD', { stdio: 'inherit' });
        console.log('Update from GitHub completed successfully.');
    } catch (err: any) {
        const safeErrorMsg = err.message.replace(/https:\/\/(.*?)@github\.com/g, 'https://***@github.com');
        console.error('Failed to update from GitHub, continuing startup...', safeErrorMsg);
    }
}

await toolsHandler.loadTools();
connectToWhatsApp();
