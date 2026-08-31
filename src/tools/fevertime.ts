import { ToolModule, ToolContext } from './types.js';
import { casinoState } from '../utils/casino.js';

const feverTimeTool: ToolModule = {
    definition: {
        name: 'fevertime',
        description: 'Trigger a global Fever Time event for 15 minutes.',
        category: 'Casino',
        owner: true,
        parameters: {
            type: 'object',
            properties: {}
        }
    },
    execute: async (args: Record<string, any>, ctx: ToolContext) => {
        const { sock, jid } = ctx;
        
        const durationMs = 15 * 60 * 1000;
        casinoState.feverTimeEnd = Date.now() + durationMs;

        const fakeWafQuote = {
            key: {
                remoteJid: '0@s.whatsapp.net',
                fromMe: false,
                id: 'WAF_FEVER_MSG',
                participant: '0@s.whatsapp.net'
            },
            message: {
                conversation: '🔥 WAF EVENT ANNOUNCEMENT 🔥'
            }
        };

        const text = `🚨 *FEVER TIME IS ACTIVE!* 🚨\n\n` +
            `The global win rate has been massively boosted for the next 15 minutes!\n` +
            `This is the best time to gamble and win big!\n\n` +
            `_Use .slot, .coinflip, or .dice to start playing!_`;

        await sock.sendMessage(jid, { text }, { quoted: fakeWafQuote as any });
    }
};

export default feverTimeTool;
