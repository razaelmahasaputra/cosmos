import { jidNormalizedUser, WASocket, WAMessage } from '@whiskeysockets/baileys';
import { addGroup, isGroupWhitelisted } from '#/db.js';
import { writeLog } from '#/logger.js';
import toolsHandler from '#/tools/handler.js';
import { isAutoStickerEnabled } from '#/utils/autoSticker.js';
import {
    isAutoCorrectionEnabled,
    isMessageProcessed,
    markMessageProcessed,
    analyzeAndCorrectText
} from '#/utils/autoCorrection.js';
import { handleOfflineAiResponder } from '#/utils/offlineAi.js';

function getUnwrappedMessage(m: any): any {
    if (!m) return null;
    if (m.viewOnceMessage?.message) return getUnwrappedMessage(m.viewOnceMessage.message);
    if (m.viewOnceMessageV2?.message) return getUnwrappedMessage(m.viewOnceMessageV2.message);
    if (m.viewOnceMessageV2Extension?.message) return getUnwrappedMessage(m.viewOnceMessageV2Extension.message);
    return m;
}

function hasDirectMedia(rawMsg: any): boolean {
    const m = getUnwrappedMessage(rawMsg);
    if (!m) return false;
    if (m.imageMessage) return true;
    if (m.videoMessage) return true;
    if (m.documentMessage) {
        const mime = m.documentMessage.mimetype || '';
        const filename = m.documentMessage.fileName || '';
        if (
            mime.startsWith('image/') ||
            mime.startsWith('video/') ||
            /\.(jpg|jpeg|png|gif|mp4|mov|webm|mkv|3gp)$/i.test(filename)
        ) {
            return true;
        }
    }
    return false;
}

export async function handleMessage(sock: WASocket, msg: WAMessage): Promise<void> {
    if (!msg.message || !msg.key.remoteJid) return;

    console.log('[DEBUG] Message received:', {
        fromMe: msg.key.fromMe,
        remoteJid: msg.key.remoteJid,
        text: msg.message.conversation || msg.message.extendedTextMessage?.text || ''
    });

    // Only process messages with valid content
    let jid = jidNormalizedUser(msg.key.remoteJid);
    if (jid.endsWith('@lid') && (msg.key as any).remoteJidAlt) {
        jid = jidNormalizedUser((msg.key as any).remoteJidAlt);
    }

    // Extract text
    const text =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        msg.message.imageMessage?.caption ||
        msg.message.videoMessage?.caption ||
        '';

    // Detect if sender is owner (supports JID, LID, device JID, and BOT_PHONE_NUMBER)
    const cleanId = (idStr?: string | null) => (idStr ? idStr.split(':')[0].split('@')[0] : null);
    const botRawJid = cleanId(sock.user?.id);
    const botRawLid = cleanId((sock.user as any)?.lid);
    const ownerNumber = cleanId(process.env.BOT_PHONE_NUMBER);

    const senderJid = msg.key.fromMe
        ? sock.user?.id || (sock.user as any)?.lid
        : msg.key.participant || msg.key.remoteJid;
    const senderRaw = cleanId(senderJid);

    const isOwner =
        Boolean(msg.key.fromMe) ||
        (botRawJid !== null && senderRaw === botRawJid) ||
        (botRawLid !== null && senderRaw === botRawLid) ||
        (ownerNumber !== null && senderRaw === ownerNumber);

    const trimmedText = text.trim();

    // Check if it's a bare number replying to a play search result
    let isPlayReply = false;
    if (/^\d+$/.test(trimmedText)) {
        const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (quotedMsg) {
            const extText = quotedMsg.extendedTextMessage;
            const quotedText = quotedMsg.conversation || extText?.text || extText?.matchedText || '';
            if (quotedText.toLowerCase().includes('reply with a number') && quotedText.includes('results for')) {
                isPlayReply = true;
            }
        }
    }

    if (trimmedText.startsWith('.') || isPlayReply) {
        let commandName: string;
        let argsStr: string;

        if (isPlayReply) {
            commandName = '.play';
            argsStr = trimmedText;
        } else {
            const parts = trimmedText.split(/\s+/);
            commandName = parts[0];
            argsStr = trimmedText.substring(commandName.length).trim();
        }

        if (commandName === '.addgroup' || commandName === '.addwhitelist') {
            if (!isOwner) {
                await sock.sendMessage(jid, { text: 'This command can only be used by the bot owner.' }, { quoted: msg });
                return;
            }
            writeLog('INFO', 'Command executed', { command: '.addgroup', jid });
            if (!jid.endsWith('@g.us')) {
                await sock.sendMessage(jid, { text: 'This command can only be executed within a group.' });
                return;
            }
            const success = await addGroup(jid);
            if (success) {
                await sock.sendMessage(jid, { text: 'Group successfully added to the whitelist!' });
            } else {
                await sock.sendMessage(jid, { text: 'Failed to add group to the database.' });
            }
            return;
        }

        const tool = toolsHandler.getTool(commandName);
        if (tool) {
            // Check owner permission constraints
            const isOwnerOnly = tool.definition?.owner === true;
            if (isOwnerOnly && !isOwner) {
                await sock.sendMessage(jid, { text: 'This command can only be used by the bot owner.' }, { quoted: msg });
                return;
            }

            if (jid.endsWith('@g.us')) {
                const whitelisted = await isGroupWhitelisted(jid);
                if (!whitelisted) return;
            }

            writeLog('INFO', 'Command executed', { command: commandName, jid });
            console.log('[Message Handler] Command:', commandName, 'key details:', JSON.stringify(msg.key));

            let args: Record<string, any> = {};
            const props = tool.definition?.parameters?.properties;
            if (props) {
                const keys = Object.keys(props);
                if (keys.length === 1) {
                    args[keys[0]] = argsStr;
                } else if (keys.length > 1) {
                    try {
                        args = JSON.parse(argsStr);
                    } catch {
                        args[keys[0]] = argsStr;
                    }
                }
            }

            await sock.sendPresenceUpdate('composing', jid);
            const result = await toolsHandler.execute(commandName, args, { sock, msg, jid });
            if (result && typeof result === 'string' && result.trim().length > 0) {
                await sock.sendMessage(jid, { text: result }, { quoted: msg });
            }
            return;
        }
    }

    // Offline AI Responder
    if (!isOwner) {
        const handled = await handleOfflineAiResponder(sock, msg, jid, text);
        if (handled) return;
    }

    // Auto-correct processing for owner's sent text messages
    if (isOwner && Boolean(msg.key.fromMe) && isAutoCorrectionEnabled(jid)) {
        const msgId = msg.key.id;
        if (msgId && !isMessageProcessed(msgId) && trimmedText.length > 1 && !trimmedText.startsWith('.')) {
            markMessageProcessed(msgId);
            try {
                const corrected = await analyzeAndCorrectText(trimmedText);
                if (corrected && corrected !== trimmedText) {
                    writeLog('INFO', 'Auto-correct executed', { jid, original: trimmedText, corrected });
                    console.log(`[Auto-Correct] Editing message in ${jid}: "${trimmedText}" -> "${corrected}"`);
                    await sock.sendMessage(jid, { text: corrected, edit: msg.key });
                }
            } catch (err: any) {
                console.error('[Auto-Correct Error]', err);
                writeLog('ERROR', 'Auto-correct handler failed', { error: err.message });
            }
        }
    }

    // Auto sticker processing if enabled for this chat and message contains direct media
    // Ignore programmatic bot responses (which usually start with ✅, ⏳, or ❌) to prevent loops, but allow owner's manual media
    const isBotResponse = msg.key.fromMe && text && (text.startsWith('✅') || text.startsWith('⏳') || text.startsWith('❌'));
    if (!isBotResponse && isAutoStickerEnabled(jid) && hasDirectMedia(msg.message)) {
        if (jid.endsWith('@g.us')) {
            const whitelisted = await isGroupWhitelisted(jid);
            if (!whitelisted) return;
        }

        writeLog('INFO', 'Auto sticker executed', { jid });
        console.log('[Message Handler] Auto sticker executing for jid:', jid);

        await sock.sendPresenceUpdate('composing', jid);
        const result = await toolsHandler.execute('sticker_maker', {}, { sock, msg, jid });
        if (result && typeof result === 'string') {
            if (result.startsWith('Failed') || result.startsWith('Error') || result.startsWith('Gagal')) {
                await sock.sendMessage(jid, { text: result }, { quoted: msg });
            }
        }
        return;
    }
}
