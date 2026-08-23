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
        const baseCommand = `"${ytdlpPath}" --js-runtimes node ${cookiesArg} ${ffmpegLoc}`;
        
        let downloadedVideo = '';
        try {
            const vidCommand = `${baseCommand} -f "best[filesize<15M]/bestvideo[filesize<10M]+bestaudio/best[filesize<15M]" --merge-output-format mp4 -o "${outTemplate}" "${targetUrl}" --print after_move:filepath`;
            const { stdout } = await execAsync(vidCommand);
            const outputLines = stdout.trim().split('\n').filter(line => line.trim() !== '');
            downloadedVideo = outputLines.length > 0 ? outputLines[outputLines.length - 1].trim() : '';
        } catch (e) {
            console.error('[YTDL Tool] Video download failed:', e);
        }

        let downloadedAudio = '';
        if (downloadedVideo && fs.existsSync(downloadedVideo)) {
            const audioOut = path.join(storagePath, `ytdl_${timestamp}_audio.mp3`);
            try {
                const ffmpegCmd = ffmpeg ? `"${ffmpeg}"` : 'ffmpeg';
                await execAsync(`${ffmpegCmd} -i "${downloadedVideo}" -q:a 0 -map a "${audioOut}" -y`);
                if (fs.existsSync(audioOut)) {
                    downloadedAudio = audioOut;
                }
            } catch (e) {
                console.error('[YTDL Tool] Audio extraction failed:', e);
            }
        } else {
            try {
                const audTemplate = path.join(storagePath, `ytdl_${timestamp}_audio.%(ext)s`);
                const audCommand = `${baseCommand} -f "bestaudio[filesize<15M]/bestaudio" --extract-audio --audio-format mp3 -o "${audTemplate}" "${targetUrl}" --print after_move:filepath`;
                const { stdout } = await execAsync(audCommand);
                const outputLines = stdout.trim().split('\n').filter(line => line.trim() !== '');
                const file = outputLines.length > 0 ? outputLines[outputLines.length - 1].trim() : '';
                if (file && fs.existsSync(file)) downloadedAudio = file;
            } catch (e) {
                console.error('[YTDL Tool] Audio download failed:', e);
            }
        }

        if (!downloadedVideo && !downloadedAudio) {
            await ctx.sock.sendMessage(ctx.jid, { react: { text: '❌', key: ctx.msg.key } });
            return;
        }

        if (downloadedVideo && fs.existsSync(downloadedVideo)) {
            await ctx.sock.sendMessage(
                ctx.jid,
                { 
                    video: { url: downloadedVideo },
                    caption: '✅ The video has been successfully downloaded.',
                    mentions: senderJid ? [senderJid] : undefined
                },
                { quoted: ctx.msg }
            );
            fs.unlinkSync(downloadedVideo);
        }

        if (downloadedAudio && fs.existsSync(downloadedAudio)) {
            await ctx.sock.sendMessage(
                ctx.jid,
                { 
                    audio: { url: downloadedAudio },
                    mimetype: 'audio/mpeg',
                    mentions: senderJid ? [senderJid] : undefined
                },
                { quoted: ctx.msg }
            );
            fs.unlinkSync(downloadedAudio);
        }

        await ctx.sock.sendMessage(ctx.jid, { react: { text: '✅', key: ctx.msg.key } });
        return;
    } catch (error: any) {
        console.error('[YTDL Tool] Execution error:', error);
        await ctx.sock.sendMessage(ctx.jid, { react: { text: '❌', key: ctx.msg.key } });
        return;
    }
}
