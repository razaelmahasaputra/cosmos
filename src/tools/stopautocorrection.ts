import { ToolDefinition, ToolContext } from './types.js';
import { disableAutoCorrection, isAutoCorrectionEnabled } from '#/utils/autoCorrection.js';

export const definition: ToolDefinition = {
    name: 'stopautocorrection',
    title: 'Stop AI Auto-Correction',
    category: 'AI & Correction',
    aliases: [
        '.stopautocorrection',
        '.stopautocorrect',
        '.disableautocorrect',
        '.disableautocorrection'
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
    if (!isAutoCorrectionEnabled(ctx.jid)) {
        return '⚠️ *Warning:* Auto-Correction is not active in this chat.';
    }
    await disableAutoCorrection(ctx.jid);
    return '🔴 *Auto-Correction DEACTIVATED* for this chat.';
}
