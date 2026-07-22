import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { convertVideoToSticker, convertGifToStickerSharp, sendStickerFromBuffer } from './sticker_maker.js';
import { stickerQueue } from '#/utils/stickerQueue.js';
import { ToolDefinition, ToolContext } from './types.js';

export const definition: ToolDefinition = {
    name: 'bulk_sticker',
    aliases: ['.bulksticker', '.bs', '.bulkstiker'],
    description: 'Membuat stiker secara massal dari sebuah folder.',
    owner: true,
    parameters: {
        type: 'object',
        properties: {
            argsStr: {
                type: 'string',
                description: 'Format: [targetFolder]'
            }
        },
        required: []
    }
};

export async function execute(args: Record<string, any>, ctx: ToolContext): Promise<string> {
    const argsStr = args.argsStr || '';

    // Parse arguments
    const folderName = argsStr.trim() || 'sticker';

    const resolvedPath = path.resolve(process.cwd(), folderName);
    if (!resolvedPath.startsWith(process.cwd())) {
        return 'Gagal: Folder harus berada di dalam direktori bot untuk alasan keamanan.';
    }

    if (!fs.existsSync(resolvedPath)) {
        // Let's create it if it doesn't exist, and notify the user to put files in it
        try {
            fs.mkdirSync(resolvedPath, { recursive: true });
            return `Folder "${folderName}" tidak ditemukan. Folder baru telah dibuat, silakan letakkan file gambar/video di dalamnya dan jalankan kembali perintah ini.`;
        } catch {
            return `Gagal: Folder "${folderName}" tidak ditemukan dan tidak dapat dibuat.`;
        }
    }

    // Read files in folder
    let files: string[];
    try {
        files = fs.readdirSync(resolvedPath);
    } catch (err: any) {
        return `Gagal membaca folder: ${err.message}`;
    }

    const supportedExtensions = [
        '.png',
        '.jpg',
        '.jpeg',
        '.mp4',
        '.mkv',
        '.gif',
        '.webp',
        '.mov',
        '.webm',
        '.avi',
        '.3gp'
    ];
    const mediaFiles = files.filter((file) => {
        const ext = path.extname(file).toLowerCase();
        return supportedExtensions.includes(ext);
    });

    if (mediaFiles.length === 0) {
        return `Folder "${folderName}" kosong atau tidak berisi file media yang didukung (${supportedExtensions.join(', ')}).`;
    }

    // Send initial status message
    await ctx.sock.sendMessage(ctx.jid, {
        text: `🚀 Memproses ${mediaFiles.length} file dari folder "${folderName}"...\n\nMohon tunggu sebentar...`
    });

    let successCount = 0;
    let failCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < mediaFiles.length; i++) {
        const fileName = mediaFiles[i];
        const filePath = path.join(resolvedPath, fileName);
        const ext = path.extname(fileName).toLowerCase();

        try {
            await stickerQueue.add(async () => {
                const buffer = fs.readFileSync(filePath);
                let webpBuffer: Buffer;

                if (ext === '.webp') {
                    // If already webp, just use it
                    webpBuffer = buffer;
                } else if (['.png', '.jpg', '.jpeg'].includes(ext)) {
                    // Static image conversion
                    webpBuffer = await sharp(buffer)
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
                } else {
                    // Video / GIF animated conversion
                    const format = ext.slice(1); // remove dot
                    try {
                        webpBuffer = await convertVideoToSticker(buffer, format);
                    } catch (videoErr) {
                        if (ext === '.gif') {
                            webpBuffer = await convertGifToStickerSharp(buffer);
                        } else {
                            throw videoErr;
                        }
                    }
                }

                // Send the sticker
                await sendStickerFromBuffer(ctx.sock, ctx.jid, webpBuffer, null);
            });
            successCount++;

            // Add a small delay between sending to avoid WhatsApp rate limiting or ordering issues
            if (i < mediaFiles.length - 1) {
                await new Promise((resolve) => setTimeout(resolve, 1500));
            }
        } catch (err: any) {
            failCount++;
            errors.push(`${fileName}: ${err.message}`);
            console.error(`Gagal memproses ${fileName}:`, err);
        }
    }

    let responseText = `✅ Selesai memproses bulk sticker!\n\n• Berhasil: ${successCount}\n• Gagal: ${failCount}`;
    if (errors.length > 0) {
        responseText +=
            `\n\nDetail Error:\n` +
            errors
                .slice(0, 10)
                .map((e) => `- ${e}`)
                .join('\n');
        if (errors.length > 10) {
            responseText += `\n- ...dan ${errors.length - 10} error lainnya.`;
        }
    }

    return responseText;
}
