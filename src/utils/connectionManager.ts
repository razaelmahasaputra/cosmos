import { makeWASocket, DisconnectReason } from '@whiskeysockets/baileys';
import pino from 'pino';
import { handleMessage } from '#/handlers/message.js';
import { cacheMessage, getCachedMessage } from '#/utils/messageCache.js';
import { usePrismaAuthState } from '#/utils/prismaAuthState.js';
import { initActiveSessions } from '#/utils/sessionStore.js';
import { dbContext, getPrismaClient } from '#/db.js';

const logger = pino({ level: 'silent' });
const MAX_RECONNECT_ATTEMPTS = 15;
const RECONNECT_BASE_DELAY_MS = 3000;

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface ConnectOptions {
    sessionId: string;
    phoneNumber?: string;
    onPairingCode?: (code: string) => void;
    onConnected?: () => void;
    onClosed?: (isLoggedOut: boolean) => void;
    disableReconnect?: boolean;
}

export const activeConnections = new Map<string, ReturnType<typeof makeWASocket>>();

export async function connectToWhatsApp(options: ConnectOptions): Promise<void> {
    const { sessionId, phoneNumber, onPairingCode, onConnected, onClosed } = options;
    let connectionOpenTimeSec = 0;
    let reconnectAttempts = 0;

    const authState = await usePrismaAuthState(sessionId);
    const { state, saveCreds } = authState;

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
                `[getMessage] [${sessionId}] Request received for key ID: ${key.id}, remoteJid: ${key.remoteJid}, fromMe: ${key.fromMe}`
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

    activeConnections.set(sessionId, sock);

    const pendingPairing = !sock.authState.creds.registered;
    let pairingRequested = false;

    if (pendingPairing) {
        if (!phoneNumber) {
            console.error(`[Pairing] [${sessionId}] No phone number provided for pairing`);
        } else {
            console.log(`[Pairing] [${sessionId}] Will request pairing code for ${phoneNumber} after WebSocket connects...`);
        }
    }

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'open') {
            console.log(`[Connection] [${sessionId}] Opened`);
            reconnectAttempts = 0;
            connectionOpenTimeSec = Math.floor(Date.now() / 1000);
            if (sessionId === 'default') {
                await initActiveSessions();
            }
            if (onConnected) onConnected();
        }

        if (update.qr && pendingPairing && !sock.authState.creds.registered && !pairingRequested && phoneNumber) {
            pairingRequested = true;
            try {
                console.log(`[Pairing] [${sessionId}] Requesting pairing code for ${phoneNumber}...`);
                const code = await sock.requestPairingCode(phoneNumber);
                const formattedCode = code.match(/.{1,4}/g)?.join('-') || code;
                if (onPairingCode) {
                    onPairingCode(formattedCode);
                } else {
                    const msg = [
                        '',
                        '╔══════════════════════════════════════╗',
                        '║         PAIRING CODE                 ║',
                        `║     ${formattedCode.padEnd(34)}║`,
                        '╚══════════════════════════════════════╝',
                        '',
                        `[Pairing] [${sessionId}] Enter this code in WhatsApp > Linked Devices > Pair a device`,
                        ''
                    ].join('\n');
                    console.log(msg);
                    console.error(msg);
                }
            } catch (err) {
                console.error(`[Pairing] [${sessionId}] Failed to request pairing code:`, err);
                pairingRequested = false;
            }
        }

        if (connection === 'close') {
            const lastDisconnectError = lastDisconnect?.error as any;
            const errorCode = lastDisconnectError?.output?.statusCode || lastDisconnectError?.code;
            const errorMessage = lastDisconnectError?.message || 'Unknown Reason';
            const isLoggedOut = errorCode === DisconnectReason.loggedOut;
            const shouldReconnect = (!isLoggedOut || pendingPairing) && !options.disableReconnect;

            console.log(
                `[Connection] [${sessionId}] Closed (Reason: ${errorMessage}, Code: ${errorCode}). Reconnecting: ${shouldReconnect}`
            );

            connectionOpenTimeSec = 0;
            activeConnections.delete(sessionId);

            if (lastDisconnect?.error) {
                console.error(`Connection close details [${sessionId}]: ${errorMessage}`, lastDisconnect.error);
            }

            if (onClosed) onClosed(isLoggedOut);

            if (shouldReconnect && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                reconnectAttempts++;
                const reconnectDelay = RECONNECT_BASE_DELAY_MS * Math.min(reconnectAttempts, 5);
                console.log(
                    `[Connection] [${sessionId}] Reconnecting in ${reconnectDelay}ms (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`
                );
                await delay(reconnectDelay);
                connectToWhatsApp(options);
            } else if (shouldReconnect) {
                console.error(`[Connection] [${sessionId}] Max reconnect attempts (${MAX_RECONNECT_ATTEMPTS}) reached. Giving up.`);
            }
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        console.log(`[DEBUG] [${sessionId}] messages.upsert type: ${type}, count: ${messages.length}`);
        for (const msg of messages) {
            cacheMessage(msg);
        }

        if (type !== 'notify' && type !== 'append') return;
        for (const msg of messages) {
            try {
                if (msg.key?.fromMe) {
                    console.log(
                        `[DEBUG_SELF_MSG] [${sessionId}] details:`,
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
                
                let msgTime: any = msg.messageTimestamp;
                if (msgTime && typeof msgTime === 'object' && typeof msgTime.toNumber === 'function') {
                    msgTime = msgTime.toNumber();
                } else if (msgTime && typeof msgTime === 'object') {
                    msgTime = Number(msgTime.low ?? msgTime.unsigned ?? 0);
                }
                msgTime = Number(msgTime || 0);

                if (msgTime > 0 && connectionOpenTimeSec > 0) {
                    if (msgTime < connectionOpenTimeSec - 2) {
                        continue;
                    }
                }

                await dbContext.run({ sessionId, prisma: getPrismaClient(sessionId) }, async () => {
                    await handleMessage(sock, msg);
                });
            } catch (error) {
                console.error(`[${sessionId}] Error handling message:`, error);
            }
        }
    });
}
