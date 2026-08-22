import { ToolDefinition, ToolContext } from './types.js';
import {
    addTelegramPrivateChat,
    findTelegramChatByInviteLink,
    isTelegramChatRegistered
} from '#/db.js';
import { joinChatViaInvite, parseTelegramPrivateRef, resolveChatTitle } from '#/utils/telegramClient.js';

export const definition: ToolDefinition = {
    name: 'tgadd',
    title: 'Register Private Telegram Chat',
    category: 'Downloaders',
    aliases: ['.tgadd'],
    owner: true,
    description:
        'Registers a private Telegram chat so its media can be proxied. Accepts an invite link (the dummy account joins automatically), a private post link, or a raw numeric chat id.',
    parameters: {
        type: 'object',
        properties: {
            link: {
                type: 'string',
                description:
                    'The invite link (https://t.me/+...), private post link (https://t.me/c/...), or numeric chat id to register.'
            }
        },
        required: ['link']
    }
};

export async function execute(args: Record<string, any>, _ctx: ToolContext): Promise<string> {
    const input = typeof args.link === 'string' ? args.link.trim() : '';
    if (!input) {
        return 'Error: Please provide an invite link, a private post link, or a numeric chat id.';
    }

    const ref = parseTelegramPrivateRef(input);

    // Case 1: invite link — make the dummy account join automatically, then register.
    if (ref.inviteHash) {
        const known = await findTelegramChatByInviteLink(ref.inviteHash);
        if (known) {
            return `That chat is already registered in the database as "${known.title || known.chatId}".`;
        }

        try {
            const joined = await joinChatViaInvite(ref.inviteHash);
            const added = await addTelegramPrivateChat(joined.chatId, joined.title, `https://t.me/+${ref.inviteHash}`);
            if (!added) {
                return 'Error: The chat was joined successfully, but it could not be saved to the database.';
            }
            console.log(`[TGAdd Tool] Joined and registered private chat ${joined.chatId}.`);
            return `Success: The dummy account has joined and registered "${
                joined.title || joined.chatId
            }". Private posts from that group can now be downloaded.`;
        } catch (error: any) {
            console.error('[TGAdd Tool] Failed to join via invite link:', error);
            return (
                'Error: The dummy account could not join using that invitation. It may have expired, been revoked, ' +
                'or the Telegram client may not be paired.'
            );
        }
    }

    // Case 2: post link or raw numeric id — register directly.
    let chatId = ref.chatId;
    if (!chatId && /^\d{5,}$/.test(input)) {
        chatId = input;
    }

    if (!chatId) {
        return (
            'Error: That does not look like a valid invite link, private post link, or numeric chat id. ' +
            'Private post links look like https://t.me/c/1234567890/15.'
        );
    }

    if (await isTelegramChatRegistered(chatId)) {
        return `That chat (${chatId}) is already registered in the database.`;
    }

    const title = await resolveChatTitle(chatId);
    const added = await addTelegramPrivateChat(chatId, title, null);
    if (!added) {
        return 'Error: The chat could not be saved to the database.';
    }
    console.log(`[TGAdd Tool] Registered private chat ${chatId}${title ? ` ("${title}")` : ''}.`);
    return `Success: Chat ${chatId}${
        title ? ` ("${title}")` : ''
    } has been registered. Please ensure the dummy account is a member of that group.`;
}
