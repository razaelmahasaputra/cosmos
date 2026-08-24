import { ToolDefinition, ToolContext } from './types.js';
import { enableAutoCorrection, isAutoCorrectionEnabled } from '#/utils/autoCorrection.js';

export const definition: ToolDefinition = {
    name: 'startautocorrection',
    title: 'Start AI Auto-Correction',
    category: 'AI & Correction',
    aliases: ['.startautocorrection', '.startautocorrect', '.enableautocorrect', '.enableautocorrection'],
    description: 'Enables automated AI message auto-correction via OpenRouter for this chat.',
    owner: true,
    parameters: {
        type: 'object',
        properties: {},
        required: []
    }
};

export async function execute(_args: Record<string, any>, ctx: ToolContext): Promise<string> {
    if (isAutoCorrectionEnabled(ctx.jid)) {
        return '⚠️ *Warning:* Auto-Correction is already ACTIVE in this chat! If you want to disable it, type *.stopautocorrection*.';
    }
    await enableAutoCorrection(ctx.jid);
    return '✨ *Auto-Correction ACTIVATED* for this chat.\n\nSent messages will automatically be analyzed and corrected by OpenRouter AI if typos or misspoken words are detected.\n\nType *.stopautocorrection* (or *.autocorrect*) to disable.';
}
