import { ToolDefinition, ToolContext } from './types.js';
import { toggleAutoSticker } from '#/utils/autoSticker.js';

export const definition: ToolDefinition = {
    name: 'togglesticker',
    title: 'Enable Auto-Sticker',
    category: 'Media & Stickers',
    aliases: [
        '.togglesticker',
        '.autosticker',
        '.autostiker',
        '.togglestickermaker',
        '.togsticker',
        '.tglsticker',
        '.tgls',
        '.asticker',
        '.astiker'
    ],
    description: 'Enables or disables the Auto Sticker Maker feature for this chat.',
    parameters: {
        type: 'object',
        properties: {},
        required: []
    }
};

export async function execute(_args: Record<string, any>, ctx: ToolContext): Promise<string> {
    const isEnabled = await toggleAutoSticker(ctx.jid);
    if (isEnabled) {
        return '✨ *Auto Sticker Maker ACTIVATED* for this chat.\n\nEvery photo, video, or GIF sent in this chat will automatically be converted into a sticker.\n\nType *.stoptogglesticker* (or *.stopautosticker* / *.stoptgls*) to disable.';
    } else {
        return '🔴 *Auto Sticker Maker DEACTIVATED* for this chat.';
    }
}
