import { processAI } from '../ai.js';
import { addGroup, isGroupWhitelisted } from '../db.js';
import { writeLog } from '../logger.js';
import toolsHandler from '../tools/handler.js';

export async function handleMessage(sock, msg) {
    if (!msg.message) return;

    // Only process messages from ourselves (self-bot) or specific logic according to phase 4
    // Phase 4: Bot dikonfigurasi sebagai self-bot. Wajib mendengarkan pesan dari dirinya sendiri
    const isFromMe = msg.key.fromMe;
    const jid = msg.key.remoteJid;

    // Extact text
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
        const tool = toolsHandler.getTool(trimmedText);
        if (tool) {
            writeLog('INFO', 'Command executed', { command: trimmedText, jid });
            if (jid.endsWith('@g.us')) {
                const whitelisted = await isGroupWhitelisted(jid);
                if (!whitelisted) return;
            }

            await sock.sendPresenceUpdate('composing', jid);
            const result = await toolsHandler.execute(trimmedText, {}, { sock, msg, jid });
            if (result) {
                if (result.startsWith('Gagal') || !result.includes('berhasil dibuat')) {
                    await sock.sendMessage(jid, { text: result }, { quoted: msg });
                }
            }
            return;
        }
    }

    // Example logic to trigger AI
    if (isFromMe && text.startsWith('.ai ')) {
        writeLog('INFO', 'Command executed', { command: '.ai', jid, query: text });
        // Jika di grup, pastikan grup sudah di-whitelist
        if (jid.endsWith('@g.us')) {
            const whitelisted = await isGroupWhitelisted(jid);
            if (!whitelisted) return;
        }

        const query = text.replace('.ai ', '').trim();

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
