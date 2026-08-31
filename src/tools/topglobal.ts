import { ToolModule, ToolContext } from './types.js';
import { prisma } from '../db.js';

let topGlobalCache: any = null;
let topGlobalCacheExpiry: number = 0;

const topGlobalTool: ToolModule = {
    definition: {
        name: 'topglobal',
        description: 'View the global casino leaderboard.',
        category: 'Casino',
        parameters: {
            type: 'object',
            properties: {}
        }
    },
    execute: async (args: Record<string, any>, ctx: ToolContext) => {
        const { msg, sock, jid } = ctx;

        const now = Date.now();
        if (!topGlobalCache || now > topGlobalCacheExpiry) {
            const allUsers = await prisma.user.findMany({
                orderBy: { balance: 'desc' },
                take: 100 // Fetch more to deduplicate
            });

            const seenNames = new Set<string>();
            const topUsers = [];

            for (const user of allUsers) {
                let defaultName = user.id.split('@')[0];
                if (user.id.includes('@lid')) {
                    defaultName = 'Unknown Player';
                } else {
                    defaultName = `+${defaultName}`;
                }
                const name = user.pushName || user.username || defaultName;
                if (!seenNames.has(name)) {
                    seenNames.add(name);
                    topUsers.push({ ...user, displayName: name });
                }
            }

            topGlobalCache = topUsers.slice(0, 10);
            topGlobalCacheExpiry = now + 5 * 60 * 1000; // 5 minutes cache
        }

        let text = `🌍 *Global Casino Leaderboard* 🌍\n\n`;
        const topUsers = topGlobalCache;

        if (topUsers.length === 0) {
            text += `No players found.`;
        } else {
            topUsers.forEach((user: any, index: number) => {
                text += `${index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🎗️'} *${index + 1}.* ${user.displayName} - *${user.balance}* coins\n`;
            });
        }

        text += `\n_Updated every 5 minutes._`;

        await new Promise((resolve) => setTimeout(resolve, 3000));
        await sock.sendMessage(jid, { text }, { quoted: msg });
    }
};

export default topGlobalTool;
