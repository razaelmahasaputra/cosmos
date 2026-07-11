import { jidNormalizedUser } from '@whiskeysockets/baileys';
import { processAI } from '../ai.js';
import { addGroup, isGroupWhitelisted } from '../db.js';
import { writeLog } from '../logger.js';
import toolsHandler from '../tools/handler.js';

const userMediaQueue = new Map();

export async function handleMessage(sock, msg) {
    if (!msg.message || !msg.key.remoteJid) return;

    // Only process messages from ourselves (self-bot) or specific logic according to phase 4
    // Phase 4: Bot dikonfigurasi sebagai self-bot. Wajib mendengarkan pesan dari dirinya sendiri
    const isFromMe = msg.key.fromMe;
    const jid = jidNormalizedUser(msg.key.remoteJid);

    const imageMsg =
        msg.message.imageMessage ||
        msg.message.viewOnceMessage?.message?.imageMessage ||
        msg.message.viewOnceMessageV2?.message?.imageMessage ||
        msg.message.viewOnceMessageV2Extension?.message?.imageMessage;
    const videoMsg =
        msg.message.videoMessage ||
        msg.message.viewOnceMessage?.message?.videoMessage ||
        msg.message.viewOnceMessageV2?.message?.videoMessage ||
        msg.message.viewOnceMessageV2Extension?.message?.videoMessage;
    const documentMsg =
        msg.message.documentMessage ||
        msg.message.viewOnceMessage?.message?.documentMessage ||
        msg.message.viewOnceMessageV2?.message?.documentMessage ||
        msg.message.viewOnceMessageV2Extension?.message?.documentMessage;

    const isGifDoc = documentMsg && (documentMsg.mimetype === 'image/gif' || documentMsg.fileName?.endsWith('.gif'));
    const isMedia = !!(imageMsg || videoMsg || isGifDoc);

    if (isMedia) {
        const sender = msg.key.participant || msg.key.remoteJid;
        const queueKey = `${jid}_${sender}`;

        if (!userMediaQueue.has(queueKey)) {
            userMediaQueue.set(queueKey, {
                messages: [],
                shouldExecute: false,
                timeoutId: null
            });
        }
        const queue = userMediaQueue.get(queueKey);
        queue.messages.push(msg);

        const captionText = imageMsg?.caption || videoMsg?.caption || documentMsg?.caption || '';
        const triggerRegex = /^\.(stiker|s|sticker)\b/i;
        if (isFromMe && triggerRegex.test(captionText.trim())) {
            queue.shouldExecute = true;
        }

        if (queue.timeoutId) {
            clearTimeout(queue.timeoutId);
        }

        queue.timeoutId = setTimeout(async () => {
            const currentQueue = userMediaQueue.get(queueKey);
            userMediaQueue.delete(queueKey);

            if (currentQueue && currentQueue.shouldExecute) {
                for (const queueMsg of currentQueue.messages) {
                    try {
                        await sock.sendPresenceUpdate('composing', jid);
                        await toolsHandler.execute('sticker_maker', {}, { sock, msg: queueMsg, jid });
                    } catch (error) {
                        console.error('Error processing bulk sticker:', error);
                    }
                    await new Promise((resolve) => setTimeout(resolve, 3000));
                }
            }
        }, 2000);

        return;
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

    // Example logic to trigger AI
    const aiMatch = text.match(/^\.ai(?:\s+(.*))?$/s);
    if (aiMatch) {
        // Jika di grup, pastikan grup sudah di-whitelist
        if (jid.endsWith('@g.us')) {
            const whitelisted = await isGroupWhitelisted(jid);
            if (!whitelisted) return;
        }

        const query = (aiMatch[1] || '').trim();

        if (!query) {
            await sock.sendMessage(
                jid,
                { text: 'Format salah atau query kosong. Gunakan: .ai <pertanyaan>\nContoh: .ai Siapa namamu?' },
                { quoted: msg }
            );
            return;
        }

        writeLog('INFO', 'Command executed', { command: '.ai', jid, query });

        // Mark as typing
        await sock.sendPresenceUpdate('composing', jid);

        try {
            const response = await processAI(query, jid, { sock, msg, jid });
            if (response) {
                await sock.sendMessage(jid, { text: response }, { quoted: msg });
            }
        } catch (error) {
            console.error('AI Processing Error:', error);
            await sock.sendMessage(jid, { text: 'Terjadi kesalahan saat memproses permintaan.' }, { quoted: msg });
        }
    }
}
