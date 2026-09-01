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
            properties: {
                input: { type: 'string', description: 'Category (e.g., roulette)' }
            }
        }
    },
    execute: async (args: Record<string, any>, ctx: ToolContext) => {
        const { msg, sock, jid } = ctx;

        if (!jid.endsWith('@g.us')) {
            return `❌ This command can only be used in a group chat. Use .topglobal to see the global leaderboard.`;
        }

        try {
            const groupMetadata = await sock.groupMetadata(jid);
            const memberJids: string[] = [];
            for (const p of groupMetadata.participants) {
                const cleaned = p.id ? p.id.split(':')[0].split('@')[0] : '';
                if (cleaned) {
                    memberJids.push(cleaned);
                }
            }

            const category = String(args.input || '')
                .trim()
                .toLowerCase();
            const isRoulette = category === 'roulette' || category === 'buckshot';

            const allUsers: any[] = [];
            if (memberJids.length > 0) {
                const chunkSize = 500;
                for (let i = 0; i < memberJids.length; i += chunkSize) {
                    const chunk = memberJids.slice(i, i + chunkSize);
                    const usersChunk = await prisma.user.findMany({
                        where: { id: { in: chunk } }
                    });
                    allUsers.push(...usersChunk);
                }
            }

            const userMap = new Map<string, any>();
            for (const user of allUsers) {
                if (isRoulette && user.rouletteRounds === 0 && user.rouletteWins === 0) continue;

                const defaultName = `+${user.id}`;
                const name = user.pushName || user.username || defaultName;
                if (!userMap.has(name)) {
                    userMap.set(name, { ...user, displayName: name });
                } else {
                    const existing = userMap.get(name);
                    existing.balance += user.balance;
                    existing.rouletteWins += user.rouletteWins;
                    existing.rouletteRounds += user.rouletteRounds;
                }
            }

            const mergedUsers = Array.from(userMap.values());
            mergedUsers.sort((a, b) => (isRoulette ? b.rouletteWins - a.rouletteWins : b.balance - a.balance));

            const finalTopUsers = mergedUsers.slice(0, 10);

            let text = isRoulette ? `🔫 *Group Roulette Leaderboard* 🔫\n\n` : `👥 *Group Casino Leaderboard* 👥\n\n`;

            if (finalTopUsers.length === 0) {
                text += `📭 There are no players registered in the database for this leaderboard yet.`;
            } else {
                finalTopUsers.forEach((user: any, index: number) => {
                    if (isRoulette) {
                        text += `${index === 0 ? '👑' : '💀'} *${index + 1}.* ${user.displayName} - *${user.rouletteWins}* Wins / *${user.rouletteRounds}* Matches\n`;
                    } else {
                        text += `${index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🎗️'} *${index + 1}.* ${user.displayName} - *${user.balance}* coins\n`;
                    }
                });
            }

            await new Promise((resolve) => setTimeout(resolve, 3000));
            await sock.sendMessage(jid, { text }, { quoted: msg });
        } catch (error) {
            console.error('[Top Command Error]', error);
            return `❌ Failed to fetch group leaderboard.`;
        }
    }
};

export default topTool;
