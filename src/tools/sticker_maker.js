import sharp from 'sharp';
import { downloadContentFromMessage } from '@whiskeysockets/baileys';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

// Try to dynamically load ffmpeg-static if available
let ffmpegStaticPath = null;
try {
    const ffmpegStatic = await import('ffmpeg-static');
    ffmpegStaticPath = ffmpegStatic.default || ffmpegStatic;
} catch {
    // Not available on this platform (e.g., Termux/Android)
}

function getFFmpegPath() {
    if (ffmpegStaticPath) return ffmpegStaticPath;
    try {
        execSync('ffmpeg -version', { stdio: 'ignore' });
        return 'ffmpeg';
    } catch {
        return null;
    }
}

async function convertVideoToSticker(buffer, format) {
    const tempDir = os.tmpdir();
    const inputPath = path.join(tempDir, `temp_sticker_in_${Date.now()}.${format}`);
    const outputPath = path.join(tempDir, `temp_sticker_out_${Date.now()}.webp`);

    try {
        await fs.promises.writeFile(inputPath, buffer);
        const ffmpegCmd = getFFmpegPath();
        if (!ffmpegCmd) {
            throw new Error('FFmpeg tidak ditemukan di sistem.');
        }

        // Convert to animated webp: 512x512 crop/scale, max 5s, 12fps, loop infinitely
        const command = `"${ffmpegCmd}" -y -i "${inputPath}" -t 5 -vcodec libwebp -filter_complex "scale=512:512:force_original_aspect_ratio=increase,crop=512:512,fps=12" -loop 0 -preset default -an -vsync 0 "${outputPath}"`;
        execSync(command, { stdio: 'ignore' });

        return await fs.promises.readFile(outputPath);
    } finally {
        try {
            if (fs.existsSync(inputPath)) await fs.promises.unlink(inputPath);
            if (fs.existsSync(outputPath)) await fs.promises.unlink(outputPath);
        } catch (e) {
            console.error('Gagal menghapus file temporary:', e);
        }
    }
}

async function convertGifToStickerSharp(buffer) {
    return await sharp(buffer, { animated: true })
        .resize(512, 512, { fit: 'cover' })
        .webp({ effort: 6, quality: 70 })
        .toBuffer();
}

export const definition = {
    name: 'sticker_maker',
    aliases: ['.sticker', '.s', '.stiker'],
    description: 'Membuat stiker dari gambar, video, atau GIF yang dikirim oleh pengguna.',
    parameters: {
        type: 'object',
        properties: {},
        required: []
    }
};

export async function execute(_, ctx) {
    const imageMessage =
        ctx.msg.message?.imageMessage || ctx.msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;
    const videoMessage =
        ctx.msg.message?.videoMessage || ctx.msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.videoMessage;
    const documentMessage =
        ctx.msg.message?.documentMessage ||
        ctx.msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.documentMessage;

    const isGifDocument =
        documentMessage && (documentMessage.mimetype === 'image/gif' || documentMessage.fileName?.endsWith('.gif'));

    if (!imageMessage && !videoMessage && !isGifDocument) {
        return 'Gagal: Kirim atau reply gambar, video, atau GIF dengan perintah ini.';
    }

    try {
        let buffer;
        let mimeType;
        let ext = 'mp4';

        if (imageMessage) {
            const stream = await downloadContentFromMessage(imageMessage, 'image');
            let chunks = [];
            for await (const chunk of stream) {
                chunks.push(chunk);
            }
            buffer = Buffer.concat(chunks);

            const webpBuffer = await sharp(buffer).resize(512, 512, { fit: 'cover' }).webp({ quality: 80 }).toBuffer();

            await ctx.sock.sendMessage(ctx.jid, { sticker: webpBuffer }, { quoted: ctx.msg });
            return 'Sticker berhasil dibuat dan dikirim.';
        }

        if (videoMessage) {
            const stream = await downloadContentFromMessage(videoMessage, 'video');
            let chunks = [];
            for await (const chunk of stream) {
                chunks.push(chunk);
            }
            buffer = Buffer.concat(chunks);
            mimeType = videoMessage.mimetype || 'video/mp4';
            ext = mimeType.split('/')[1] || 'mp4';
        } else if (isGifDocument) {
            const stream = await downloadContentFromMessage(documentMessage, 'document');
            let chunks = [];
            for await (const chunk of stream) {
                chunks.push(chunk);
            }
            buffer = Buffer.concat(chunks);
            mimeType = 'image/gif';
            ext = 'gif';
        }

        const ffmpegCmd = getFFmpegPath();
        if (ffmpegCmd) {
            const webpBuffer = await convertVideoToSticker(buffer, ext);
            await ctx.sock.sendMessage(ctx.jid, { sticker: webpBuffer }, { quoted: ctx.msg });
            return 'Sticker berhasil dibuat dan dikirim.';
        } else if (mimeType === 'image/gif' || ext === 'gif') {
            const webpBuffer = await convertGifToStickerSharp(buffer);
            await ctx.sock.sendMessage(ctx.jid, { sticker: webpBuffer }, { quoted: ctx.msg });
            return 'Sticker berhasil dibuat dan dikirim.';
        } else {
            return 'Gagal: FFmpeg tidak terinstal di sistem untuk memproses video.';
        }
    } catch (err) {
        console.error(err);
        return 'Gagal: Terjadi kesalahan saat memproses media menjadi stiker.';
    }
}
