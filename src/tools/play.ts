import { ToolDefinition, ToolContext } from './types.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import ffmpeg from 'ffmpeg-static';
import { playLyrics } from '#/utils/lyricsPlayer.js';

const execAsync = promisify(exec);

export const definition: ToolDefinition = {
    name: 'play',
    title: 'Play Audio/Song',
    category: 'Media',
    aliases: ['.play', '.song', '.audio', '.ytm'],
    description: 'Searches for a song on YouTube and downloads it as an audio file. Supports --lyrics flag.',
    parameters: {
        type: 'object',
        properties: {
            query: {
                type: 'string',
                description: 'The name of the song, search query, or choice number.'
            }
        },
        required: ['query']
    }
};

export async function execute(args: Record<string, any>, ctx: ToolContext): Promise<string | void> {
    let query = args.query ? String(args.query).trim() : '';
    let quotedText = '';
    let enableLyrics = false;
    let stanzaIdToDelete = '';

    // Handle --lyrics flag
    if (query.toLowerCase().includes('--lyrics')) {
        enableLyrics = true;
        query = query.replace(/--lyrics/gi, '').trim();
    }
    let originalQueryStr = query;

    const quotedMsg = ctx.msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (quotedMsg) {
        const extText = quotedMsg.extendedTextMessage;
        quotedText = quotedMsg.conversation || 
                extText?.text || 
                extText?.matchedText || 
                quotedMsg.videoMessage?.caption ||
                quotedMsg.imageMessage?.caption ||
                '';
        stanzaIdToDelete = ctx.msg.message?.extendedTextMessage?.contextInfo?.stanzaId || '';
    }

    if (!query) {
        if (quotedText) {
            query = quotedText;
            originalQueryStr = query;
        } else {
            return 'Error: Please provide a valid search query for the song.';
        }
    }

    // Check if the query is a number and quoted text contains a list of songs
    const queryNum = parseInt(query, 10);
    if (!isNaN(queryNum) && queryNum > 0 && queryNum <= 10 && quotedText.toLowerCase().includes('reply with a number')) {
        if (quotedText.includes('(Flags: --lyrics)')) {
            enableLyrics = true;
        }
        
        // Extract original search term for lyrics file matching
        const matchTitle = quotedText.match(/results for \*(.*?)\*/);
        if (matchTitle) {
            originalQueryStr = matchTitle[1];
        }

        const lines = quotedText.split('\n');
        const matchLine = lines.find(line => line.trim().startsWith(`${queryNum}.`));
        if (matchLine) {
            const urlMatch = matchLine.match(/(https?:\/\/[^\s]+)/);
            if (urlMatch) {
                query = urlMatch[1]; // Override query with the extracted URL
            } else {
                return 'Error: Could not extract URL from the selected option.';
            }
        } else {
            return 'Error: Invalid selection number.';
        }
    }

    const isUrl = query.startsWith('http');
    const ytdlpPath = '/usr/local/bin/yt-dlp';
    const cookiesPath = path.resolve(process.cwd(), 'cookies.txt');
    const cookiesArg = fs.existsSync(cookiesPath) ? `--cookies "${cookiesPath}"` : '';

    if (!isUrl) {
        // Perform search and return list
        const searchMsg = await ctx.sock.sendMessage(
            ctx.jid,
            { text: `⏳ Searching for: *${query}*. Please wait...` },
            { quoted: ctx.msg }
        );

        try {
            const command = `"${ytdlpPath}" ${cookiesArg} --print "%(title)s - %(webpage_url)s" "ytsearch5:${query}"`;
            const { stdout } = await execAsync(command);
            
            // Delete the search message
            if (searchMsg?.key) {
                await ctx.sock.sendMessage(ctx.jid, { delete: searchMsg.key }).catch(() => {});
            }

            const results = stdout.trim().split('\n').filter(line => line.trim() !== '');
            if (results.length === 0) {
                return `No results found for "${query}".`;
            }

            let replyText = `Here are the top results for *${query}*.\nPlease reply with a number (1-${results.length}) to this message to download:\n`;
            if (enableLyrics) {
                replyText += `(Flags: --lyrics)\n`;
            }
            replyText += `\n`;
            results.forEach((res, index) => {
                replyText += `${index + 1}. ${res}\n`;
            });

            await ctx.sock.sendMessage(
                ctx.jid,
                { text: replyText.trim() },
                { quoted: ctx.msg }
            );

            return `Sent a list of search results to the user for "${query}".`;
        } catch (error: any) {
            if (searchMsg?.key) {
                await ctx.sock.sendMessage(ctx.jid, { delete: searchMsg.key }).catch(() => {});
            }
            console.error('[Play Tool Search Error]', error);
            return `Error occurred during search: ${error.message}`;
        }
    } else {
        // Delete the quoted list message if this is a reply interaction
        if (stanzaIdToDelete) {
            await ctx.sock.sendMessage(ctx.jid, { delete: { remoteJid: ctx.jid, fromMe: true, id: stanzaIdToDelete } }).catch(() => {});
        }

        const downloadingMsg = await ctx.sock.sendMessage(
            ctx.jid,
            { text: `⏳ Downloading audio... Please wait...` },
            { quoted: ctx.msg }
        );

        const storagePath = path.resolve(process.cwd(), 'storage');
        if (!fs.existsSync(storagePath)) {
            fs.mkdirSync(storagePath, { recursive: true });
        }

        const timestamp = Date.now();
        const outTemplate = path.join(storagePath, `play_${timestamp}_%(id)s.%(ext)s`);

        try {
            const ffmpegLoc = ffmpeg ? `--ffmpeg-location "${ffmpeg}"` : '';
            const command = `"${ytdlpPath}" ${cookiesArg} ${ffmpegLoc} --ignore-errors --max-downloads 1 -x --audio-format mp3 -o "${outTemplate}" "${query}" --print after_move:filepath`;
            
            let stdout = '';
            let stderr = '';
            try {
                const result = await execAsync(command);
                stdout = result.stdout;
                stderr = result.stderr;
            } catch (err: any) {
                stdout = err.stdout || '';
                stderr = err.stderr || '';
                if (err.code !== 101) {
                    throw err;
                }
            }
            const outputLines = stdout.trim().split('\n').filter(line => line.trim() !== '');
            const downloadedFile = outputLines.length > 0 ? outputLines[outputLines.length - 1].trim() : '';

            // Delete the downloading message
            if (downloadingMsg?.key) {
                await ctx.sock.sendMessage(ctx.jid, { delete: downloadingMsg.key }).catch(() => {});
            }

            if (downloadedFile && fs.existsSync(downloadedFile)) {
                await ctx.sock.sendMessage(
                    ctx.jid,
                    { 
                        audio: { url: downloadedFile },
                        mimetype: 'audio/mpeg'
                    },
                    { quoted: ctx.msg }
                );

                fs.unlinkSync(downloadedFile);
                
                // If lyrics flag was requested, trigger the live lyrics playback!
                if (enableLyrics && originalQueryStr) {
                    await playLyrics(ctx.jid, ctx.sock, originalQueryStr, 1);
                }

                return `The audio was successfully downloaded and transmitted.`;
            } else {
                console.error('[Play Tool] File not found after download.', { stdout, stderr });
                return 'Error: The audio file could not be located after the download process.';
            }
        } catch (error: any) {
            if (downloadingMsg?.key) {
                await ctx.sock.sendMessage(ctx.jid, { delete: downloadingMsg.key }).catch(() => {});
            }
            console.error('[Play Tool] Execution error:', error);
            return `Error: An unexpected issue occurred while downloading the audio. Details: ${error.message}`;
        }
    }
}
