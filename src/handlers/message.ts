import { jidNormalizedUser, WASocket, WAMessage } from '@whiskeysockets/baileys';
import { addGroup, isGroupWhitelisted } from '#/db.js';
import { writeLog } from '#/logger.js';
import toolsHandler from '#/tools/handler.js';

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

    if (!text) return;

    // Detect if sender is owner (supports JID, LID, device JID, and BOT_PHONE_NUMBER)
    const cleanId = (idStr?: string | null) => (idStr ? idStr.split(':')[0].split('@')[0] : null);
    const botRawJid = cleanId(sock.user?.id);
    const botRawLid = cleanId((sock.user as any)?.lid);
    const ownerNumber = cleanId(process.env.BOT_PHONE_NUMBER);

    const senderJid = msg.key.fromMe
        ? (sock.user?.id || (sock.user as any)?.lid)
        : (msg.key.participant || msg.key.remoteJid);
    const senderRaw = cleanId(senderJid);

    const isOwner =
        Boolean(msg.key.fromMe) ||
        (botRawJid !== null && senderRaw === botRawJid) ||
        (botRawLid !== null && senderRaw === botRawLid) ||
        (ownerNumber !== null && senderRaw === ownerNumber);

    const trimmedText = text.trim();
    const parts = trimmedText.split(/\s+/);
    const commandName = parts[0];
    const argsStr = trimmedText.substring(commandName.length).trim();

    if (commandName === '.addgroup') {
        if (!isOwner) {
            await sock.sendMessage(jid, { text: 'Perintah ini hanya dapat digunakan oleh owner bot.' }, { quoted: msg });
            return;
        }
        writeLog('INFO', 'Command executed', { command: '.addgroup', jid });
        if (!jid.endsWith('@g.us')) {
            await sock.sendMessage(jid, { text: 'Perintah ini hanya bisa digunakan di dalam grup.' });
            return;
        }
        const success = await addGroup(jid);
        if (success) {
            await sock.sendMessage(jid, { text: 'Grup berhasil ditambahkan ke whitelist!' });
        } else {
            await sock.sendMessage(jid, { text: 'Gagal menambahkan grup ke database.' });
        }
        return;
    }

    const tool = toolsHandler.getTool(commandName);
    if (tool) {
        // Cek batasan hak akses owner/publik
        const isOwnerOnly = tool.definition?.owner === true;
        if (isOwnerOnly && !isOwner) {
            await sock.sendMessage(
                jid,
                { text: 'Perintah ini hanya dapat digunakan oleh owner bot.' },
                { quoted: msg }
            );
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
        if (result && typeof result === 'string') {
            if (result.startsWith('Gagal') || !result.includes('berhasil dibuat')) {
                await sock.sendMessage(jid, { text: result }, { quoted: msg });
            }
        }
        return;
    }
}
