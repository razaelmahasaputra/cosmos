import { jidNormalizedUser, WASocket, WAMessage } from '@whiskeysockets/baileys';
import { addGroup, isGroupWhitelisted, prisma } from '#/db.js';
import toolsHandler from '#/tools/handler.js';
import { isAutoStickerEnabled } from '#/utils/autoSticker.js';
import { isAutoCorrectionEnabled, analyzeAndCorrectText } from '#/utils/autoCorrection.js';
import { isMessageProcessed, markMessageProcessed } from '#/utils/messageCache.js';
import { processAutoDl } from '#/utils/autodl.js';
import { handleOfflineAiResponder } from '#/utils/offlineAi.js';
import { isUserRegistering, processRegistrationStep } from '#/utils/idCard.js';
import { formatMentions } from '#/utils/casino.js';
import { hasCancellableSession, cancelActiveSession } from '#/utils/cancellationManager.js';

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
    if (!msg.message || !msg.key.remoteJid || !msg.key.id) return;

    if (isMessageProcessed(msg.key.id)) {
        return;
    }
    markMessageProcessed(msg.key.id);

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

    const getJidAndLid = () => {
        if (msg.key.fromMe) {
            return {
                jidDb: cleanId(sock.user?.id),
                lidDb: cleanId((sock.user as any)?.lid)
            };
        }
        const p = msg.key.participant || msg.key.remoteJid;
        const pAlt =
            msg.key.participantAlt ||
            msg.key.remoteJidAlt ||
            (msg.key as any).participantAlt ||
            (msg.key as any).remoteJidAlt;
        const out = { jidDb: null as string | null, lidDb: null as string | null };
        if (p && p.endsWith('@lid')) {
            out.lidDb = cleanId(p);
            out.jidDb = pAlt ? cleanId(pAlt) : null;
        } else {
            out.jidDb = cleanId(p);
            out.lidDb = pAlt ? cleanId(pAlt) : null;
        }
        return out;
    };

    let { jidDb: senderJidDb } = getJidAndLid();
    const { lidDb: senderLidDb } = getJidAndLid();

    if (senderLidDb && !senderJidDb) {
        // Fallback: check DB if we only have LID but no JID in this message
        try {
            const existing = await prisma.user.findUnique({ where: { lid: senderLidDb } });
            if (existing) senderJidDb = existing.id;
        } catch {
            /* ignore */
        }
    }

    if (senderJidDb) {
        // Fire and forget db upsert to ensure JID/LID mapping is saved
        prisma.user
            .upsert({
                where: { id: senderJidDb },
                update: {
                    ...(senderLidDb ? { lid: senderLidDb } : {}),
                    ...(msg.pushName ? { pushName: msg.pushName } : {})
                },
                create: {
                    id: senderJidDb,
                    lid: senderLidDb || null,
                    pushName: msg.pushName || null
                }
            })
            .catch(() => {
                /* ignore */
            });
    }

    const senderRaw = senderJidDb || senderLidDb || '';

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

    // Global cancellation check: if user sends a cancel keyword (.cancel, cancel, .batal, batal, .abort, abort)
    const lowerText = trimmedText.toLowerCase();
    const isCancelKeyword =
        lowerText === '.cancel' ||
        lowerText === 'cancel' ||
        lowerText === '.batal' ||
        lowerText === 'batal' ||
        lowerText === '.abort' ||
        lowerText === 'abort';

    if (senderRaw && isCancelKeyword && hasCancellableSession(senderRaw, jid)) {
        const cancelMsg = await cancelActiveSession(senderRaw, jid, sock, msg);
        if (cancelMsg && typeof cancelMsg === 'string' && cancelMsg.trim().length > 0) {
            await sock.sendMessage(jid, { text: cancelMsg }, { quoted: msg });
        }
        return;
    }

    // Ignore programmatic bot responses from being processed as registration step input
    let isQuotingCommand = false;
    if (msg.key.fromMe && msg.message) {
        const qMsg =
            msg.message.videoMessage?.contextInfo?.quotedMessage ||
            msg.message.imageMessage?.contextInfo?.quotedMessage ||
            msg.message.documentMessage?.contextInfo?.quotedMessage ||
            msg.message.extendedTextMessage?.contextInfo?.quotedMessage;
        if (qMsg) {
            const qText = qMsg.conversation || qMsg.extendedTextMessage?.text || '';
            if (qText.trim().startsWith('.')) isQuotingCommand = true;
        }
    }

    // Check if sender is currently in an active ID Card registration flow in this chat
    if (senderRaw && !isQuotingCommand && isUserRegistering(senderRaw, jid)) {
        if (!trimmedText.startsWith('.')) {
            const handled = await processRegistrationStep(sock, msg, senderRaw, jid, trimmedText);
            if (handled) return;
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
                await sock.sendMessage(
                    jid,
                    { text: 'This command can only be used by the bot owner.' },
                    { quoted: msg }
                );
                return;
            }
            console.log('Command executed', { command: '.addgroup', jid });
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
                await sock.sendMessage(
                    jid,
                    { text: 'This command can only be used by the bot owner.' },
                    { quoted: msg }
                );
                return;
            }

            if (jid.endsWith('@g.us') && !isOwner) {
                const whitelisted = await isGroupWhitelisted(jid);
                if (!whitelisted) return;
            }

            console.log('Command executed', { command: commandName, jid });
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

            // Fix quote previews for LIDs: replace raw LID numbers in the message text with pushnames or phone numbers
            // We do this by modifying `msg` in place before execution, so tools quoting this `msg` have a readable preview.
            if (msg.message) {
                const msgKeys = ['extendedTextMessage', 'imageMessage', 'videoMessage'] as const;
                for (const msgKey of msgKeys) {
                    const msgContent = msg.message[msgKey];
                    if (msgContent) {
                        const textKey = msgKey === 'extendedTextMessage' ? 'text' : 'caption';
                        let currentText = (msgContent as any)[textKey] as string | null | undefined;
                        const mentionedJids = msgContent.contextInfo?.mentionedJid;

                        if (currentText && mentionedJids && mentionedJids.length > 0) {
                            let groupParticipants: any[] = [];
                            if (jid.endsWith('@g.us')) {
                                try {
                                    const meta = await sock.groupMetadata(jid);
                                    groupParticipants = meta.participants;
                                } catch {
                                    // ignore error
                                }
                            }

                            for (const mJid of mentionedJids) {
                                if (mJid.endsWith('@lid')) {
                                    const lidNum = mJid.split('@')[0];
                                    if (currentText.includes(`@${lidNum}`)) {
                                        let resolvedJid = mJid;
                                        const participant = groupParticipants.find((p: any) => p.lid === mJid);
                                        if (participant && participant.id) {
                                            resolvedJid = participant.id;
                                        }

                                        const searchJid = resolvedJid.endsWith('@lid') ? null : resolvedJid;
                                        let replacement = `@${lidNum}`; // fallback

                                        if (searchJid) {
                                            const jidNum = searchJid.split('@')[0];
                                            replacement = `@${jidNum}`; // phone fallback
                                            try {
                                                const user = await prisma.user.findUnique({ where: { id: jidNum } });
                                                if (user && user.pushName) {
                                                    replacement = `@${user.pushName}`;
                                                }
                                            } catch {
                                                // ignore error
                                            }
                                        }

                                        currentText = currentText.replace(new RegExp(`@${lidNum}`, 'g'), replacement);
                                    }
                                }
                            }
                            (msgContent as any)[textKey] = currentText;
                        }
                    }
                }
            }

            await sock.sendPresenceUpdate('composing', jid);
            const result = await toolsHandler.execute(commandName, args, { sock, msg, jid });
            if (result && typeof result === 'string' && result.trim().length > 0) {
                const matches = result.match(/@(\d+)/g);
                const mentions = matches ? formatMentions(matches.map((m) => m.substring(1))) : [];
                await sock.sendMessage(jid, { text: result, mentions }, { quoted: msg });
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
        if (msgId && trimmedText.length > 1 && !trimmedText.startsWith('.')) {
            try {
                const corrected = await analyzeAndCorrectText(trimmedText);
                if (corrected && corrected !== trimmedText) {
                    console.log('Auto-correct executed', { jid, original: trimmedText, corrected });
                    console.log(`[Auto-Correct] Editing message in ${jid}: "${trimmedText}" -> "${corrected}"`);
                    await sock.sendMessage(jid, { text: corrected, edit: msg.key });
                }
            } catch (err: any) {
                console.error('[Auto-Correct Error]', err);
                console.error('Auto-correct handler failed', { error: err.message });
            }
        }
    }

    // Auto-DL Processing
    const isBotResponseStr =
        msg.key.fromMe &&
        ((text && (text.startsWith('✅') || text.startsWith('⏳') || text.startsWith('❌'))) || false); // we will evaluate isQuotingCommand properly below

    if (!isBotResponseStr && trimmedText && !trimmedText.startsWith('.')) {
        if (jid.endsWith('@g.us') && !isOwner) {
            const whitelisted = await isGroupWhitelisted(jid);
            if (whitelisted) {
                await processAutoDl(sock, msg, jid, trimmedText);
            }
        } else {
            await processAutoDl(sock, msg, jid, trimmedText);
        }
    }

    // Auto sticker processing if enabled for this chat and message contains direct media
    // Ignore programmatic bot responses (which usually start with ✅, ⏳, or ❌, or quote a command) to prevent loops
    isQuotingCommand = false;
    if (msg.key.fromMe && msg.message) {
        const qMsg =
            msg.message.videoMessage?.contextInfo?.quotedMessage ||
            msg.message.imageMessage?.contextInfo?.quotedMessage ||
            msg.message.documentMessage?.contextInfo?.quotedMessage ||
            msg.message.extendedTextMessage?.contextInfo?.quotedMessage;
        if (qMsg) {
            const qText = qMsg.conversation || qMsg.extendedTextMessage?.text || '';
            if (qText.trim().startsWith('.')) isQuotingCommand = true;
        }
    }

    const isBotResponse =
        msg.key.fromMe &&
        ((text && (text.startsWith('✅') || text.startsWith('⏳') || text.startsWith('❌'))) || isQuotingCommand);
    if (!isBotResponse && isAutoStickerEnabled(jid) && hasDirectMedia(msg.message)) {
        if (jid.endsWith('@g.us') && !isOwner) {
            const whitelisted = await isGroupWhitelisted(jid);
            if (!whitelisted) return;
        }

        console.log('Auto sticker executed', { jid });
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
