import { ToolDefinition, ToolContext } from './types.js';
import { toggleAutoSticker } from '#/utils/autoSticker.js';

export const definition: ToolDefinition = {
    name: 'togglesticker',
    aliases: [
        '.togglesticker',
        'togglesticker',
        '.autosticker',
        'autosticker',
        '.autostiker',
        'autostiker',
        '.togglestickermaker',
        'togglestickermaker',
        '.togsticker',
        'togsticker',
        '.tglsticker',
        'tglsticker',
        '.tgls',
        'tgls',
        '.asticker',
        'asticker',
        '.astiker',
        'astiker'
    ],
    description: 'Enables or disables the Auto Sticker Maker feature for this chat.',
    parameters: {
        type: 'object',
        properties: {},
        required: []
    }
};

export async function execute(_args: Record<string, any>, ctx: ToolContext): Promise<string> {
    const isEnabled = toggleAutoSticker(ctx.jid);
    if (isEnabled) {
        return '✨ *Auto Sticker Maker ACTIVATED* for this chat.\n\nEvery photo, video, or GIF sent in this chat will automatically be converted into a sticker.\n\nType *.stoptogglesticker* (or *.stopautosticker* / *.stoptgls*) to disable.';
    } else {
        return '🔴 *Auto Sticker Maker DEACTIVATED* for this chat.';
    }
}
