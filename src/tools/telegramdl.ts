import { ToolDefinition, ToolContext } from './types.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import ffmpeg from 'ffmpeg-static';
import {
    downloadPrivateMedia,
    parseTelegramPrivateRef,
    PrivateMediaFile,
    TelegramPostRef
} from '#/utils/telegramClient.js';
import { isTelegramChatRegistered, findTelegramChatByInviteLink } from '#/db.js';
import { sendTelegramBotNotification } from '#/utils/backup.js';

const execAsync = promisify(exec);

const TELEGRAM_HOSTS = ['t.me', 'telegram.me', 'telegram.dog'];
const MAX_MEDIA_BYTES = 15 * 1024 * 1024;

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

function getOwnerJid(): string | null {
    const ownerNumber = process.env.BOT_PHONE_NUMBER?.trim();
    return ownerNumber ? `${ownerNumber}@s.whatsapp.net` : null;
}

/** Escapes text so it can be embedded safely in an HTML parse-mode Telegram message. */
function escapeHtml(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Strips device suffixes and JID/LID domains, leaving only the base identifier. */
function cleanJidNumber(jid: string | null | undefined): string | null {
    return jid ? jid.split(':')[0].split('@')[0] || null : null;
}

/**
 * Sends the pending private-chat request through the backup Telegram bot as a
 * rich message containing the requester's WhatsApp number and username along
 * with the group link required for the dummy account to join. Falls back to a
 * direct WhatsApp notification when the Telegram bot is unavailable.
 */
async function notifyOwnerOfPendingChat(
    ctx: ToolContext,
    telegramUrl: string,
    ref: TelegramPostRef
): Promise<void> {
    const requesterJid = ctx.msg.key.participant || ctx.msg.key.remoteJid;
    const requesterNumber = cleanJidNumber(requesterJid);
    const requesterName = ctx.msg.pushName?.trim() || requesterNumber || 'Unknown';

    let html =
        '🔒 <b>Private Telegram Content Request</b>\n\n' +
        'A user requested media from a private Telegram chat that has not been added to the database yet.\n\n' +
        `<b>Group Link:</b> ${escapeHtml(telegramUrl)}\n`;

    if (ref.chatId && ref.messageId !== null) {
        html += `<b>Internal Chat ID:</b> <code>-100${ref.chatId}</code>\n`;
        html += `<b>Message ID:</b> <code>${ref.messageId}</code>\n`;
    }

    html += `<b>Requester Username:</b> ${escapeHtml(requesterName)}\n`;
    if (requesterNumber) {
        html += `<b>WhatsApp Number:</b> <code>${requesterNumber}</code>\n`;
    }

    html +=
        '\n<b>Next Steps:</b>\n' +
        `1. Join the group above using the dummy account (invite links can be joined automatically via <code>.tgadd ${escapeHtml(
            ref.inviteHash ? telegramUrl : '<invite-link>'
        )}</code>).\n` +
        '2. Register the chat with <code>.tgadd &lt;link-or-chat-id&gt;</code>.\n' +
        '3. The requester may retry the same command afterwards.';

    console.log('[TelegramDL Tool] Forwarding private chat request to the backup Telegram bot.');
    const sentToTelegram = await sendTelegramBotNotification(html);
    if (sentToTelegram) return;

    // Fallback: notify the owner on WhatsApp when the Telegram route is unavailable.
    const ownerJid = getOwnerJid();
    if (!ownerJid || ownerJid === ctx.jid) return;

    let text =
        '🔒 *Private Telegram Content Request*\n\n' +
        'A user requested media from a private Telegram chat that has not been added to the database yet.\n\n' +
        `*Requested Link:* ${telegramUrl}\n`;

    if (ref.chatId && ref.messageId !== null) {
        text += `*Internal Chat ID:* \`\`\`${ref.chatId}\`\`\`\n*Message ID:* \`\`\`${ref.messageId}\`\`\`\n`;
    }

    text +=
        `*Requester Username:* ${requesterName}\n` +
        (requesterNumber ? `*WhatsApp Number:* ${requesterNumber}\n` : '') +
        '\n*Next Steps:*\n' +
        '1. If an invite link is available, run `.tgadd <invite-link>` so the dummy account joins automatically.\n' +
        '2. Otherwise, join the group manually using the dummy account, then register it with `.tgadd <link-or-chat-id>`.\n' +
        '3. The requester may retry the same command afterwards.';

    try {
        await ctx.sock.sendMessage(ownerJid, { text });
        console.log('[TelegramDL Tool] Owner notified about pending private chat request via WhatsApp fallback.');
    } catch (err) {
        console.error('[TelegramDL Tool] Failed to notify the owner:', err);
    }
}

/** Sends downloaded private media to the requesting chat according to its type. */
async function sendPrivateMedia(ctx: ToolContext, file: PrivateMediaFile): Promise<void> {
    const mentions = ctx.msg.key.participant ? [ctx.msg.key.participant] : undefined;
    const quoted = { quoted: ctx.msg };

    if (file.kind === 'video') {
        await ctx.sock.sendMessage(
            ctx.jid,
            {
                video: { url: file.filePath },
                mimetype: file.mimeType,
                caption: '✅ The Telegram video has been successfully retrieved.',
                mentions
            },
            quoted
        );
    } else if (file.kind === 'image') {
        await ctx.sock.sendMessage(
            ctx.jid,
            { image: { url: file.filePath }, caption: '✅ The Telegram photo has been successfully retrieved.', mentions },
            quoted
        );
    } else if (file.kind === 'audio') {
        await ctx.sock.sendMessage(
            ctx.jid,
            { audio: { url: file.filePath }, mimetype: file.mimeType, mentions },
            quoted
        );
    } else {
        await ctx.sock.sendMessage(
            ctx.jid,
            {
                document: { url: file.filePath },
                mimetype: file.mimeType,
                fileName: file.fileName,
                mentions
            },
            quoted
        );
    }
}

export const definition: ToolDefinition = {
    name: 'telegramdl',
    title: 'Telegram Downloader',
    category: 'Downloaders',
    aliases: ['.tg', '.tgdl', '.tele', '.telegram'],
    description:
        'Downloads media from a Telegram post link (t.me). Public posts are fetched directly, while posts from registered private groups are proxied through the dummy account.',
    parameters: {
        type: 'object',
        properties: {
            url: {
                type: 'string',
                description:
                    'The URL of the Telegram post or invite link to process.'
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
        return 'Error: Please provide a valid Telegram post link (for example https://t.me/channel/123).';
    }

    await ctx.sock.sendMessage(ctx.jid, { react: { text: '⏳', key: ctx.msg.key } });

    const ref = parseTelegramPrivateRef(targetText);

    // --- Invite link only: nothing to download, route it to the owner for onboarding. ---
    if (ref.inviteHash) {
        const knownChat = await findTelegramChatByInviteLink(ref.inviteHash);
        if (knownChat) {
            await ctx.sock.sendMessage(ctx.jid, { react: { text: '✅', key: ctx.msg.key } });
            return (
                'That Telegram group has already been added to the database. Please provide the link of the ' +
                'specific post you wish to download (for example https://t.me/c/' +
                knownChat.chatId + '/123).'
            );
        }

        console.log('[TelegramDL Tool] Unregistered invite link received; notifying the owner.');
        await notifyOwnerOfPendingChat(ctx, telegramUrl, ref);
        await ctx.sock.sendMessage(ctx.jid, { react: { text: '🔒', key: ctx.msg.key } });
        return (
            'The bot has not been added to that Telegram group yet, so its content cannot be accessed at the ' +
            'moment. The owner has been notified with your request and access will be available once the group ' +
            'has been joined and registered. Please try again later.'
        );
    }

    // --- Private post (t.me/c/<chatId>/<messageId>): proxy through the dummy account when registered. ---
    if (ref.isPrivatePost && ref.chatId && ref.messageId !== null) {
        const registered = await isTelegramChatRegistered(ref.chatId);
        if (!registered) {
            console.log(
                `[TelegramDL Tool] Request for unregistered private chat ${ref.chatId}; notifying the owner.`
            );
            await notifyOwnerOfPendingChat(ctx, telegramUrl, ref);
            await ctx.sock.sendMessage(ctx.jid, { react: { text: '🔒', key: ctx.msg.key } });
            return (
                'The bot has not been added to that Telegram group yet, so its content cannot be accessed at ' +
                'the moment. The owner has been notified with your request and access will be available once ' +
                'the group has been joined and registered. Please try again later.'
            );
        }

        try {
            const file = await downloadPrivateMedia(ref.chatId, ref.messageId);

            if (file.sizeBytes > MAX_MEDIA_BYTES) {
                console.error(
                    `[TelegramDL Tool] Media ${file.fileName} (${file.sizeBytes} bytes) exceeds the 15MB limit.`
                );
                fs.unlinkSync(file.filePath);
                await ctx.sock.sendMessage(ctx.jid, { react: { text: '❌', key: ctx.msg.key } });
                return 'Error: This media exceeds the 15MB size limit and cannot be sent via WhatsApp.';
            }

            await sendPrivateMedia(ctx, file);
            fs.unlinkSync(file.filePath);
            await ctx.sock.sendMessage(ctx.jid, { react: { text: '✅', key: ctx.msg.key } });
            return;
        } catch (error: any) {
            console.error('[TelegramDL Tool] Private media retrieval failed:', error);
            await ctx.sock.sendMessage(ctx.jid, { react: { text: '❌', key: ctx.msg.key } });
            return (
                'Error: The media could not be retrieved from that private group. The dummy account may no ' +
                'longer have access to it. The owner has been informed through the logs.'
            );
        }
    }

    // --- Public post: fetch directly with yt-dlp. ---
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
            if (fs.statSync(downloadedFile).size > MAX_MEDIA_BYTES) {
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
