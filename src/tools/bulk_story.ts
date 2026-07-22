import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { exec } from 'child_process';
import { promisify } from 'util';
import crypto from 'crypto';
import os from 'os';
import { jidNormalizedUser, WASocket } from '@whiskeysockets/baileys';
import { ToolDefinition, ToolContext } from './types.js';

const execPromise = promisify(exec);

// Deteksi path FFmpeg secara dinamis
let ffmpegStaticPath: string | null = null;
try {
    const ffmpegStatic = await import('ffmpeg-static');
    ffmpegStaticPath = (ffmpegStatic as any).default || ffmpegStatic;
} catch {
    // Platform Android / Termux
}

async function getFFmpegPath(): Promise<string | null> {
    if (ffmpegStaticPath) {
        try {
            await execPromise(`"${ffmpegStaticPath}" -version`);
            return ffmpegStaticPath;
        } catch {
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

async function generateImageThumbnail(imagePath: string): Promise<Buffer | undefined> {
    try {
        const buffer = fs.readFileSync(imagePath);
        return await sharp(buffer).resize(96, 96, { fit: 'cover' }).jpeg({ quality: 50 }).toBuffer();
    } catch (err) {
        console.error('[Bulk Story] Gagal membuat thumbnail gambar:', err);
        return undefined;
    }
}

async function generateVideoThumbnail(videoPath: string, ffmpegCmd: string | null): Promise<Buffer | undefined> {
    if (!ffmpegCmd) return undefined;
    const tempDir = os.tmpdir();
    const outputPath = path.join(tempDir, `temp_thumb_${crypto.randomUUID()}.jpg`);

    try {
        const command = `"${ffmpegCmd}" -y -ss 00:00:01 -i "${videoPath}" -vframes 1 -q:v 5 "${outputPath}"`;
        await execPromise(command);

        if (fs.existsSync(outputPath)) {
            const buffer = fs.readFileSync(outputPath);
            try {
                fs.unlinkSync(outputPath);
            } catch (e: any) {
                console.warn('[Bulk Story] Gagal menghapus file temp:', e.message);
            }

            return await sharp(buffer).resize(96, 96, { fit: 'cover' }).jpeg({ quality: 50 }).toBuffer();
        }
    } catch (err) {
        console.error('[Bulk Story] Gagal membuat thumbnail video:', err);
        try {
            if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
        } catch (e: any) {
            console.warn('[Bulk Story] Gagal menghapus file temp:', e.message);
        }
    }
    return undefined;
}

export const definition: ToolDefinition = {
    name: 'bulk_story',
    aliases: ['.bulkstory', '.bsy', '.bstory', '.bulkstatus'],
    description: 'Uploads images or videos in bulk to WhatsApp Status/Story.',
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

async function getStatusJidList(sock: WASocket, ctx: ToolContext): Promise<string[]> {
    const jids = new Set<string>();

    console.log('[Bulk Story] Debug sock.user:', JSON.stringify(sock.user));
    console.log('[Bulk Story] Debug ctx.msg.key:', JSON.stringify(ctx.msg?.key));

    if (sock.user?.id) {
        jids.add(jidNormalizedUser(sock.user.id));
    }

    if ((sock.user as any)?.lid) {
        jids.add(jidNormalizedUser((sock.user as any).lid));
    }

    if (ctx.jid) {
        jids.add(jidNormalizedUser(ctx.jid));
    }

    if (ctx.msg?.key?.remoteJid) {
        jids.add(jidNormalizedUser(ctx.msg.key.remoteJid));
    }

    if ((ctx.msg?.key as any)?.remoteJidAlt) {
        jids.add(jidNormalizedUser((ctx.msg.key as any).remoteJidAlt));
    }

    const finalJids = Array.from(jids);
    console.log('[Bulk Story] Target statusJidList:', JSON.stringify(finalJids));
    return finalJids;
}

export async function execute(args: Record<string, any>, ctx: ToolContext): Promise<string | void> {
    const argsStr = args.argsStr || '';
    const folderName = argsStr.trim() || 'story';

    let resolvedPath: string;
    if (path.isAbsolute(folderName)) {
        resolvedPath = folderName;
    } else {
        resolvedPath = path.resolve(process.cwd(), folderName);
    }

    if (!fs.existsSync(resolvedPath)) {
        if (!path.isAbsolute(folderName)) {
            try {
                fs.mkdirSync(resolvedPath, { recursive: true });
                return `Folder "${folderName}" not found. A new folder has been created in the bot directory. Please place 3 to 5 image/video files inside it and run this command again.`;
            } catch {
                return `Failed: Folder "${folderName}" was not found and could not be created.`;
            }
        }
        return `Failed: Absolute folder "${folderName}" was not found in local storage.`;
    }

    // Read files in folder
    let files: string[];
    try {
        files = fs.readdirSync(resolvedPath);
    } catch (err: any) {
        return `Failed to read folder: ${err.message}`;
    }

    const supportedExtensions = ['.png', '.jpg', '.jpeg', '.mp4'];
    const mediaFiles = files.filter((file) => {
        const ext = path.extname(file).toLowerCase();
        return supportedExtensions.includes(ext);
    });

    const totalMedia = mediaFiles.length;

    // File count constraint: min 3 and max 5
    if (totalMedia < 3 || totalMedia > 5) {
        return `Failed: The number of media files in the folder must be between 3 and 5 files.\nCurrently found: ${totalMedia} supported files (${supportedExtensions.join(', ')}).`;
    }

    // Check file size limits (Max Video 50MB, Image 10MB)
    const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB
    const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
    const oversizedFiles: string[] = [];

    for (const fileName of mediaFiles) {
        const filePath = path.join(resolvedPath, fileName);
        try {
            const stat = fs.statSync(filePath);
            const ext = path.extname(fileName).toLowerCase();

            if (ext === '.mp4' && stat.size > MAX_VIDEO_SIZE) {
                oversizedFiles.push(`${fileName} (${(stat.size / (1024 * 1024)).toFixed(1)}MB > 50MB)`);
            } else if (['.jpg', '.jpeg', '.png'].includes(ext) && stat.size > MAX_IMAGE_SIZE) {
                oversizedFiles.push(`${fileName} (${(stat.size / (1024 * 1024)).toFixed(1)}MB > 10MB)`);
            }
        } catch (err: any) {
            console.error(`[Bulk Story] Failed to read stat for ${fileName}:`, err.message);
        }
    }

    if (oversizedFiles.length > 0) {
        return `Failed: Files exceeding maximum size limits were found:\n` + oversizedFiles.map((f) => `- ${f}`).join('\n');
    }

    // Read metadata / captions if available
    let captionsMap: Record<string, string> = {};
    const captionsJsonPath = path.join(resolvedPath, 'captions.json');
    const metadataJsonPath = path.join(resolvedPath, 'metadata.json');

    if (fs.existsSync(captionsJsonPath)) {
        try {
            captionsMap = JSON.parse(fs.readFileSync(captionsJsonPath, 'utf-8'));
        } catch (err) {
            console.error('Failed to read captions.json:', err);
        }
    } else if (fs.existsSync(metadataJsonPath)) {
        try {
            captionsMap = JSON.parse(fs.readFileSync(metadataJsonPath, 'utf-8'));
        } catch (err) {
            console.error('Failed to read metadata.json:', err);
        }
    }

    // Collect statusJidList
    const statusInitMsg = await ctx.sock.sendMessage(ctx.jid, {
        text: `⏳ Preparing recipient list for WhatsApp status...`
    });

    const jidList = await getStatusJidList(ctx.sock, ctx);
    if (jidList.length === 0) {
        if (statusInitMsg?.key) {
            await ctx.sock.sendMessage(ctx.jid, {
                text: `❌ Failed: Unable to find recipient contacts for WhatsApp status.`,
                edit: statusInitMsg.key
            });
        }
        return;
    }

    // Send initial status with progress bar
    if (statusInitMsg?.key) {
        await ctx.sock.sendMessage(ctx.jid, {
            text: `🚀 Starting bulk status upload...\n[░░░░░] 0%\n\n• Waiting for the first media item in queue...`,
            edit: statusInitMsg.key
        });
    }

    let successCount = 0;
    let failCount = 0;
    const errors: string[] = [];

    // Detect FFmpeg path before loop starts
    const ffmpegCmd = await getFFmpegPath();

    console.log(`\n[Bulk Story] Starting bulk status upload (${totalMedia} files)`);

    for (let i = 0; i < mediaFiles.length; i++) {
        const fileName = mediaFiles[i];
        const filePath = path.join(resolvedPath, fileName);
        const ext = path.extname(fileName).toLowerCase();

        let fileSizeMB = '0.00';
        try {
            const stat = fs.statSync(filePath);
            fileSizeMB = (stat.size / (1024 * 1024)).toFixed(2);
        } catch (err) {
            console.error(`[Bulk Story] Failed to read stat for ${fileName}:`, err);
        }

        const progressPercent = Math.round((i / totalMedia) * 100);
        const filledBars = Math.round((i / totalMedia) * 5);
        const emptyBars = 5 - filledBars;
        const progressBar = '▓'.repeat(filledBars) + '░'.repeat(emptyBars);

        if (statusInitMsg?.key) {
            await ctx.sock.sendMessage(ctx.jid, {
                text: `⏳ Uploading (${i + 1}/${totalMedia})\n[${progressBar}] ${progressPercent}%\n\n• File: ${fileName} (${fileSizeMB} MB)\n• Status: Uploading media to WhatsApp...`,
                edit: statusInitMsg.key
            });
        }

        const consoleBarBefore = '='.repeat(i) + ' '.repeat(totalMedia - i);
        console.log(
            `[Bulk Story] [${consoleBarBefore}] ${progressPercent}% | Uploading: ${fileName} (${fileSizeMB} MB)...`
        );

        try {
            let caption: string | undefined = undefined;
            if (captionsMap[fileName]) {
                caption = captionsMap[fileName];
            } else {
                const baseName = path.basename(fileName, ext);
                const txtPath = path.join(resolvedPath, `${baseName}.txt`);
                if (fs.existsSync(txtPath)) {
                    try {
                        caption = fs.readFileSync(txtPath, 'utf-8').trim();
                    } catch (err) {
                        console.error(`Failed to read caption file ${baseName}.txt:`, err);
                    }
                }
            }

            let thumbnail: Buffer | undefined = undefined;
            if (ext === '.mp4') {
                thumbnail = await generateVideoThumbnail(filePath, ffmpegCmd);
            } else if (['.jpg', '.jpeg', '.png'].includes(ext)) {
                thumbnail = await generateImageThumbnail(filePath);
            }

            const mediaType = ext === '.mp4' ? 'video' : 'image';
            const messageContent: Record<string, any> = {};

            const mimeType = ext === '.mp4' ? 'video/mp4' : ext === '.png' ? 'image/png' : 'image/jpeg';

            messageContent[mediaType] = { url: filePath };
            messageContent.mimetype = mimeType;

            if (caption) {
                messageContent.caption = caption;
            }
            if (thumbnail) {
                messageContent.jpegThumbnail = thumbnail;
            }

            await ctx.sock.sendMessage('status@broadcast', messageContent as any, {
                statusJidList: jidList,
                broadcast: true
            });

            successCount++;
        } catch (err: any) {
            failCount++;
            errors.push(`${fileName}: ${err.message}`);
            console.error(`[Bulk Story] Failed to upload status for ${fileName}:`, err);
        }

        const currentPercent = Math.round(((i + 1) / totalMedia) * 100);
        const currentFilled = Math.round(((i + 1) / totalMedia) * 5);
        const currentEmpty = 5 - currentFilled;
        const currentBar = '▓'.repeat(currentFilled) + '░'.repeat(currentEmpty);

        if (statusInitMsg?.key) {
            await ctx.sock.sendMessage(ctx.jid, {
                text: `⏳ Upload progress (${i + 1}/${totalMedia})\n[${currentBar}] ${currentPercent}%\n\n• Successful: ${successCount}\n• Failed: ${failCount}`,
                edit: statusInitMsg.key
            });
        }

        const consoleBarAfter = '='.repeat(i + 1) + ' '.repeat(totalMedia - (i + 1));
        console.log(`[Bulk Story] [${consoleBarAfter}] ${currentPercent}% | Finished: ${fileName} (${fileSizeMB} MB)`);

        if (i < mediaFiles.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 15000));
        }
    }

    let responseText = `✅ Finished processing bulk status upload!\n\n• Successful: ${successCount}\n• Failed: ${failCount}`;
    if (errors.length > 0) {
        responseText += `\n\nError Details:\n` + errors.map((e) => `- ${e}`).join('\n');
    }

    console.log(`[Bulk Story] Completed: Successful ${successCount}, Failed ${failCount}\n`);

    if (statusInitMsg?.key) {
        await ctx.sock.sendMessage(ctx.jid, {
            text: responseText,
            edit: statusInitMsg.key
        });
    }

    return;
}
