import { ToolDefinition, ToolContext } from './types.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import ffmpeg from 'ffmpeg-static';

const execAsync = promisify(exec);

export const definition: ToolDefinition = {
    name: 'ytdl',
    title: 'Video Downloader',
    category: 'Media',
    aliases: ['.ytdl', '.downloadvideo', '.dl'],
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
        return 'Error: Please provide a valid URL for the video, or reply to a message containing the URL.';
    }

    const urlRegex = /(https?:\/\/[^\s]+)/;
    const match = targetUrl.match(urlRegex);
    if (match) {
        targetUrl = match[1];
    } else {
        return 'Error: No valid URL found in the provided text.';
    }

    await ctx.sock.sendMessage(
        ctx.jid,
        { text: '⏳ Initiating the video download process. Please wait...' },
        { quoted: ctx.msg }
    );

    const ytdlpPath = '/usr/local/bin/yt-dlp';
    const storagePath = path.resolve(process.cwd(), 'storage');
    
    if (!fs.existsSync(storagePath)) {
        fs.mkdirSync(storagePath, { recursive: true });
    }

    const timestamp = Date.now();
    const outTemplate = path.join(storagePath, `ytdl_${timestamp}_%(id)s.%(ext)s`);

    try {
        // Limit the filesize to 15MB to ensure it can be sent via WhatsApp.
        const ffmpegLoc = ffmpeg ? `--ffmpeg-location "${ffmpeg}"` : '';
        const command = `"${ytdlpPath}" ${ffmpegLoc} -f "best[filesize<15M]/bestvideo[filesize<10M]+bestaudio/best[filesize<15M]" --merge-output-format mp4 -o "${outTemplate}" "${targetUrl}" --print after_move:filepath`;
        
        const { stdout, stderr } = await execAsync(command);
        // yt-dlp might print multiple lines if multiple files are downloaded, we take the last non-empty line
        const outputLines = stdout.trim().split('\n').filter(line => line.trim() !== '');
        const downloadedFile = outputLines.length > 0 ? outputLines[outputLines.length - 1].trim() : '';

        if (downloadedFile && fs.existsSync(downloadedFile)) {
            await ctx.sock.sendMessage(
                ctx.jid,
                { 
                    video: { url: downloadedFile },
                    caption: '✅ The video has been successfully downloaded.'
                },
                { quoted: ctx.msg }
            );

            // Clean up the temporary file after successfully sending it.
            fs.unlinkSync(downloadedFile);
            return 'The video was successfully downloaded and transmitted to the user.';
        } else {
            console.error('[YTDL Tool] File not found after download.', { stdout, stderr });
            return 'Error: The video file could not be located after the download process.';
        }
    } catch (error: any) {
        console.error('[YTDL Tool] Execution error:', error);
        return `Error: An unexpected issue occurred while downloading the video. Details: ${error.message}`;
    }
}
