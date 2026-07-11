import { jidNormalizedUser } from '@whiskeysockets/baileys';
import { processAI } from '../ai.js';
import { addGroup, isGroupWhitelisted } from '../db.js';
import { writeLog } from '../logger.js';
import toolsHandler from '../tools/handler.js';

const mediaGroupCache = new Map();

export async function handleMessage(sock, msg) {
    if (!msg.message || !msg.key.remoteJid) return;

    // Only process messages from ourselves (self-bot) or specific logic according to phase 4
    // Phase 4: Bot dikonfigurasi sebagai self-bot. Wajib mendengarkan pesan dari dirinya sendiri
    const isFromMe = msg.key.fromMe;
    const jid = jidNormalizedUser(msg.key.remoteJid);

    // Extact text
    const text =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        msg.message.imageMessage?.caption ||
        msg.message.videoMessage?.caption ||
        '';

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
    const mediaGroupId = imageMsg?.mediaGroupId || videoMsg?.mediaGroupId;

    if (mediaGroupId) {
        if (!mediaGroupCache.has(mediaGroupId)) {
            mediaGroupCache.set(mediaGroupId, {
                messages: [],
                shouldExecute: false,
                timeoutId: null
            });
        }
        const group = mediaGroupCache.get(mediaGroupId);
        group.messages.push(msg);

        const tempText = text || imageMsg?.caption || videoMsg?.caption || '';
        const triggerRegex = /^\.(stiker|s|sticker)\b/i;
        if (isFromMe && triggerRegex.test(tempText.trim())) {
            group.shouldExecute = true;
        }

        if (group.timeoutId) {
            clearTimeout(group.timeoutId);
        }

        group.timeoutId = setTimeout(async () => {
            const currentGroup = mediaGroupCache.get(mediaGroupId);
            mediaGroupCache.delete(mediaGroupId);

            if (currentGroup && currentGroup.shouldExecute) {
                for (const groupMsg of currentGroup.messages) {
                    try {
                        await sock.sendPresenceUpdate('composing', jid);
                        await toolsHandler.execute('sticker_maker', {}, { sock, msg: groupMsg, jid });
                    } catch (error) {
                        console.error('Error processing bulk sticker:', error);
                    }
                    await new Promise((resolve) => setTimeout(resolve, 3000));
                }
            }
        }, 1500);

        return;
    }

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
