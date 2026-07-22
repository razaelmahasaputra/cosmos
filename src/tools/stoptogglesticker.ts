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
    description: 'Mematikan fitur pembuat stiker otomatis (Auto Sticker Maker) untuk chat ini.',
    parameters: {
        type: 'object',
        properties: {},
        required: []
    }
};

export async function execute(_args: Record<string, any>, ctx: ToolContext): Promise<string> {
    disableAutoSticker(ctx.jid);
    return '🔴 *Auto Sticker Maker BERHASIL DIMATIKAN* untuk chat ini.';
}
