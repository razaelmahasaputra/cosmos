import sharp from 'sharp';
import { downloadMediaMessage } from '@whiskeysockets/baileys';

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
    const isImage =
        ctx.msg.message.imageMessage || ctx.msg.message.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;
    if (!isImage) return 'Gagal: Tidak ada gambar yang dilampirkan atau di-reply.';

    try {
        let mediaMsg = ctx.msg;
        if (!ctx.msg.message.imageMessage) {
            mediaMsg = {
                message: ctx.msg.message.extendedTextMessage.contextInfo.quotedMessage
            };
        }

        const mediaData = await downloadMediaMessage(
            mediaMsg,
            'buffer',
            {},
            {
                logger: console,
                reuploadRequest: ctx.sock.updateMediaMessage
            }
        );

        const webpBuffer = await sharp(mediaData).resize(512, 512, { fit: 'cover' }).webp({ quality: 80 }).toBuffer();

        await ctx.sock.sendMessage(ctx.jid, { sticker: webpBuffer }, { quoted: ctx.msg });
        return 'Sticker berhasil dibuat dan dikirim.';
    } catch (err) {
        console.error(err);
        return 'Terjadi kesalahan saat memproses gambar menjadi stiker.';
    }
}
