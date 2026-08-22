import { ToolDefinition } from './types.js';
import { listTelegramPrivateChats } from '#/db.js';

export const definition: ToolDefinition = {
    name: 'tglist',
    title: 'List Registered Private Telegram Chats',
    category: 'Downloaders',
    aliases: ['.tglist'],
    owner: true,
    description: 'Displays all private Telegram chats currently registered for media proxying.'
};

export async function execute(): Promise<string> {
    const chats = await listTelegramPrivateChats();
    if (chats.length === 0) {
        return 'No private Telegram chats have been registered yet. Use .tgadd to register one.';
    }

    let text = `*Registered Private Telegram Chats (${chats.length}):*\n\n`;
    chats.forEach((chat, index) => {
        text += `${index + 1}. *${chat.title || 'Untitled chat'}*\n`;
        text += `   Chat ID: \`\`\`${chat.chatId}\`\`\`\n`;
        if (chat.inviteLink) {
            text += `   Invite: ${chat.inviteLink}\n`;
        }
        if (index !== chats.length - 1) text += '\n';
    });

    return text.trim();
}
