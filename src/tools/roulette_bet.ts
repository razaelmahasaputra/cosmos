import { ToolModule, ToolContext } from './types.js';
import { getSessionByChatId } from '../utils/roulette.js';
import { getSenderJid } from '../utils/casino.js';
import { prisma } from '../db.js';

const betTool: ToolModule = {
    definition: {
        name: 'bet',
        description: 'Place a bet for the Buckshot Roulette minigame',
        category: 'Games',
        parameters: {
            type: 'object',
            properties: {
                input: { type: 'string', description: 'Bet amount' }
            },
            required: ['input']
        }
    },
    execute: async (args: Record<string, any>, ctx: ToolContext) => {
        const { msg, jid } = ctx;
        const senderJid = getSenderJid(msg);
        const amountStr = String(args.input || '').trim();
        const amount = parseInt(amountStr);

        if (isNaN(amount) || amount < 25) {
            return `❌ Minimum bet is 25 Coins.`;
        }

        const session = getSessionByChatId(jid);
        if (!session) {
            return `❌ No active game session in this group.`;
        }

        if (session.status !== 'LOBBY') {
            return `❌ Betting is closed. The game has already started.`;
        }

        const player = session.players.find((p) => p.userId === senderJid);
        if (!player) {
            return `❌ You are not in this game session. Type .joingame ${session.sessionId} first.`;
        }

        if (player.betAmount > 0) {
            return `❌ You have already placed a bet.`;
        }

        // Deduct from DB
        const user = await prisma.user.findUnique({ where: { id: senderJid } });
        if (!user || user.balance < amount) {
            return `❌ Insufficient balance. You have ${user?.balance || 0} Coins.`;
        }

        await prisma.user.update({
            where: { id: senderJid },
            data: { balance: { decrement: amount } }
        });

        player.betAmount = amount;
        session.potAmount += amount;

        return `💰 @${player.pushName} placed a bet of *${amount} Coins*.\n📊 *Current Total Pot:* ${session.potAmount} Coins (Waiting for other players...)`;
    }
};

export default betTool;
