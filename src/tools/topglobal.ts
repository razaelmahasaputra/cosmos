import { ToolModule, ToolContext } from './types.js';
import { prisma } from '../db.js';

let topGlobalCache: any = null;
let topGlobalCacheExpiry: number = 0;
let topRouletteCache: any = null;
let topRouletteCacheExpiry: number = 0;

const topGlobalTool: ToolModule = {
    definition: {
        name: 'topglobal',
        description: 'View the global casino or roulette leaderboard.',
        category: 'Casino',
        parameters: {
            type: 'object',
            properties: {
                input: { type: 'string', description: 'Category (optional, e.g. roulette)' }
            }
        }
    },
    execute: async (args: Record<string, any>, ctx: ToolContext) => {
        const { msg, sock, jid } = ctx;
        const category = String(args.input || '')
            .trim()
            .toLowerCase();
        const isRoulette = category === 'roulette' || category === 'buckshot';

        const now = Date.now();
        const cache = isRoulette ? topRouletteCache : topGlobalCache;
        const expiry = isRoulette ? topRouletteCacheExpiry : topGlobalCacheExpiry;

        if (!cache || now > expiry) {
            const allUsers = await prisma.user.findMany();

            const userMap = new Map<string, any>();

            for (const user of allUsers) {
                let defaultName = user.id.split('@')[0];
                if (user.id.includes('@lid')) {
                    defaultName = 'Unknown Player';
                } else {
                    defaultName = `+${defaultName}`;
                }
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

            if (isRoulette) {
                topRouletteCache = mergedUsers.slice(0, 10);
                topRouletteCacheExpiry = now + 5 * 60 * 1000;
            } else {
                topGlobalCache = mergedUsers.slice(0, 10);
                topGlobalCacheExpiry = now + 5 * 60 * 1000;
            }
        }

        let text = isRoulette ? `🌍 *Global Roulette Leaderboard* 🌍\n\n` : `🌍 *Global Casino Leaderboard* 🌍\n\n`;
        const topUsersList = isRoulette ? topRouletteCache : topGlobalCache;

        if (topUsersList.length === 0) {
            text += `No players found.`;
        } else {
            topUsersList.forEach((user: any, index: number) => {
                if (isRoulette) {
                    text += `${index === 0 ? '👑' : '💀'} *${index + 1}.* ${user.displayName} - *${user.rouletteWins}* Wins / *${user.rouletteRounds}* Matches\n`;
                } else {
                    text += `${index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🎗️'} *${index + 1}.* ${user.displayName} - *${user.balance}* coins\n`;
                }
            });
        }

        text += `\n_Updated every 5 minutes._`;

        await new Promise((resolve) => setTimeout(resolve, 3000));
        await sock.sendMessage(jid, { text }, { quoted: msg });
    }
};

export default topGlobalTool;
