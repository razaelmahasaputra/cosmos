import { WASocket } from '@whiskeysockets/baileys';
import { gameSessions, handleElimination, nextTurn, checkReloadShells } from './roulette.js';
import { prisma } from '../db.js';

let afkInterval: NodeJS.Timeout | null = null;

export function initRouletteAfkTimer(sock: WASocket) {
    if (afkInterval) {
        clearInterval(afkInterval);
    }

    // Check every 5 seconds
    afkInterval = setInterval(async () => {
        const now = Date.now();
        for (const [sessionId, session] of gameSessions.entries()) {
            if (session.status !== 'PLAYING') continue;

            // If 60 seconds have passed since lastActionAt
            if (now - session.lastActionAt > 60000) {
                const currentPlayer = session.players[session.turnIndex];

                // Set HP to 0 and AFK status
                currentPlayer.hp = 0;
                currentPlayer.isAfk = true;

                // Increase rouletteAfk penalty in DB
                try {
                    await prisma.user.update({
                        where: { id: currentPlayer.userId },
                        data: { rouletteAfk: { increment: 1 } }
                    });
                } catch (err) {
                    console.error('Failed to update AFK penalty:', err);
                }

                let outputMsg = `⏳ *AFK TIMEOUT!*\n@${currentPlayer.userId.split('@')[0]} did not respond for 60 seconds.\n@${currentPlayer.userId.split('@')[0]} has been kicked from the game table! Their bet is forfeited and remains in the Pot!\n`;

                outputMsg += handleElimination(session, currentPlayer);

                // Check if only 1 player is left
                const alivePlayers = session.players.filter((p) => p.hp > 0);
                if (alivePlayers.length === 1) {
                    const winner = alivePlayers[0];
                    session.status = 'FINISHED';

                    const pot = session.potAmount;

                    try {
                        await prisma.user.update({
                            where: { id: winner.userId },
                            data: { balance: { increment: pot }, rouletteWins: { increment: 1 } }
                        });

                        for (const p of session.players) {
                            await prisma.user.update({
                                where: { id: p.userId },
                                data: { rouletteRounds: { increment: 1 } }
                            });
                        }
                    } catch (err) {
                        console.error('Failed to update winner stats:', err);
                    }

                    outputMsg += `\n\n🏆 *GAME OVER!* 🏆\n\nOnly one person has survived this deadly table...\nCongratulations to: *👑 @${winner.userId.split('@')[0]}*!\n\n💰 *PRIZE AWARDED:*\nTakes the entire Pot worth **Rp ${pot.toLocaleString('id-ID')}**!\n\n\`.top roulette\` statistics have been updated.\nType *.creategame* to start a new round of madness!`;

                    gameSessions.delete(sessionId);
                } else {
                    // Turn passes since player was kicked
                    outputMsg += nextTurn(session, true); // Randomize next turn when someone dies

                    const reloadMsg = checkReloadShells(session);
                    if (reloadMsg) {
                        outputMsg += `\n${reloadMsg}`;
                        const nextP = session.players[session.turnIndex];
                        const inventoryStr =
                            nextP.inventory.length > 0
                                ? nextP.inventory.map((i) => i.replace('_', ' ')).join(', ')
                                : 'Empty';
                        outputMsg += `\n👇 *TURN:* @${nextP.userId.split('@')[0]}\n❤️ Lives: [${'❤️'.repeat(nextP.hp)}${'🖤'.repeat(5 - nextP.hp)}]\n🎒 Inventory: ${inventoryStr}`;
                    }
                }

                const mentions = session.players.map((p) => p.userId);
                try {
                    await sock.sendMessage(session.chatId, { text: outputMsg, mentions });
                } catch (err) {
                    console.error('Failed to send AFK message:', err);
                }

                // Update lastActionAt so we don't spam if something goes wrong
                session.lastActionAt = Date.now();
            }
        }
    }, 5000);
}
