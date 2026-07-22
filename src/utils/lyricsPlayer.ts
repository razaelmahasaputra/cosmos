import fs from 'fs';
import path from 'path';
import { WASocket } from '@whiskeysockets/baileys';

export interface LyricLine {
    timeMs: number;
    text: string;
}

export interface LyricsSession {
    timers: NodeJS.Timeout[];
    songName: string;
    speedMultiplier: number;
    startTime: number;
}

// Store active playbacks by JID
const activeSessions = new Map<string, LyricsSession>();

/**
 * Parses LRC / TXT lyrics file to extract timestamps and text.
 * Supported format: [mm:ss.xx] Lyric text or [mm:ss:xx] Lyric text or [mm:ss] Lyric text.
 */
export function parseLyrics(content: string): LyricLine[] {
    const lines = content.split(/\r?\n/);
    const parsed: LyricLine[] = [];
    const regex = /\[(\d{2}):(\d{2})(?:[.:](\d{2,3}))?\](.*)/;

    for (const line of lines) {
        const match = line.match(regex);
        if (match) {
            const minutes = parseInt(match[1], 10);
            const seconds = parseInt(match[2], 10);
            let ms = 0;
            if (match[3]) {
                if (match[3].length === 2) {
                    ms = parseInt(match[3], 10) * 10;
                } else if (match[3].length === 3) {
                    ms = parseInt(match[3], 10);
                } else if (match[3].length === 1) {
                    ms = parseInt(match[3], 10) * 100;
                }
            }
            const timeMs = (minutes * 60 + seconds) * 1000 + ms;
            const text = match[4].trim();
            // Skip empty lyric lines (could be metadata)
            if (text) {
                parsed.push({ timeMs, text });
            }
        }
    }
    // Sort chronologically
    parsed.sort((a, b) => a.timeMs - b.timeMs);
    return parsed;
}

/**
 * Starts playing lyrics for a given JID.
 */
export async function playLyrics(jid: string, sock: WASocket, songName: string, speedMultiplier = 2): Promise<string> {
    // 1. Validation
    if (!songName) {
        return 'Failed: Lyric filename must be specified. Example: .playlyrics sample';
    }

    if (isNaN(speedMultiplier) || speedMultiplier <= 0) {
        return 'Failed: speedMultiplier must be a positive number.';
    }

    const lyricsDir = path.resolve(process.cwd(), 'lyrics');
    if (!fs.existsSync(lyricsDir)) {
        fs.mkdirSync(lyricsDir, { recursive: true });
    }

    // Try exact match first (in case extension is provided), then fallback to auto-appending .lrc and .txt
    let filePath = path.join(lyricsDir, songName);
    if (!fs.existsSync(filePath)) {
        filePath = path.join(lyricsDir, `${songName}.lrc`);
        if (!fs.existsSync(filePath)) {
            filePath = path.join(lyricsDir, `${songName}.txt`);
        }
    }

    if (!fs.existsSync(filePath)) {
        return `Failed: Lyric file "${songName}" was not found in the lyrics/ directory.`;
    }

    let content: string;
    try {
        content = fs.readFileSync(filePath, 'utf-8');
    } catch (err) {
        console.error('Error reading lyrics file:', err);
        return `Failed: Unable to read lyric file "${songName}".`;
    }

    const parsed = parseLyrics(content);
    if (parsed.length === 0) {
        return `Failed: Lyric file "${songName}" contains no lines with valid timestamps.`;
    }

    // 2. Stop existing session for this JID if running
    if (activeSessions.has(jid)) {
        await stopLyrics(jid, sock);
    }

    // 3. Create new session
    const startTime = Date.now();
    const session: LyricsSession = {
        timers: [],
        songName,
        speedMultiplier,
        startTime
    };
    activeSessions.set(jid, session);

    // 4. Schedule all lines
    for (let i = 0; i < parsed.length; i++) {
        const line = parsed[i];
        const sendTime = startTime + line.timeMs * speedMultiplier;
        const typingTime = Math.max(startTime, sendTime - 1500);

        // Schedule typing indicator
        const typingDelay = typingTime - Date.now();
        if (typingDelay >= 0) {
            const typeTimer = setTimeout(async () => {
                try {
                    // Double check if the session is still current
                    if (activeSessions.get(jid) === session) {
                        await sock.sendPresenceUpdate('composing', jid);
                    }
                } catch (err) {
                    console.error('Error sending presence composing:', err);
                }
            }, typingDelay);
            session.timers.push(typeTimer);
        }

        // Schedule sending the lyric line
        const sendDelay = sendTime - Date.now();
        if (sendDelay >= 0) {
            const sendTimer = setTimeout(async () => {
                try {
                    if (activeSessions.get(jid) !== session) return;

                    // Send the message
                    await sock.sendMessage(jid, { text: line.text });

                    // Check if we should stop typing indicator
                    const isLast = i === parsed.length - 1;
                    let shouldPause = isLast;
                    if (!isLast) {
                        const nextSendTime = startTime + parsed[i + 1].timeMs * speedMultiplier;
                        const gap = nextSendTime - sendTime;
                        // Pause the typing indicator if the gap to the next line is more than 3 seconds
                        if (gap > 3000) {
                            shouldPause = true;
                        }
                    }

                    if (shouldPause) {
                        await sock.sendPresenceUpdate('paused', jid);
                    }

                    if (isLast) {
                        activeSessions.delete(jid);
                    }
                } catch (err) {
                    console.error('Error sending lyric line:', err);
                }
            }, sendDelay);
            session.timers.push(sendTimer);
        }
    }

    return `Starting lyrics playback for "${songName}" with a speed multiplier of ${speedMultiplier}x (${parsed.length} lines)...`;
}

/**
 * Stops playing lyrics for a given JID.
 */
export async function stopLyrics(jid: string, sock: WASocket): Promise<string> {
    const session = activeSessions.get(jid);
    if (!session) {
        return 'Failed: There is no ongoing lyrics playback in this chat.';
    }

    // 1. Clear all timers first to prevent any race condition
    for (const timer of session.timers) {
        clearTimeout(timer);
    }
    session.timers = [];

    // 2. Reset presence to paused
    try {
        await sock.sendPresenceUpdate('paused', jid);
    } catch (err) {
        console.error('Error sending presence paused on stop:', err);
    }

    // 3. Delete session
    activeSessions.delete(jid);

    return `Lyrics playback for "${session.songName}" has been successfully stopped.`;
}
