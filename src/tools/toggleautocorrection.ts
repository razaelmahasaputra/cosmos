import { ToolDefinition, ToolContext } from './types.js';
import { toggleAutoCorrection } from '#/utils/autoCorrection.js';

export const definition: ToolDefinition = {
    name: 'toggleautocorrection',
    title: 'Toggle AI Auto-Correction',
    category: 'AI & Correction',
    aliases: ['.toggleautocorrection', '.autocorrect', '.autocorrection', '.autotyo'],
    description: 'Toggles automated AI message auto-correction via OpenRouter for this chat.',
    owner: true,
    parameters: {
        type: 'object',
        properties: {},
        required: []
    }
};

export async function execute(_args: Record<string, any>, ctx: ToolContext): Promise<string> {
    const isEnabled = await toggleAutoCorrection(ctx.jid);
    if (isEnabled) {
        return '✨ *Auto-Correction ACTIVATED* for this chat.\n\nSent messages will automatically be analyzed and corrected by OpenRouter AI if typos or misspoken words are detected.\n\nType *.stopautocorrection* (or *.autocorrect*) to disable.';
    } else {
        return '🔴 *Auto-Correction DEACTIVATED* for this chat.';
    }
}
