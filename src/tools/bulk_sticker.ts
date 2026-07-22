import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { convertVideoToSticker, convertGifToStickerSharp, sendStickerFromBuffer } from './sticker_maker.js';
import { stickerQueue } from '#/utils/stickerQueue.js';
import { ToolDefinition, ToolContext } from './types.js';

export const definition: ToolDefinition = {
    name: 'bulk_sticker',
    aliases: ['.bulksticker', '.bs', '.bulkstiker'],
    description: 'Creates stickers in bulk from a specified local folder.',
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
        return 'Failed: Folder must be located within the bot root directory for security reasons.';
    }

    if (!fs.existsSync(resolvedPath)) {
        // Create folder if it doesn't exist, and notify user
        try {
            fs.mkdirSync(resolvedPath, { recursive: true });
            return `Folder "${folderName}" not found. A new folder has been created; please place image/video files inside it and run this command again.`;
        } catch {
            return `Failed: Folder "${folderName}" was not found and could not be created.`;
        }
    }

    // Read files in folder
    let files: string[];
    try {
        files = fs.readdirSync(resolvedPath);
    } catch (err: any) {
        return `Failed to read folder: ${err.message}`;
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
        return `Folder "${folderName}" is empty or contains no supported media files (${supportedExtensions.join(', ')}).`;
    }

    // Send initial status message
    await ctx.sock.sendMessage(ctx.jid, {
        text: `🚀 Processing ${mediaFiles.length} files from folder "${folderName}"...\n\nPlease wait...`
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
            console.error(`Failed to process ${fileName}:`, err);
        }
    }

    let responseText = `✅ Finished processing bulk stickers!\n\n• Successful: ${successCount}\n• Failed: ${failCount}`;
    if (errors.length > 0) {
        responseText +=
            `\n\nError Details:\n` +
            errors
                .slice(0, 10)
                .map((e) => `- ${e}`)
                .join('\n');
        if (errors.length > 10) {
            responseText += `\n- ...and ${errors.length - 10} other errors.`;
        }
    }

    return responseText;
}
