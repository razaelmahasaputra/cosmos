import { ToolModule, ToolContext } from './types.js';
import { getSessionByChatId } from '../utils/roulette.js';
import { getSenderJid, MIN_BET, MAX_BET } from '../utils/casino.js';
import { formatRupiah, parseCurrencyAmount } from '../utils/currency.js';
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
        const { msg, sock, jid } = ctx;
        const senderJid = getSenderJid(msg, sock);
        const user = await prisma.user.findFirst({ where: { OR: [{ id: senderJid }, { lid: senderJid }] } });
        const amount = parseCurrencyAmount(String(args.input || ''), user?.balance);

        if (amount === null || isNaN(amount) || amount < MIN_BET) {
            return `❌ Minimum bet is ${formatRupiah(MIN_BET)}.`;
        }

        if (amount > MAX_BET) {
            return `❌ Maximum bet is ${formatRupiah(MAX_BET)}.`;
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
        if (!user || Number(user.balance) < amount) {
            return `❌ Insufficient balance. You have ${formatRupiah(user?.balance || 0)}.`;
        }

        await prisma.user.update({
            where: { id: senderJid },
            data: { balance: { decrement: amount } }
        });

        player.betAmount = amount;
        session.potAmount += amount;

        return `💰 @${player.pushName} placed a bet of *${formatRupiah(amount)}*.\n📊 *Current Total Pot:* ${formatRupiah(session.potAmount)} (Waiting for other players...)`;
    }
};

export default betTool;
