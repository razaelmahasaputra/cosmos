import { ToolModule, ToolContext } from './types.js';
import { prisma } from '../db.js';
import { cleanId } from '../utils/casino.js';
import { getUser } from '../utils/casino.js';

const balanceTool: ToolModule = {
    definition: {
        name: 'balance',
        aliases: ['uang'],
        description: 'Check your current casino coin balance.',
        category: 'Casino',
        parameters: {
            type: 'object',
            properties: {}
        }
    },
    execute: async (args: Record<string, any>, ctx: ToolContext) => {
        const { msg, sock } = ctx;
        const senderJid = cleanId(msg.key.participant || msg.key.remoteJid!);

        const pushName = msg.pushName || undefined;
        const user = await getUser(prisma, senderJid, pushName);

        await new Promise((resolve) => setTimeout(resolve, 3000));
        await sock.sendMessage(
            msg.key.remoteJid!,
            {
                text: `💰 *Your Balance*\n\nYou currently have *${user.balance}* coins.\nKeep playing and claim your daily reward!`
            },
            { quoted: msg }
        );
    }
};

export default balanceTool;
