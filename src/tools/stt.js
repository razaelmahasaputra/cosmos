import { downloadContentFromMessage } from '@whiskeysockets/baileys';
import { Groq } from 'groq-sdk';
import dotenv from 'dotenv';
import { writeLog } from '../logger.js';

dotenv.config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export const definition = {
    name: 'stt',
    aliases: ['.stt', '.ptt'],
    description: 'Mentranskripsikan voice note yang di-quote menjadi teks menggunakan Groq Whisper.',
    parameters: {
        type: 'object',
        properties: {},
        required: []
    }
};

export async function execute(_, ctx) {
    const contextInfo = ctx.msg.message?.extendedTextMessage?.contextInfo;
    const quotedMessage = contextInfo?.quotedMessage;
    const audioMessage = quotedMessage?.audioMessage;

    if (!audioMessage) {
        return 'Gagal: Quote sebuah voice note terlebih dahulu, lalu ketik perintah ini.';
    }

    if (!audioMessage.ptt) {
        return 'Gagal: Pesan yang di-quote bukan voice note (push-to-talk).';
    }

    try {
        // Download audio stream dari quoted message
        const stream = await downloadContentFromMessage(audioMessage, 'audio');
        const chunks = [];
        for await (const chunk of stream) {
            chunks.push(chunk);
        }
        const buffer = Buffer.concat(chunks);

        // Kirim ke Groq Whisper — OGG/Opus didukung langsung tanpa FFMPEG
        const file = new File([buffer], 'audio.ogg', { type: 'audio/ogg' });
        const transcription = await groq.audio.transcriptions.create({
            file,
            model: 'whisper-large-v3-turbo',
            response_format: 'text'
        });

        const text = typeof transcription === 'string' ? transcription.trim() : transcription?.text?.trim();

        if (!text) {
            return 'Gagal: Tidak ada teks yang terdeteksi dari voice note ini.';
        }

        writeLog('INFO', 'STT transcription success', { jid: ctx.jid, length: text.length });

        // Reconstruct quoted message object agar balasan menunjuk ke voice note asli
        const quotedVoiceNote = {
            key: {
                remoteJid: ctx.jid,
                id: contextInfo.stanzaId,
                fromMe: !contextInfo.participant,
                ...(contextInfo.participant && { participant: contextInfo.participant })
            },
            message: quotedMessage
        };

        await ctx.sock.sendMessage(ctx.jid, { text }, { quoted: quotedVoiceNote });

        // Return null agar message.js tidak mengirim pesan duplikat
        return null;
    } catch (err) {
        console.error('[STT Tool Error]', err);
        writeLog('ERROR', 'STT transcription failed', { jid: ctx.jid, error: err.message });
        return 'Gagal: Terjadi kesalahan saat mentranskripsi voice note.';
    }
}
