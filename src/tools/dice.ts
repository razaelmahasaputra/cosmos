import { ToolModule, ToolContext } from './types.js';
import { prisma } from '../db.js';
import { getSenderJid } from '../utils/casino.js';
import { getUser, parseBet, executeGamble, MIN_BET } from '../utils/casino.js';
import { formatRupiah } from '../utils/currency.js';
import { chance } from '../utils/casino.js';

const diceTool: ToolModule = {
    definition: {
        name: 'dice',
        description: 'Play dice. Example: .dice 6 1.000.000',
        category: 'Casino',
        parameters: {
            type: 'object',
            properties: {
                input: { type: 'string', description: 'Your guess (1-6) and bet amount' }
            },
            required: ['input']
        }
    },
    execute: async (args: Record<string, any>, ctx: ToolContext) => {
        const { msg, sock, jid } = ctx;
        const senderJid = getSenderJid(msg, sock);

        const pushName = msg.pushName || undefined;
        const user = await getUser(prisma, senderJid, pushName);

        const inputStr = String(args.input || '')
            .trim()
            .toLowerCase();

        const match = inputStr.match(/\b([1-6])\b/);
        const guess = match ? parseInt(match[1], 10) : null;

        if (!guess) {
            return `❌ Please specify your guess (1-6). Example: .dice 6 1.000.000`;
        }

        const betStr = inputStr.replace(new RegExp(`\\b${guess}\\b`), '').trim();
        const bet = parseBet(betStr, Number(user.balance));

        if (bet === null) {
            return `❌ Invalid bet amount. Minimum bet is ${formatRupiah(MIN_BET)}.`;
        }

        // Dice probabilities: 16% win, 84% lose. Multiplier: 5
        const result = await executeGamble(prisma, senderJid, bet, 5, 16, 84, sock, msg);

        if (!result.success) {
            return `❌ ${result.error}`;
        }

        let rolled: number;
        if (result.isWin) {
            rolled = guess;
        } else {
            const possible = [1, 2, 3, 4, 5, 6].filter((n) => n !== guess);
            rolled = chance.pickone(possible);
        }

        const winMsg = result.isWin
            ? `🎉 *You Win!* You earned *${formatRupiah(result.winAmount)}*!`
            : `💀 *You Lose!* You lost *${formatRupiah(bet)}*.`;

        const text =
            `🎲 *DICE ROLL* 🎲\n\n` +
            `You guessed: *${guess}*\n` +
            `Dice rolled: *${rolled}*\n\n` +
            `${winMsg}\n` +
            `Current Balance: *${formatRupiah(result.newBalance)}*`;

        await new Promise((resolve) => setTimeout(resolve, 3000));
        await sock.sendMessage(jid, { text }, { quoted: msg });
    }
};

export default diceTool;
