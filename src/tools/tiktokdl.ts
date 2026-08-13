import { ToolDefinition, ToolContext } from './types.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';

const execAsync = promisify(exec);

export const definition: ToolDefinition = {
    name: 'tiktokdl',
    title: 'TikTok Downloader',
    category: 'Media',
    aliases: ['.ttdl', '.tiktok', '.tt'],
    description: 'Downloads a video from a specified TikTok URL using cookies.txt.',
    parameters: {
        type: 'object',
        properties: {
            url: {
                type: 'string',
                description: 'The URL of the TikTok video to download.'
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
        return 'Error: Please provide a valid TikTok URL, or reply to a message containing the URL.';
    }

    const urlRegex = /(https?:\/\/[^\s]+)/;
    const match = targetUrl.match(urlRegex);
    if (match) {
        targetUrl = match[1];
    } else {
        return 'Error: No valid URL found in the provided text.';
    }

    if (targetUrl.includes('vt.tiktok.com') || targetUrl.includes('vm.tiktok.com')) {
        try {
            const res = await fetch(targetUrl, { redirect: 'follow' });
            targetUrl = res.url;
        } catch (e) {
            console.error('[TikTokDL Tool] Failed to resolve shortlink:', e);
        }
    }
    
    targetUrl = targetUrl.replace(/\/photo\//g, '/video/');

    await ctx.sock.sendMessage(
        ctx.jid,
        { text: '⏳ Initiating TikTok video download process. Please wait...' },
        { quoted: ctx.msg }
    );

    const ytdlpPath = 'python3 -m yt_dlp';
    const storagePath = path.resolve(process.cwd(), 'storage');
    const cookiesPath = path.resolve(process.cwd(), 'cookies.txt');
    
    if (!fs.existsSync(storagePath)) {
        fs.mkdirSync(storagePath, { recursive: true });
    }

    const timestamp = Date.now();
    const outTemplate = path.join(storagePath, `tiktok_${timestamp}_%(id)s.%(ext)s`);

    try {
        let cookiesFlag = '';
        if (fs.existsSync(cookiesPath)) {
            cookiesFlag = `--cookies "${cookiesPath}"`;
        } else {
            console.warn('[TikTokDL Tool] cookies.txt not found in the root directory. Download might fail or yield restricted results.');
        }

        const ffmpegLoc = '--ffmpeg-location "/usr/bin/ffmpeg"';
        const command = `${ytdlpPath} ${ffmpegLoc} ${cookiesFlag} -f "best[filesize<15M]/bestvideo[filesize<10M]+bestaudio/best" --merge-output-format mp4 -o "${outTemplate}" "${targetUrl}" --print after_move:filepath`;
        
        const { stdout, stderr } = await execAsync(command);
        const outputLines = stdout.trim().split('\n').filter(line => line.trim() !== '');
        
        const downloadedFiles = outputLines.map(l => l.trim()).filter(line => fs.existsSync(line));

        if (downloadedFiles.length > 0) {
            let images = downloadedFiles.filter(f => ['.jpg', '.jpeg', '.png', '.webp'].includes(path.extname(f).toLowerCase()));
            let audios = downloadedFiles.filter(f => ['.mp3', '.m4a', '.aac', '.wav'].includes(path.extname(f).toLowerCase()));
            const videos = downloadedFiles.filter(f => ['.mp4', '.webm', '.mkv', '.mov'].includes(path.extname(f).toLowerCase()));
            const others = downloadedFiles.filter(f => !images.includes(f) && !audios.includes(f) && !videos.includes(f));

            if (images.length > 0 && audios.length > 0) {
                const audioFile = audios[0];
                const outputVideo = path.join(storagePath, `slideshow_${timestamp}.mp4`);
                try {
                    let filterComplex = '';
                    let inputs = '';
                    const targetImages = images.slice(0, 35);
                    for (let i = 0; i < targetImages.length; i++) {
                        if (i === targetImages.length - 1) {
                            inputs += `-loop 1 -i "${targetImages[i]}" `;
                        } else {
                            inputs += `-loop 1 -t 3 -i "${targetImages[i]}" `;
                        }
                        filterComplex += `[${i}:v]scale=854:480:force_original_aspect_ratio=decrease,pad=854:480:(ow-iw)/2:(oh-ih)/2,setsar=1,format=yuv420p[v${i}];`;
                    }
                    inputs += `-i "${audioFile}" `;

                    if (targetImages.length > 1) {
                        let concatStr = '';
                        for (let i = 0; i < targetImages.length; i++) {
                            concatStr += `[v${i}]`;
                        }
                        filterComplex += `${concatStr}concat=n=${targetImages.length}:v=1:a=0[outv]`;
                    } else {
                        filterComplex = filterComplex.replace('[v0];', '[outv]');
                    }

                    const audioIdx = targetImages.length;
                    const ffmpegCommand = `"/usr/bin/ffmpeg" ${inputs} -filter_complex "${filterComplex}" -map "[outv]" -map ${audioIdx}:a -c:v libx264 -preset fast -crf 28 -c:a aac -b:a 128k -shortest -y "${outputVideo}"`;
                    await execAsync(ffmpegCommand);

                    await ctx.sock.sendMessage(
                        ctx.jid,
                        { video: { url: outputVideo }, caption: '✅ TikTok Slideshow' },
                        { quoted: ctx.msg }
                    );
                    fs.unlinkSync(outputVideo);
                    images.forEach(img => fs.existsSync(img) && fs.unlinkSync(img));
                    audios.forEach(aud => fs.existsSync(aud) && fs.unlinkSync(aud));
                    
                    images = [];
                    audios = [];
                } catch (ffmpegErr) {
                    console.error('[TikTokDL Tool] Slideshow combine error:', ffmpegErr);
                }
            }

            const remainingFiles = [...videos, ...images, ...audios, ...others];
            let processedCount = 0;
            for (const file of remainingFiles) {
                if (!fs.existsSync(file)) continue;
                const ext = path.extname(file).toLowerCase();
                
                if (['.mp4', '.webm', '.mkv', '.mov'].includes(ext)) {
                    const compressedFile = path.join(storagePath, `compressed_${timestamp}_${processedCount}.mp4`);
                    try {
                        const ffmpegCommand = `"/usr/bin/ffmpeg" -i "${file}" -vf "scale='min(854,iw)':'min(480,ih)'" -c:v libx264 -preset fast -crf 28 -c:a aac -b:a 128k -y "${compressedFile}"`;
                        await execAsync(ffmpegCommand);
                        await ctx.sock.sendMessage(
                            ctx.jid,
                            { video: { url: compressedFile }, caption: '✅ TikTok Video' },
                            { quoted: ctx.msg }
                        );
                        fs.unlinkSync(file);
                        if (fs.existsSync(compressedFile)) fs.unlinkSync(compressedFile);
                    } catch (ffmpegErr: any) {
                        console.error('[TikTokDL Tool] FFmpeg compression error:', ffmpegErr);
                        await ctx.sock.sendMessage(
                            ctx.jid,
                            { video: { url: file }, caption: '✅ TikTok Video (compression skipped)' },
                            { quoted: ctx.msg }
                        );
                        fs.unlinkSync(file);
                        if (fs.existsSync(compressedFile)) fs.unlinkSync(compressedFile);
                    }
                } else if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
                    await ctx.sock.sendMessage(
                        ctx.jid,
                        { image: { url: file } },
                        { quoted: ctx.msg }
                    );
                    fs.unlinkSync(file);
                } else if (['.mp3', '.m4a', '.aac', '.wav'].includes(ext)) {
                    await ctx.sock.sendMessage(
                        ctx.jid,
                        { audio: { url: file }, mimetype: 'audio/mp4' },
                        { quoted: ctx.msg }
                    );
                    fs.unlinkSync(file);
                } else {
                    await ctx.sock.sendMessage(
                        ctx.jid,
                        { document: { url: file }, mimetype: 'application/octet-stream', fileName: path.basename(file) },
                        { quoted: ctx.msg }
                    );
                    fs.unlinkSync(file);
                }
                processedCount++;
            }
            return 'The TikTok media was successfully downloaded and transmitted to the user.';
        } else {
            console.error('[TikTokDL Tool] File not found after download.', { stdout, stderr });
            return 'Error: The media files could not be located after the download process.';
        }
    } catch (error: any) {
        console.error('[TikTokDL Tool] Execution error:', error);
        
        let userMessage = 'Error: The TikTok media could not be downloaded. It may be private, age-restricted, or deleted.';
        if (error.message) {
            if (error.message.includes('403: Forbidden')) {
                userMessage = 'Error: Download blocked by TikTok (403 Forbidden). This usually happens if the video is restricted or the cookies are expired.';
            } else if (error.message.includes('Unsupported URL')) {
                userMessage = 'Error: The provided URL format is not supported.';
            }
        }
        
        return userMessage;
    }
}
