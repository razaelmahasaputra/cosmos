import { ToolDefinition, ToolContext } from './types.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import ffmpeg from 'ffmpeg-static';

const execAsync = promisify(exec);

export const definition: ToolDefinition = {
    name: 'ytdl',
    title: 'YouTube Downloader',
    category: 'Downloaders',
    aliases: ['.yt', '.ytdl', '.youtube'],
    description: 'Downloads a video from a specified URL using yt-dlp. Currently supports basic video fetching.',
    parameters: {
        type: 'object',
        properties: {
            url: {
                type: 'string',
                description: 'The URL of the video to download.'
            }
        },
        required: ['url']
    }
};

export async function execute(args: Record<string, any>, ctx: ToolContext): Promise<string | void> {
    let targetUrl = args.url;
    const senderJid = ctx.msg.key.participant || ctx.msg.key.remoteJid;

    if (!targetUrl || targetUrl.trim() === '') {
        const quotedMsg = ctx.msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (quotedMsg) {
            const extText = quotedMsg.extendedTextMessage;
            targetUrl = quotedMsg.conversation || 
                        extText?.text || 
                        extText?.matchedText || 
                        quotedMsg.videoMessage?.caption ||
                        quotedMsg.imageMessage?.caption ||
                        '';
        }
    }

    if (!targetUrl) {
        await ctx.sock.sendMessage(ctx.jid, { react: { text: '❌', key: ctx.msg.key } });
        return;
    }

    const urlRegex = /(https?:\/\/[^\s]+)/;
    const match = targetUrl.match(urlRegex);
    if (match) {
        targetUrl = match[1];
    } else {
        await ctx.sock.sendMessage(ctx.jid, { react: { text: '❌', key: ctx.msg.key } });
        return;
    }

    await ctx.sock.sendMessage(
        ctx.jid,
        { react: { text: '⏳', key: ctx.msg.key } }
    );

    const ytdlpPath = '/usr/local/bin/yt-dlp';
    const storagePath = path.resolve(process.cwd(), 'storage');
    
    if (!fs.existsSync(storagePath)) {
        fs.mkdirSync(storagePath, { recursive: true });
    }

    const timestamp = Date.now();
    const outTemplate = path.join(storagePath, `ytdl_${timestamp}_%(id)s.%(ext)s`);

    try {
        const cookiesPath = path.resolve(process.cwd(), 'cookies.txt');
        const cookiesArg = fs.existsSync(cookiesPath) ? `--cookies "${cookiesPath}"` : '';

        // Limit the filesize to 15MB to ensure it can be sent via WhatsApp.
        const ffmpegLoc = ffmpeg ? `--ffmpeg-location "${ffmpeg}"` : '';
        const command = `"${ytdlpPath}" --js-runtimes node ${cookiesArg} ${ffmpegLoc} -f "best[filesize<15M]/bestvideo[filesize<10M]+bestaudio/best[filesize<15M]" --merge-output-format mp4 -o "${outTemplate}" "${targetUrl}" --print after_move:filepath`;
        
        const { stdout, stderr } = await execAsync(command);
        // yt-dlp might print multiple lines if multiple files are downloaded, we take the last non-empty line
        const outputLines = stdout.trim().split('\n').filter(line => line.trim() !== '');
        const downloadedFile = outputLines.length > 0 ? outputLines[outputLines.length - 1].trim() : '';

        if (downloadedFile && fs.existsSync(downloadedFile)) {
            await ctx.sock.sendMessage(
                ctx.jid,
                { 
                    video: { url: downloadedFile },
                    caption: '✅ The video has been successfully downloaded.',
                    mentions: senderJid ? [senderJid] : undefined
                },
                { quoted: ctx.msg }
            );

            // Clean up the temporary file after successfully sending it.
            fs.unlinkSync(downloadedFile);
            await ctx.sock.sendMessage(ctx.jid, { react: { text: '✅', key: ctx.msg.key } });
            return;
        } else {
            console.error('[YTDL Tool] File not found after download.', { stdout, stderr });
            await ctx.sock.sendMessage(ctx.jid, { react: { text: '❌', key: ctx.msg.key } });
            return;
        }
    } catch (error: any) {
        console.error('[YTDL Tool] Execution error:', error);
        await ctx.sock.sendMessage(ctx.jid, { react: { text: '❌', key: ctx.msg.key } });
        return;
    }
}
