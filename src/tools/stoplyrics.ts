import { stopLyrics } from '#/utils/lyricsPlayer.js';
import { ToolDefinition, ToolContext } from './types.js';

export const definition: ToolDefinition = {
    name: 'stoplyrics',
    aliases: ['.stoplyrics', '.slyrics'],
    description: 'Stops ongoing lyrics playback in this chat.',
    parameters: {
        type: 'object',
        properties: {},
        required: []
    }
};

export async function execute(_args: Record<string, any>, ctx: ToolContext): Promise<string> {
    try {
        const result = await stopLyrics(ctx.jid, ctx.sock);
        return result;
    } catch (err) {
        console.error('Error in stoplyrics tool:', err);
        return 'Failed: An error occurred while stopping lyrics playback.';
    }
}
