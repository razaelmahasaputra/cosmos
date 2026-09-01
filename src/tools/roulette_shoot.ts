import { ToolModule, ToolContext } from './types.js';
import { gameSessions, getSessionByChatId, handleElimination, nextTurn, checkReloadShells } from '../utils/roulette.js';
import { cleanId, getSenderJid } from '../utils/casino.js';
import { prisma } from '../db.js';

const shootTool: ToolModule = {
    definition: {
        name: 'shoot',
        description: 'Shoot a player or yourself in Buckshot Roulette',
        category: 'Games',
        parameters: {
            type: 'object',
            properties: {
                input: { type: 'string', description: 'Target player tag or "me"' }
            },
            required: ['input']
        }
    },
    execute: async (args: Record<string, any>, ctx: ToolContext) => {
        const { msg, sock, jid } = ctx;
        const senderJid = getSenderJid(msg);
        const inputStr = String(args.input || '')
            .trim()
            .toLowerCase();

        const session = getSessionByChatId(jid);
        if (!session || session.status !== 'PLAYING') {
            return `❌ No active Buckshot Roulette game in this group.`;
        }

        const currentPlayer = session.players[session.turnIndex];
        if (currentPlayer.userId !== senderJid) {
            return `❌ It's not your turn!`;
        }

        let targetId = '';
        if (inputStr === 'me') {
            targetId = senderJid;
        } else {
            const mentionedJidList = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
            if (mentionedJidList.length > 0) {
                targetId = cleanId(mentionedJidList[0]);
            } else {
                return `❌ Please specify a target. Example: .shoot @user or .shoot me`;
            }
        }

        const target = session.players.find((p) => p.userId === targetId);
        if (!target || target.hp <= 0) {
            return `❌ Target is invalid or already eliminated.`;
        }

        const currentShell = session.shells.pop(); // Remove front shell
        const isSelfShoot = senderJid === targetId;
        const damage = currentPlayer.handSawActive ? 2 : 1;
        let targetEliminated = false;

        currentPlayer.handSawActive = false;

        let outputMsg = `💥 @${senderJid.split('@')[0]} aims the shotgun at @${targetId.split('@')[0]}...\n`;

        await sock.sendMessage(jid, { text: outputMsg, mentions: [senderJid, targetId] });
        await new Promise((resolve) => setTimeout(resolve, 2000));

        outputMsg = ''; // Reset for the result

        if (currentShell === 'LIVE') {
            outputMsg += `*BANG!!!*\n🔴 *LIVE SHELL*\n`;
            target.hp -= damage;

            if (target.hp <= 0) {
                targetEliminated = true;
                outputMsg += handleElimination(session, target);
            }

            outputMsg += nextTurn(session, targetEliminated);
        } else {
            outputMsg += `*CLICK!*\n⚪ *BLANK SHELL*\n@${targetId.split('@')[0]} survived the shot!\n`;

            if (isSelfShoot) {
                outputMsg += `\nTurn does not pass! You may continue your action.`;
            } else {
                outputMsg += nextTurn(session, false);
            }
        }

        outputMsg += `\n*(Remaining shells in barrel: ${session.shells.length})*`;

        // Check game over
        const alivePlayers = session.players.filter((p) => p.hp > 0);
        if (alivePlayers.length === 1) {
            const winner = alivePlayers[0];
            session.status = 'FINISHED';

            // Update stats
            const pot = session.potAmount;

            // Give money to winner
            await prisma.user.update({
                where: { id: winner.userId },
                data: { balance: { increment: pot }, rouletteWins: { increment: 1 } }
            });

            // Update matches played for all
            for (const p of session.players) {
                await prisma.user.update({
                    where: { id: p.userId },
                    data: { rouletteRounds: { increment: 1 } }
                });
            }

            outputMsg += `\n\n🏆 *GAME OVER!* 🏆\n\nOnly one person has survived this deadly table...\nCongratulations to: *👑 @${winner.userId.split('@')[0]}*!\n\n💰 *PRIZE AWARDED:*\nTakes the entire Pot worth **${pot} Coins**!\n\n\`.top roulette\` statistics have been updated.\nType *.creategame* to start a new round of madness!`;

            gameSessions.delete(session.sessionId);
        } else {
            const reloadMsg = checkReloadShells(session);
            if (reloadMsg) {
                outputMsg += `\n${reloadMsg}`;
                // After reload, we need to show the next turn info again because it might have gotten buried
                const nextP = session.players[session.turnIndex];
                const inventoryStr =
                    nextP.inventory.length > 0 ? nextP.inventory.map((i) => i.replace('_', ' ')).join(', ') : 'Empty';
                outputMsg += `\n👇 *TURN:* @${nextP.userId.split('@')[0]}\n❤️ Lives: [${'❤️'.repeat(nextP.hp)}${'🖤'.repeat(5 - nextP.hp)}]\n🎒 Inventory: ${inventoryStr}`;
            }
        }

        const mentions = session.players.map((p) => p.userId);
        await sock.sendMessage(jid, { text: outputMsg, mentions });
        return null;
    }
};

export default shootTool;
