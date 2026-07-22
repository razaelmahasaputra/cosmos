import { ToolDefinition, ToolContext } from './types.js';
import { disableAutoSticker } from '#/utils/autoSticker.js';

export const definition: ToolDefinition = {
    name: 'stoptogglesticker',
    aliases: [
        '.stoptogglesticker',
        'stoptogglesticker',
        '.stoptogglestickermaker',
        'stoptogglestickermaker',
        '.stopautosticker',
        'stopautosticker',
        '.stopautostiker',
        'stopautostiker',
        '.stoptogsticker',
        'stoptogsticker',
        '.stoptglsticker',
        'stoptglsticker',
        '.stoptgls',
        'stoptgls',
        '.stopasticker',
        'stopasticker',
        '.stopastiker',
        'stopastiker'
    ],
    description: 'Disables the Auto Sticker Maker feature for this chat.',
    parameters: {
        type: 'object',
        properties: {},
        required: []
    }
};

export async function execute(_args: Record<string, any>, ctx: ToolContext): Promise<string> {
    disableAutoSticker(ctx.jid);
    return '🔴 *Auto Sticker Maker DEACTIVATED* for this chat.';
}
