import { ToolModule, ToolContext } from './types.js';
import { prisma } from '../db.js';
import { formatRupiah } from '../utils/currency.js';

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

            // Remove old LID-JID background migration since it's unreliable here.

            const category = String(args.input || '')
                .trim()
                .toLowerCase();
            const isRoulette = category === 'roulette' || category === 'buckshot';

            // Gather all cleaned JIDs and LIDs from the group to query the DB
            const idsToFetch = new Set<string>();
            for (const p of groupMetadata.participants) {
                if (p.id) idsToFetch.add(p.id.split(':')[0].split('@')[0]);
                if ((p as any).lid) idsToFetch.add((p as any).lid.split(':')[0].split('@')[0]);
            }

            const idsArray = Array.from(idsToFetch);
            const allUsers: any[] = [];

            if (idsArray.length > 0) {
                const chunkSize = 500;
                for (let i = 0; i < idsArray.length; i += chunkSize) {
                    const chunk = idsArray.slice(i, i + chunkSize);
                    const usersChunk = await prisma.user.findMany({
                        where: { OR: [{ id: { in: chunk } }, { lid: { in: chunk } }] }
                    });
                    allUsers.push(...usersChunk);
                }
            }

            // Map DB rows to actual participants to avoid duplicates and resolve mentions perfectly
            const participantStats: any[] = [];

            for (const p of groupMetadata.participants) {
                if (!p.id) continue;
                const pIdClean = p.id.split(':')[0].split('@')[0];
                const pLidClean = (p as any).lid ? (p as any).lid.split(':')[0].split('@')[0] : null;

                let balance = 0n;
                let rouletteWins = 0;
                let rouletteRounds = 0;
                let gamesPlayed = 0;
                let hasRecord = false;
                let pushName = '';

                for (const u of allUsers) {
                    // Match by JID or LID
                    if (
                        u.id === pIdClean ||
                        u.lid === pIdClean ||
                        (pLidClean && (u.id === pLidClean || u.lid === pLidClean))
                    ) {
                        hasRecord = true;
                        balance += BigInt(u.balance);
                        rouletteWins += u.rouletteWins;
                        rouletteRounds += u.rouletteRounds;
                        gamesPlayed += u.gamesPlayed;
                        if (u.pushName) pushName = u.pushName;
                    }
                }

                if (hasRecord) {
                    // Filter out users who have never played
                    if (isRoulette) {
                        if (rouletteRounds === 0 && rouletteWins === 0) continue;
                    } else {
                        // 10000 is the starter pack. Filter if they haven't played and balance is untouched.
                        if (gamesPlayed === 0 && balance === 10000n) continue;
                    }

                    participantStats.push({
                        mentionId: p.id, // e.g. "628...@s.whatsapp.net" or "1203...@lid"
                        cleanId: pIdClean,
                        pushName,
                        balance,
                        rouletteWins,
                        rouletteRounds
                    });
                }
            }

            participantStats.sort((a, b) =>
                isRoulette ? b.rouletteWins - a.rouletteWins : Number(b.balance) - Number(a.balance)
            );

            const finalTopUsers = participantStats.slice(0, 10);

            let text = isRoulette ? `🔫 *Group Roulette Leaderboard* 🔫\n\n` : `👥 *Group Casino Leaderboard* 👥\n\n`;
            const mentions: string[] = [];

            if (finalTopUsers.length === 0) {
                text += `📭 There are no players registered in the database for this leaderboard yet.`;
            } else {
                finalTopUsers.forEach((user: any, index: number) => {
                    mentions.push(user.mentionId);
                    const displayName = user.pushName ? ` (${user.pushName})` : '';

                    if (isRoulette) {
                        text += `${index === 0 ? '👑' : '💀'} *${index + 1}.* @${user.cleanId} - *${user.rouletteWins}* Wins / *${user.rouletteRounds}* Matches\n`;
                    } else {
                        text += `${index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🎗️'} *${index + 1}.* @${user.cleanId}${displayName} - *${formatRupiah(user.balance)}*\n`;
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
