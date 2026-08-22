import { ToolDefinition } from './types.js';
import { removeTelegramPrivateChat } from '#/db.js';

export const definition: ToolDefinition = {
    name: 'tgdel',
    title: 'Unregister Private Telegram Chat',
    category: 'Downloaders',
    aliases: ['.tgdel', '.tgremove'],
    owner: true,
    description: 'Removes a private Telegram chat from the proxy registry so its media is no longer accessible.',
    parameters: {
        type: 'object',
        properties: {
            chatId: {
                type: 'string',
                description: 'The numeric chat id of the private chat to unregister.'
            }
        },
        required: ['chatId']
    }
};

export async function execute(args: Record<string, any>): Promise<string> {
    const chatId = typeof args.chatId === 'string' ? args.chatId.trim() : '';
    if (!chatId || !/^\d{5,}$/.test(chatId)) {
        return 'Error: Please provide the numeric chat id, for example .tgdel 1234567890. Use .tglist to see registered chats.';
    }

    const removed = await removeTelegramPrivateChat(chatId);
    if (!removed) {
        return `Error: Chat ${chatId} was not found in the registry.`;
    }
    console.log(`[TGDel Tool] Unregistered private chat ${chatId}.`);
    return `Success: Chat ${chatId} has been removed from the registry and can no longer be proxied.`;
}
