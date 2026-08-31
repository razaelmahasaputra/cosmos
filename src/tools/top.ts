import { ToolModule, ToolContext } from './types.js';
import { prisma } from '../db.js';

const topTool: ToolModule = {
    definition: {
        name: 'top',
        aliases: ['leaderboard', 'lb'],
        description: 'View the group casino leaderboard.',
        category: 'Casino',
        parameters: {
            type: 'object',
            properties: {}
        }
    },
    execute: async (args: Record<string, any>, ctx: ToolContext) => {
        const { msg, sock, jid } = ctx;
        
        if (!jid.endsWith('@g.us')) {
            return `❌ This command can only be used in a group chat. Use .topglobal to see the global leaderboard.`;
        }

        try {
            const groupMetadata = await sock.groupMetadata(jid);
            const memberJids = groupMetadata.participants.map(p => p.id);
            
            const topUsers = await prisma.user.findMany({
                where: { id: { in: memberJids } },
                orderBy: { balance: 'desc' },
                take: 10
            });

            let text = `👥 *Group Casino Leaderboard* 👥\n\n`;
            
            if (topUsers.length === 0) {
                text += `No players found in this group.`;
            } else {
                topUsers.forEach((user: any, index: number) => {
                    const name = user.pushName || user.username || user.id.split('@')[0];
                    text += `${index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🎗️'} *${index + 1}.* ${name} - *${user.balance}* coins\n`;
                });
            }

            await sock.sendMessage(jid, { text }, { quoted: msg });
        } catch (error) {
            console.error('[Top Command Error]', error);
            return `❌ Failed to fetch group leaderboard.`;
        }
    }
};

export default topTool;
