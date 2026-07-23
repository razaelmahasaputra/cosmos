import { ToolDefinition, ToolContext } from './types.js';
import { disableAutoSticker, isAutoStickerEnabled } from '#/utils/autoSticker.js';

export const definition: ToolDefinition = {
    name: 'stoptogglesticker',
    title: 'Disable Auto-Sticker',
    category: 'Media & Stickers',
    aliases: [
        '.stoptogglesticker',
        '.stoptogglestickermaker',
        '.stopautosticker',
        '.stopautostiker',
        '.stoptogsticker',
        '.stoptglsticker',
        '.stoptgls',
        '.stopasticker',
        '.stopastiker'
    ],
    description: 'Disables the Auto Sticker Maker feature for this chat.',
    parameters: {
        type: 'object',
        properties: {},
        required: []
    }
};

export async function execute(_args: Record<string, any>, ctx: ToolContext): Promise<string> {
    if (!isAutoStickerEnabled(ctx.jid)) {
        return '⚠️ *Warning:* Auto Sticker Maker is not active in this chat.';
    }
    await disableAutoSticker(ctx.jid);
    return '🔴 *Auto Sticker Maker DEACTIVATED* for this chat.';
}
