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
    description: 'Mengaktifkan atau mematikan fitur pembuat stiker otomatis (Auto Sticker Maker) untuk chat ini.',
    parameters: {
        type: 'object',
        properties: {},
        required: []
    }
};

export async function execute(_args: Record<string, any>, ctx: ToolContext): Promise<string> {
    const isEnabled = toggleAutoSticker(ctx.jid);
    if (isEnabled) {
        return '✨ *Auto Sticker Maker BERHASIL DIAKTIFKAN* untuk chat ini.\n\nSetiap foto, video, atau GIF yang dikirim di chat ini akan otomatis diubah menjadi stiker.\n\nKetik *.stoptogglesticker* (atau *.stopautosticker* / *.stoptgls*) untuk mematikan.';
    } else {
        return '🔴 *Auto Sticker Maker BERHASIL DIMATIKAN* untuk chat ini.';
    }
}
