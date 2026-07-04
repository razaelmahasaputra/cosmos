import sharp from 'sharp';
import { downloadContentFromMessage } from '@whiskeysockets/baileys';

export const definition = {
    name: 'sticker_maker',
    description: 'Membuat stiker dari gambar yang dikirim oleh pengguna.',
    parameters: {
        type: 'object',
        properties: {},
        required: []
    }
};

export async function execute(_, ctx) {
    const imageMessage = ctx.msg.message?.imageMessage || ctx.msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;
    
    if (!imageMessage) return 'Gagal: Tidak ada gambar yang dilampirkan atau di-reply.';

    try {
        const stream = await downloadContentFromMessage(imageMessage, 'image');
        let buffer = Buffer.from([]);
        for await(const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
        }

        const webpBuffer = await sharp(buffer)
            .resize(512, 512, { fit: 'cover' })
            .webp({ quality: 80 })
            .toBuffer();

        await ctx.sock.sendMessage(ctx.jid, { sticker: webpBuffer }, { quoted: ctx.msg });
        return 'Sticker berhasil dibuat dan dikirim.';
    } catch (err) {
        console.error(err);
        return 'Gagal: Terjadi kesalahan saat memproses gambar menjadi stiker.';
    }
}
