import { ToolDefinition, ToolContext } from './types.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import axios from 'axios';

const execAsync = promisify(exec);

export const definition: ToolDefinition = {
    name: 'tiktokdl',
    title: 'TikTok Downloader',
    category: 'Downloaders',
    aliases: ['.tiktok', '.tt', '.tiktokdl', '.ttdl'],
    description: 'Downloads a video from a specified TikTok URL.',
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

    if (targetUrl.includes('vt.tiktok.com') || targetUrl.includes('vm.tiktok.com')) {
        try {
            const res = await fetch(targetUrl, { redirect: 'follow', signal: AbortSignal.timeout(10000) });
            targetUrl = res.url;
        } catch (e) {
            console.error('[TikTokDL Tool] Failed to resolve shortlink:', e);
        }
    }
    
    targetUrl = targetUrl.replace(/\/photo\//g, '/video/');

    const storagePath = path.resolve(process.cwd(), 'storage');
    
    if (!fs.existsSync(storagePath)) {
        fs.mkdirSync(storagePath, { recursive: true });
    }

    const timestamp = Date.now();

    try {
        const downloadedFiles: string[] = [];

        const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(targetUrl)}`;
        const res = await axios.get(apiUrl, { timeout: 15000 });
        if (res.data.code !== 0 || !res.data.data) {
            throw new Error(`tikwm API error: ${res.data.msg || 'Unknown error'}`);
        }

        const data = res.data.data;
        let baseCaption = data.title || '';
        if (baseCaption.length > 900) {
            baseCaption = baseCaption.substring(0, 900) + '...';
        }

        const slideshowCaption = baseCaption ? baseCaption : '';
        const videoCaption = baseCaption ? baseCaption : '';
        const videoCaptionSkipped = baseCaption ? `${baseCaption}\n(Compression skipped)` : '(Compression skipped)';

        const downloadFile = async (url: string, ext: string, index: string = ''): Promise<string> => {
            const filepath = path.join(storagePath, `tiktok_${timestamp}_${index}${ext}`);
            const writer = fs.createWriteStream(filepath);
            const response = await axios({
                url,
                method: 'GET',
                responseType: 'stream'
            });
            response.data.pipe(writer);
            return new Promise((resolve, reject) => {
                writer.on('finish', () => resolve(filepath));
                writer.on('error', reject);
            });
        };

        if (data.images && data.images.length > 0) {
            for (let i = 0; i < data.images.length; i++) {
                const imgPath = await downloadFile(data.images[i], '.jpg', `img_${i}`);
                downloadedFiles.push(imgPath);
            }
            if (data.music) {
                const musicPath = await downloadFile(data.music, '.mp3', 'music');
                downloadedFiles.push(musicPath);
            }
        } else if (data.play) {
            const vidPath = await downloadFile(data.play, '.mp4', 'vid');
            downloadedFiles.push(vidPath);
        }

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
                        { video: { url: outputVideo }, mimetype: 'video/mp4', caption: slideshowCaption, mentions: senderJid ? [senderJid] : undefined },
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
                        const ffmpegCommand = `"/usr/bin/ffmpeg" -i "${file}" -vf "scale='min(854,iw)':'min(480,ih)'" -c:v libx264 -preset fast -crf 28 -pix_fmt yuv420p -c:a aac -b:a 128k -y "${compressedFile}"`;
                        await execAsync(ffmpegCommand);
                        await ctx.sock.sendMessage(
                            ctx.jid,
                            { video: { url: compressedFile }, mimetype: 'video/mp4', caption: videoCaption, mentions: senderJid ? [senderJid] : undefined },
                            { quoted: ctx.msg }
                        );
                        fs.unlinkSync(file);
                        if (fs.existsSync(compressedFile)) fs.unlinkSync(compressedFile);
                    } catch (ffmpegErr: any) {
                        console.error('[TikTokDL Tool] FFmpeg compression error:', ffmpegErr);
                        await ctx.sock.sendMessage(
                            ctx.jid,
                            { video: { url: file }, mimetype: 'video/mp4', caption: videoCaptionSkipped, mentions: senderJid ? [senderJid] : undefined },
                            { quoted: ctx.msg }
                        );
                        fs.unlinkSync(file);
                        if (fs.existsSync(compressedFile)) fs.unlinkSync(compressedFile);
                    }
                } else if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
                    await ctx.sock.sendMessage(
                        ctx.jid,
                        { image: { url: file }, caption: videoCaption, mentions: senderJid ? [senderJid] : undefined },
                        { quoted: ctx.msg }
                    );
                    fs.unlinkSync(file);
                } else if (['.mp3', '.m4a', '.aac', '.wav'].includes(ext)) {
                    await ctx.sock.sendMessage(
                        ctx.jid,
                        { audio: { url: file }, mimetype: 'audio/mp4', mentions: senderJid ? [senderJid] : undefined },
                        { quoted: ctx.msg }
                    );
                    fs.unlinkSync(file);
                } else {
                    await ctx.sock.sendMessage(
                        ctx.jid,
                        { document: { url: file }, mimetype: 'application/octet-stream', fileName: path.basename(file), mentions: senderJid ? [senderJid] : undefined },
                        { quoted: ctx.msg }
                    );
                    fs.unlinkSync(file);
                }
                processedCount++;
            }
            await ctx.sock.sendMessage(ctx.jid, { react: { text: '✅', key: ctx.msg.key } });
            return;
        } else {
            console.error('[TikTokDL Tool] File not found after download.');
            await ctx.sock.sendMessage(ctx.jid, { react: { text: '❌', key: ctx.msg.key } });
            return;
        }
    } catch (error: any) {
        console.error('[TikTokDL Tool] Execution error:', error);
        await ctx.sock.sendMessage(ctx.jid, { react: { text: '❌', key: ctx.msg.key } });
        return;
    }
}
