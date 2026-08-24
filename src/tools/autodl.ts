import { ToolDefinition, ToolContext } from './types.js';
import { setAutoDl, isAutoDlEnabled } from '#/utils/autodl.js';

export const definition: ToolDefinition = {
    name: 'autodl',
    title: 'Auto Downloader Settings',
    category: 'Settings',
    aliases: ['.autodl'],
    description:
        'Toggle automatic downloading of links for this group. E.g. .autodl tiktok on, .autodl ig off, .autodl list',
    parameters: {
        type: 'object',
        properties: {
            platform: {
                type: 'string',
                description: 'The platform to configure (e.g., tiktok, ig, pin, yt, tg, all, list)'
            },
            state: {
                type: 'string',
                description: 'The state to set (on/off)'
            }
        },
        required: ['platform']
    }
};

const VALID_PLATFORMS = [
    'tiktok',
    'tt',
    'ig',
    'instagram',
    'pin',
    'pinterest',
    'yt',
    'youtube',
    'tg',
    'telegram',
    'twitter',
    'x',
    'fb',
    'facebook',
    'threads',
    'autodelete',
    'all',
    'list'
];

export async function execute(args: Record<string, any>, ctx: ToolContext): Promise<string | void> {
    let { platform, state } = args;

    if (platform && typeof platform === 'string' && platform.includes(' ') && !state) {
        const parts = platform.split(' ');
        platform = parts[0];
        state = parts[1];
    }
    const jid = ctx.jid;

    // Check permissions
    if (jid.endsWith('@g.us')) {
        // Group: Admin or Owner
        const groupMetadata = await ctx.sock.groupMetadata(jid);
        const senderJid = ctx.msg.key.participant || ctx.msg.key.remoteJid;

        let isAdmin = false;
        if (senderJid) {
            const participant = groupMetadata.participants.find((p) => p.id === senderJid);
            if (participant && (participant.admin === 'admin' || participant.admin === 'superadmin')) {
                isAdmin = true;
            }
        }

        const ownerNumber = process.env.BOT_PHONE_NUMBER
            ? process.env.BOT_PHONE_NUMBER.split(':')[0].split('@')[0]
            : null;
        const senderRaw = senderJid ? senderJid.split(':')[0].split('@')[0] : null;
        const isOwner = Boolean(ctx.msg.key.fromMe) || (ownerNumber !== null && senderRaw === ownerNumber);

        if (!isAdmin && !isOwner) {
            return '❌ This command can only be used by group admins or the bot owner.';
        }
    } else {
        // Private chat: only owner can toggle
        const ownerNumber = process.env.BOT_PHONE_NUMBER
            ? process.env.BOT_PHONE_NUMBER.split(':')[0].split('@')[0]
            : null;
        const senderRaw = jid.split(':')[0].split('@')[0];
        const isOwner = Boolean(ctx.msg.key.fromMe) || (ownerNumber !== null && senderRaw === ownerNumber);
        if (!isOwner) {
            return '❌ This command can only be used by the bot owner in private chats.';
        }
    }

    if (!platform || typeof platform !== 'string') {
        return '❌ Invalid platform. Supported: tiktok, ig, pin, yt, tg, twitter, fb, threads, autodelete, all.';
    }

    const platRaw = platform.toLowerCase().trim();
    const platTarget =
        platRaw === 'tt'
            ? 'tiktok'
            : platRaw === 'instagram'
              ? 'ig'
              : platRaw === 'pinterest'
                ? 'pin'
                : platRaw === 'youtube'
                  ? 'yt'
                  : platRaw === 'telegram'
                    ? 'tg'
                    : platRaw === 'x'
                      ? 'twitter'
                      : platRaw === 'facebook'
                        ? 'fb'
                        : platRaw;

    if (!VALID_PLATFORMS.includes(platTarget)) {
        return '❌ Invalid platform. Supported: tiktok, ig, pin, yt, tg, twitter, fb, threads, autodelete, all.';
    }

    const enabled = state ? state.toLowerCase() === 'on' || state === 'true' || state === '1' : true;

    await ctx.sock.sendMessage(ctx.jid, { react: { text: '⏳', key: ctx.msg.key } });

    if (platTarget === 'list') {
        const platformsToCheck = ['tiktok', 'ig', 'pin', 'yt', 'tg', 'twitter', 'fb', 'threads'];
        let msg = '*📋 Auto-Downloader Status*\n\n';
        for (const p of platformsToCheck) {
            const status = isAutoDlEnabled(jid, p) ? '✅ ON' : '❌ OFF';
            msg += `- ${p.toUpperCase()}: ${status}\n`;
        }

        msg += '\n*⚙️ Settings*\n';
        const adStatus = isAutoDlEnabled(jid, 'autodelete') ? '✅ ON' : '❌ OFF';
        msg += `- AUTODELETE: ${adStatus}\n`;

        await ctx.sock.sendMessage(ctx.jid, { react: { text: '✅', key: ctx.msg.key } });
        return msg.trim();
    } else if (platTarget === 'all') {
        const platformsToSet = ['tiktok', 'ig', 'pin', 'yt', 'tg', 'twitter', 'fb', 'threads'];
        let success = true;
        for (const p of platformsToSet) {
            const res = await setAutoDl(jid, p, enabled);
            if (!res) success = false;
        }
        if (success) {
            await ctx.sock.sendMessage(ctx.jid, { react: { text: '✅', key: ctx.msg.key } });
            return `✅ Auto-download for all media platforms has been turned ${enabled ? 'ON' : 'OFF'}.`;
        } else {
            return '❌ Failed to save auto-download settings.';
        }
    } else {
        const success = await setAutoDl(jid, platTarget, enabled);
        if (success) {
            await ctx.sock.sendMessage(ctx.jid, { react: { text: '✅', key: ctx.msg.key } });
            if (platTarget === 'autodelete') {
                return `✅ Auto-delete for downloaded media and links is now ${enabled ? 'ON' : 'OFF'}.`;
            }
            return `✅ Auto-download for ${platTarget.toUpperCase()} has been turned ${enabled ? 'ON' : 'OFF'}.`;
        } else {
            return '❌ Failed to save auto-download settings.';
        }
    }
}
