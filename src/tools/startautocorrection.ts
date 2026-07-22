import { ToolDefinition, ToolContext } from './types.js';
import { enableAutoCorrection } from '#/utils/autoCorrection.js';

export const definition: ToolDefinition = {
    name: 'startautocorrection',
    aliases: [
        '.startautocorrection',
        'startautocorrection',
        '.startautocorrect',
        'startautocorrect',
        '.enableautocorrect',
        'enableautocorrect',
        '.enableautocorrection',
        'enableautocorrection'
    ],
    description: 'Enables automated AI message auto-correction via Groq for this chat.',
    owner: true,
    parameters: {
        type: 'object',
        properties: {},
        required: []
    }
};

export async function execute(_args: Record<string, any>, ctx: ToolContext): Promise<string> {
    enableAutoCorrection(ctx.jid);
    return '✨ *Auto-Correction ACTIVATED* for this chat.\n\nSent messages will automatically be analyzed and corrected by Groq AI (temp: 0.5) if typos or misspoken words are detected.\n\nType *.stopautocorrection* (or *.autocorrect*) to disable.';
}
