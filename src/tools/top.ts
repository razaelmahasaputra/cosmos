import { ToolModule, ToolContext } from './types.js';
import { prisma } from '../db.js';
import { autoMergeAccounts } from '../utils/casino.js';

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
            const idToJidMap = new Map<string, string>();
            const jidLidPairs: { jid: string; lid: string }[] = [];

            for (const p of groupMetadata.participants) {
                if (p.id) {
                    const cleaned = p.id.split(':')[0].split('@')[0];
                    const cleanedLid = (p as any).lid ? (p as any).lid.split(':')[0].split('@')[0] : null;

                    if (cleaned) {
                        memberJids.push(cleaned);
                        const domain = p.id.includes('@lid') ? 'lid' : 's.whatsapp.net';
                        idToJidMap.set(cleaned, `${cleaned}@${domain}`);
                    }

                    if (cleaned && cleanedLid && cleaned !== cleanedLid) {
                        jidLidPairs.push({ jid: cleaned, lid: cleanedLid });
                        idToJidMap.set(cleanedLid, `${cleanedLid}@lid`);
                    }
                }
            }

            // Fire-and-forget migration for old LID accounts
            (async () => {
                for (const pair of jidLidPairs) {
                    try {
                        const oldUser = await prisma.user.findUnique({ where: { id: pair.lid } });
                        if (oldUser) {
                            await autoMergeAccounts(pair.lid, pair.jid);
                        }
                        await prisma.user.updateMany({
                            where: { id: pair.jid },
                            data: { lid: pair.lid }
                        });
                    } catch {
                        // ignore
                    }
                }
            })();

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
                        where: { OR: [{ id: { in: chunk } }, { lid: { in: chunk } }] }
                    });
                    allUsers.push(...usersChunk);
                }
            }

            const userMap = new Map<string, any>();
            for (const user of allUsers) {
                if (isRoulette && user.rouletteRounds === 0 && user.rouletteWins === 0) continue;

                if (!userMap.has(user.id)) {
                    userMap.set(user.id, { ...user });
                } else {
                    const existing = userMap.get(user.id);
                    existing.balance = Number(existing.balance) + Number(user.balance);
                    existing.rouletteWins += user.rouletteWins;
                    existing.rouletteRounds += user.rouletteRounds;
                }
            }

            const mergedUsers = Array.from(userMap.values());
            mergedUsers.sort((a, b) =>
                isRoulette ? b.rouletteWins - a.rouletteWins : Number(b.balance) - Number(a.balance)
            );

            const finalTopUsers = mergedUsers.slice(0, 10);

            let text = isRoulette ? `🔫 *Group Roulette Leaderboard* 🔫\n\n` : `👥 *Group Casino Leaderboard* 👥\n\n`;
            const mentions: string[] = [];

            if (finalTopUsers.length === 0) {
                text += `📭 There are no players registered in the database for this leaderboard yet.`;
            } else {
                finalTopUsers.forEach((user: any, index: number) => {
                    const domain = String(user.id).length >= 14 ? 'lid' : 's.whatsapp.net';
                    mentions.push(`${user.id}@${domain}`);

                    if (isRoulette) {
                        text += `${index === 0 ? '👑' : '💀'} *${index + 1}.* @${user.id} - *${user.rouletteWins}* Wins / *${user.rouletteRounds}* Matches\n`;
                    } else {
                        text += `${index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🎗️'} *${index + 1}.* @${user.id} - *Rp ${Number(user.balance).toLocaleString('id-ID')}*\n`;
                    }
                });
            }

            await new Promise((resolve) => setTimeout(resolve, 3000));
            await sock.sendMessage(jid, { text, mentions }, { quoted: msg });
        } catch (error) {
            console.error('[Top Command Error]', error);
            return `❌ Failed to fetch group leaderboard.`;
        }
    }
};

export default topTool;
