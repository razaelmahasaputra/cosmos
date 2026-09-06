import { ToolModule, ToolContext } from './types.js';
import { gameSessions, generateSessionId, Player } from '../utils/roulette.js';
import { getSenderJid } from '../utils/casino.js';
import { prisma } from '../db.js';
import { registerCancellableSession, unregisterCancellableSession } from '../utils/cancellationManager.js';

const createGameTool: ToolModule = {
    definition: {
        name: 'creategame',
        description: 'Create a new Buckshot Roulette minigame session',
        category: 'Games'
    },
    execute: async (args: Record<string, any>, ctx: ToolContext) => {
        const { msg, sock, jid } = ctx;
        const senderJid = getSenderJid(msg, sock);

        // Check if there is already a game in this group
        for (const session of gameSessions.values()) {
            if (session.chatId === jid) {
                return `❌ There is already an ongoing game in this group (ID: ${session.sessionId}).`;
            }
        }

        const sessionId = generateSessionId();
        const timeoutId = setTimeout(async () => {
            const session = gameSessions.get(sessionId);
            if (session && session.status === 'LOBBY' && session.players.length < 2) {
                unregisterCancellableSession(`roulette_${sessionId}`);
                gameSessions.delete(sessionId);
                await sock.sendMessage(jid, {
                    text: `❌ *GAME CANCELLED!*\nTime expired (30 seconds) and no one joined, or the betting requirements were not met. Bet balances have been refunded to each player.`
                });
            }
        }, 30000);

        const creator: Player = {
            userId: senderJid,
            pushName: msg.pushName || senderJid.split('@')[0],
            hp: 5,
            inventory: [],
            betAmount: 0,
            isHandcuffed: false,
            hasUsedItemThisTurn: false,
            handSawActive: false,
            isAfk: false
        };

        gameSessions.set(sessionId, {
            sessionId,
            chatId: jid,
            status: 'LOBBY',
            players: [creator],
            potAmount: 0,
            turnIndex: 0,
            shells: [],
            createdAt: Date.now(),
            lastActionAt: Date.now(),
            timeoutId
        });

        registerCancellableSession({
            sessionId: `roulette_${sessionId}`,
            feature: 'roulette',
            userJid: senderJid,
            chatJid: jid,
            description: 'Buckshot Roulette lobby',
            onCancel: async () => {
                const session = gameSessions.get(sessionId);
                if (session && session.status === 'LOBBY') {
                    if (session.timeoutId) {
                        clearTimeout(session.timeoutId);
                    }
                    gameSessions.delete(sessionId);
                    for (const player of session.players) {
                        if (player.betAmount > 0) {
                            try {
                                await prisma.user.update({
                                    where: { id: player.userId },
                                    data: { balance: { increment: BigInt(player.betAmount) } }
                                });
                            } catch {
                                // ignore
                            }
                        }
                    }
                    return `❌ *GAME CANCELLED!*\nThe Buckshot Roulette lobby (ID: \`${sessionId}\`) has been cancelled by the host. All placed bets have been refunded.`;
                }
            }
        });

        return `🔫 *ROULETTE MINIGAME* 🔫\n\nRoom successfully created by 👑 @${creator.pushName}!\n🆔 *Session ID:* \`${sessionId}\`\n\nWaiting for other players to join...\n👉 Type *.joingame ${sessionId}* to join this session.\n⏱️ *Timeout:* 30 Seconds if no one joins.`;
    }
};

export default createGameTool;
