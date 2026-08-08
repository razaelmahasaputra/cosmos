import { ToolDefinition, ToolContext } from './types.js';
import { toggleOfflineAi } from '#/utils/offlineAi.js';

export const definition: ToolDefinition = {
    name: 'toggleofflineai',
    title: 'Toggle Offline AI Responder',
    category: 'AI & Correction',
    aliases: [
        '.toggleofflineai',
        '.offlineai',
        '.airesponder'
    ],
    description: 'Toggles the automated offline AI responder. When enabled, the AI will casually reply to messages while you are offline.',
    owner: true,
    parameters: {
        type: 'object',
        properties: {},
        required: []
    }
};

export async function execute(_args: Record<string, any>, _ctx: ToolContext): Promise<string> {
    const isEnabled = toggleOfflineAi();
    if (isEnabled) {
        return '🤖 *Offline AI Responder ACTIVATED*\n\nIncoming messages will now receive a casual AI reply while you are offline.\n\nType *.toggleofflineai* again to disable.';
    } else {
        return '🔴 *Offline AI Responder DEACTIVATED*';
    }
}
