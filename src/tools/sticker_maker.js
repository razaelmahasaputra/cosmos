import sharp from 'sharp';
import { downloadContentFromMessage } from '@whiskeysockets/baileys';
import { writeLog } from '#/logger.js';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import crypto from 'crypto';
import { stickerQueue } from '#/utils/stickerQueue.js';

const execPromise = promisify(exec);

// Try to dynamically load ffmpeg-static if available
let ffmpegStaticPath = null;
try {
    const ffmpegStatic = await import('ffmpeg-static');
    ffmpegStaticPath = ffmpegStatic.default || ffmpegStatic;
} catch {
    // Not available on this platform (e.g., Termux/Android)
}

async function getFFmpegPath() {
    if (ffmpegStaticPath) {
        try {
            await execPromise(`"${ffmpegStaticPath}" -version`);
            return ffmpegStaticPath;
        } catch {
            // ffmpeg-static failed to execute (e.g., glibc vs bionic ABI mismatch on Termux)
            ffmpegStaticPath = null;
        }
    }
    try {
        await execPromise('ffmpeg -version');
        return 'ffmpeg';
    } catch {
        const termuxPath = '/data/data/com.termux/files/usr/bin/ffmpeg';
        try {
            await execPromise(`"${termuxPath}" -version`);
            return termuxPath;
        } catch {
            return null;
        }
    }
}

const ALLOWED_FORMATS = ['mp4', 'gif', 'mov', 'webm', 'avi', 'mkv', '3gp'];
const FORMAT_REGEX = /^[a-zA-Z0-9]+$/;

export async function convertVideoToSticker(buffer, format) {
    if (!FORMAT_REGEX.test(format) || !ALLOWED_FORMATS.includes(format.toLowerCase())) {
        throw new Error('Format media tidak didukung atau tidak valid.');
    }

    const tempDir = os.tmpdir();
    const inputPath = path.join(tempDir, `temp_sticker_in_${crypto.randomUUID()}.${format}`);

    try {
        await fs.promises.writeFile(inputPath, buffer);
        const ffmpegCmd = await getFFmpegPath();
        if (!ffmpegCmd) {
            throw new Error('FFmpeg tidak ditemukan di sistem.');
        }

        const qualities = [65, 40, 25];
        let outputBuffer = null;

        for (const q of qualities) {
            const outputPath = path.join(tempDir, `temp_sticker_out_${crypto.randomUUID()}.webp`);
            try {
                // Convert to animated webp: 512x512 crop/scale, max 5s, 12fps, loop infinitely, set quality
                const command = `"${ffmpegCmd}" -y -i "${inputPath}" -t 5 -vcodec libwebp -filter_complex "scale=512:512:force_original_aspect_ratio=increase,crop=512:512,fps=12" -loop 0 -preset default -an -vsync 0 -q:v ${q} "${outputPath}"`;
                await execPromise(command);
                const fileBuffer = await fs.promises.readFile(outputPath);

                if (fileBuffer.length <= 500 * 1024 || q === qualities[qualities.length - 1]) {
                    outputBuffer = fileBuffer;
                    break;
                }
            } catch (err) {
                console.error(`Error encoding at quality ${q}:`, err);
            } finally {
                try {
                    if (fs.existsSync(outputPath)) await fs.promises.unlink(outputPath);
                } catch {
                    // Ignore unlinking errors
                }
            }
        }

        if (!outputBuffer) {
            throw new Error('Gagal memproses video menjadi stiker.');
        }

        return outputBuffer;
    } finally {
        try {
            if (fs.existsSync(inputPath)) await fs.promises.unlink(inputPath);
        } catch (e) {
            console.error('Gagal menghapus file temporary:', e);
        }
    }
}

export async function convertGifToStickerSharp(buffer) {
    let quality = 70;
    let webpBuffer = await sharp(buffer, { animated: true })
        .resize(512, 512, { fit: 'cover' })
        .webp({ effort: 6, quality })
        .toBuffer();

    if (webpBuffer.length > 500 * 1024) {
        webpBuffer = await sharp(buffer, { animated: true })
            .resize(512, 512, { fit: 'cover' })
            .webp({ effort: 6, quality: 40 })
            .toBuffer();
    }
    return webpBuffer;
}

/**
 * Send a WebP sticker buffer directly to WhatsApp and cache for retry decryption.
 */
export async function sendStickerFromBuffer(sock, jid, webpBuffer, quotedMsg) {
    // Validate WebP header (RIFF....WEBP)
    if (webpBuffer.length < 12) {
        throw new Error(`Buffer terlalu kecil (${webpBuffer.length} bytes), bukan file WebP valid.`);
    }
    const riffHeader = webpBuffer.slice(0, 4).toString('ascii');
    const webpMagic = webpBuffer.slice(8, 12).toString('ascii');
    if (riffHeader !== 'RIFF' || webpMagic !== 'WEBP') {
        throw new Error(`Buffer bukan format WebP valid. Header: ${riffHeader}, Magic: ${webpMagic}`);
    }

    console.log(`[Sticker] WebP buffer valid, size: ${webpBuffer.length} bytes`);

    // Send sticker
    const sentMsg = await sock.sendMessage(jid, { sticker: webpBuffer }, { quoted: quotedMsg });

    console.log('[Sticker] sendMessage result key:', JSON.stringify(sentMsg?.key));
    if (sentMsg?.message?.stickerMessage) {
        const sm = sentMsg.message.stickerMessage;
        console.log(
            '[Sticker] stickerMessage details:',
            JSON.stringify({
                url: sm.url,
                directPath: sm.directPath,
                mediaKeyPresent: !!sm.mediaKey,
                fileSha256Present: !!sm.fileSha256,
                fileLength: sm.fileLength,
                mimetype: sm.mimetype
            })
        );
    }

    // Cache for getMessage retry callback
    if (sentMsg?.key?.id && sentMsg?.message) {
        const { cacheMessage } = await import('#/utils/messageCache.js');
        cacheMessage(sentMsg);
        console.log('[Sticker] Sent message cached for retry decryption, id:', sentMsg.key.id);
    }

    return sentMsg;
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
    const getMessage = (m) => {
        if (!m) return { msg: null, isViewOnce: false };
        if (m.viewOnceMessage?.message) {
            const res = getMessage(m.viewOnceMessage.message);
            return { msg: res.msg, isViewOnce: true };
        }
        if (m.viewOnceMessageV2?.message) {
            const res = getMessage(m.viewOnceMessageV2.message);
            return { msg: res.msg, isViewOnce: true };
        }
        if (m.viewOnceMessageV2Extension?.message) {
            const res = getMessage(m.viewOnceMessageV2Extension.message);
            return { msg: res.msg, isViewOnce: true };
        }
        return { msg: m, isViewOnce: false };
    };

    const direct = getMessage(ctx.msg.message);
    const quoted = getMessage(ctx.msg.message?.extendedTextMessage?.contextInfo?.quotedMessage);

    const directMsg = direct.msg;
    const quotedMsg = quoted.msg;
    const isViewOnce = direct.isViewOnce || quoted.isViewOnce;

    if (isViewOnce) {
        console.log('[Sticker Maker] Mendeteksi media View Once.');
    }

    const imageMessage = directMsg?.imageMessage || quotedMsg?.imageMessage;
    const videoMessage = directMsg?.videoMessage || quotedMsg?.videoMessage;
    const documentMessage = directMsg?.documentMessage || quotedMsg?.documentMessage;

    const isGifDocument =
        documentMessage && (documentMessage.mimetype === 'image/gif' || documentMessage.fileName?.endsWith('.gif'));

    if (!imageMessage && !videoMessage && !isGifDocument) {
        return 'Gagal: Kirim atau reply gambar, video, atau GIF dengan perintah ini.';
    }

    return stickerQueue.add(async () => {
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

                let webpBuffer = await sharp(buffer)
                    .resize(512, 512, { fit: 'cover' })
                    .webp({ quality: 80 })
                    .toBuffer();

                if (webpBuffer.length > 100 * 1024) {
                    webpBuffer = await sharp(buffer)
                        .resize(512, 512, { fit: 'cover' })
                        .webp({ quality: 50 })
                        .toBuffer();
                }
                if (webpBuffer.length > 100 * 1024) {
                    webpBuffer = await sharp(buffer)
                        .resize(512, 512, { fit: 'cover' })
                        .webp({ quality: 30 })
                        .toBuffer();
                }

                await sendStickerFromBuffer(ctx.sock, ctx.jid, webpBuffer, ctx.msg);
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

            if (ext) {
                ext = ext.split(';')[0].trim();
            }

            const ffmpegCmd = await getFFmpegPath();
            if (ffmpegCmd) {
                const webpBuffer = await convertVideoToSticker(buffer, ext);
                await sendStickerFromBuffer(ctx.sock, ctx.jid, webpBuffer, ctx.msg);
                return 'Sticker berhasil dibuat dan dikirim.';
            } else if (mimeType === 'image/gif' || ext === 'gif') {
                const webpBuffer = await convertGifToStickerSharp(buffer);
                await sendStickerFromBuffer(ctx.sock, ctx.jid, webpBuffer, ctx.msg);
                return 'Sticker berhasil dibuat dan dikirim.';
            } else {
                return 'Gagal: FFmpeg tidak terinstal di sistem untuk memproses video.';
            }
        } catch (err) {
            console.error(err);
            writeLog('ERROR', 'Error in sticker_maker tool execution', err);
            return `Gagal: Terjadi kesalahan saat memproses media menjadi stiker. Detail: ${err.message}`;
        }
    });
}
