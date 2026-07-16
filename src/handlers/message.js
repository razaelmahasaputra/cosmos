import { jidNormalizedUser } from '@whiskeysockets/baileys';
import { addGroup, isGroupWhitelisted } from '../db.js';
import { writeLog } from '../logger.js';
import toolsHandler from '../tools/handler.js';

export async function handleMessage(sock, msg) {
    if (!msg.message || !msg.key.remoteJid) return;

    // Only process messages from ourselves (self-bot) or specific logic according to phase 4
    // Phase 4: Bot dikonfigurasi sebagai self-bot. Wajib mendengarkan pesan dari dirinya sendiri
    const isFromMe = msg.key.fromMe;
    let jid = jidNormalizedUser(msg.key.remoteJid);
    if (jid.endsWith('@lid') && msg.key.remoteJidAlt) {
        jid = jidNormalizedUser(msg.key.remoteJidAlt);
    }

    // Extract text
    const text =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        msg.message.imageMessage?.caption ||
        msg.message.videoMessage?.caption ||
        '';

    if (!text) return;

    if (isFromMe && text.trim() === '.addgroup') {
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

    const trimmedText = text.trim();
    if (isFromMe) {
        const parts = trimmedText.split(/\s+/);
        const commandName = parts[0];
        const argsStr = trimmedText.substring(commandName.length).trim();

        const tool = toolsHandler.getTool(commandName);
        if (tool) {
            writeLog('INFO', 'Command executed', { command: commandName, jid });
            console.log('[Message Handler] Command:', commandName, 'key details:', JSON.stringify(msg.key));
            if (jid.endsWith('@g.us')) {
                const whitelisted = await isGroupWhitelisted(jid);
                if (!whitelisted) return;
            }

            let args = {};
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
            if (result) {
                if (result.startsWith('Gagal') || !result.includes('berhasil dibuat')) {
                    await sock.sendMessage(jid, { text: result }, { quoted: msg });
                }
            }
            return;
        }
    }

}
