import { ToolDefinition, ToolContext } from './types.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import ffmpeg from 'ffmpeg-static';

const execAsync = promisify(exec);

const TELEGRAM_HOSTS = ['t.me', 'telegram.me', 'telegram.dog'];

function resolveYtDlpPath(): string {
    const candidates = ['/usr/local/bin/yt-dlp', path.resolve(process.cwd(), 'yt-dlp')];
    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) return candidate;
    }
    return 'yt-dlp';
}

function extractTelegramUrl(text: string): string | null {
    const urlRegex = /https?:\/\/[^\s]+/g;
    const matches = text.match(urlRegex);
    if (!matches) return null;
    for (const rawUrl of matches) {
        try {
            const hostname = new URL(rawUrl).hostname.toLowerCase();
            if (TELEGRAM_HOSTS.includes(hostname)) {
                return rawUrl;
            }
        } catch {
            continue;
        }
    }
    return null;
}

export const definition: ToolDefinition = {
    name: 'telegramdl',
    title: 'Telegram Downloader',
    category: 'Downloaders',
    aliases: ['.tg', '.tgdl', '.tele', '.telegram'],
    description:
        'Downloads a video from a public Telegram post link (t.me) using yt-dlp and sends it as a video.',
    parameters: {
        type: 'object',
        properties: {
            url: {
                type: 'string',
                description: 'The URL of the public Telegram video post to download.'
            }
        },
        required: ['url']
    }
};

export async function execute(args: Record<string, any>, ctx: ToolContext): Promise<string | void> {
    let targetText = args.url;
    const senderJid = ctx.msg.key.participant || ctx.msg.key.remoteJid;

    if (!targetText || targetText.trim() === '') {
        const quotedMsg = ctx.msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (quotedMsg) {
            const extText = quotedMsg.extendedTextMessage;
            targetText =
                quotedMsg.conversation ||
                extText?.text ||
                extText?.matchedText ||
                quotedMsg.videoMessage?.caption ||
                quotedMsg.imageMessage?.caption ||
                '';
        }
    }

    if (!targetText || targetText.trim() === '') {
        await ctx.sock.sendMessage(ctx.jid, { react: { text: '❌', key: ctx.msg.key } });
        return;
    }

    const telegramUrl = extractTelegramUrl(targetText);
    if (!telegramUrl) {
        await ctx.sock.sendMessage(ctx.jid, { react: { text: '❌', key: ctx.msg.key } });
        return 'Error: Please provide a valid public Telegram post link (for example https://t.me/channel/123).';
    }

    await ctx.sock.sendMessage(ctx.jid, { react: { text: '⏳', key: ctx.msg.key } });

    const storagePath = path.resolve(process.cwd(), 'storage');
    if (!fs.existsSync(storagePath)) {
        fs.mkdirSync(storagePath, { recursive: true });
    }

    const timestamp = Date.now();
    const outTemplate = path.join(storagePath, `telegramdl_${timestamp}_%(id)s.%(ext)s`);

    try {
        // Telegram media is exposed as a single format without size metadata, so the
        // 15MB WhatsApp limit is enforced by checking the downloaded file afterwards.
        const ffmpegLoc = ffmpeg ? `--ffmpeg-location "${ffmpeg}"` : '';
        const command = `"${resolveYtDlpPath()}" ${ffmpegLoc} -f "best" --merge-output-format mp4 -o "${outTemplate}" "${telegramUrl}" --print after_move:filepath`;

        const { stdout, stderr } = await execAsync(command);
        // yt-dlp might print multiple lines if multiple files are downloaded, we take the last non-empty line.
        const outputLines = stdout.trim().split('\n').filter((line) => line.trim() !== '');
        const downloadedFile = outputLines.length > 0 ? outputLines[outputLines.length - 1].trim() : '';

        if (downloadedFile && fs.existsSync(downloadedFile)) {
            if (fs.statSync(downloadedFile).size > 15 * 1024 * 1024) {
                console.error('[TelegramDL Tool] Downloaded video exceeds the 15MB limit.');
                fs.unlinkSync(downloadedFile);
                await ctx.sock.sendMessage(ctx.jid, { react: { text: '❌', key: ctx.msg.key } });
                return 'Error: The Telegram video exceeds the 15MB size limit and cannot be sent via WhatsApp.';
            }

            await ctx.sock.sendMessage(
                ctx.jid,
                {
                    video: { url: downloadedFile },
                    caption: '✅ The Telegram video has been successfully downloaded.',
                    mentions: senderJid ? [senderJid] : undefined
                },
                { quoted: ctx.msg }
            );

            fs.unlinkSync(downloadedFile);
            await ctx.sock.sendMessage(ctx.jid, { react: { text: '✅', key: ctx.msg.key } });
            return;
        }

        console.error('[TelegramDL Tool] File not found after download.', { stdout, stderr });
        await ctx.sock.sendMessage(ctx.jid, { react: { text: '❌', key: ctx.msg.key } });
        return 'Error: The media could not be retrieved. Please ensure the Telegram post contains a supported video.';
    } catch (error: any) {
        console.error('[TelegramDL Tool] Execution error:', error);
        await ctx.sock.sendMessage(ctx.jid, { react: { text: '❌', key: ctx.msg.key } });
        return 'Error: An unexpected issue occurred while downloading the Telegram video.';
    }
}
