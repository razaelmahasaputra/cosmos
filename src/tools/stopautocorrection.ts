import { ToolDefinition, ToolContext } from './types.js';
import { disableAutoCorrection } from '#/utils/autoCorrection.js';

export const definition: ToolDefinition = {
    name: 'stopautocorrection',
    aliases: [
        '.stopautocorrection',
        'stopautocorrection',
        '.stopautocorrect',
        'stopautocorrect',
        '.disableautocorrect',
        'disableautocorrect',
        '.disableautocorrection',
        'disableautocorrection'
    ],
    description: 'Disables automated AI message auto-correction via Groq for this chat.',
    owner: true,
    parameters: {
        type: 'object',
        properties: {},
        required: []
    }
};

export async function execute(_args: Record<string, any>, ctx: ToolContext): Promise<string> {
    disableAutoCorrection(ctx.jid);
    return '🔴 *Auto-Correction DEACTIVATED* for this chat.';
}
