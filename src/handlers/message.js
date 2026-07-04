import { processAI } from '../ai.js';

export async function handleMessage(sock, msg) {
    if (!msg.message) return;

    // Only process messages from ourselves (self-bot) or specific logic according to phase 4
    // Phase 4: Bot dikonfigurasi sebagai self-bot. Wajib mendengarkan pesan dari dirinya sendiri
    const isFromMe = msg.key.fromMe;

    // Extact text
    const text =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        msg.message.imageMessage?.caption ||
        msg.message.videoMessage?.caption ||
        '';
    if (!text) return;

    // Example logic to trigger AI
    if (isFromMe && text.startsWith('.ai ')) {
        const query = text.replace('.ai ', '').trim();
        const jid = msg.key.remoteJid;

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
