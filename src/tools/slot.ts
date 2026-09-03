import { ToolModule, ToolContext } from './types.js';
import { prisma } from '../db.js';
import { getSenderJid } from '../utils/casino.js';
import { getUser, parseBet, executeGamble, MIN_BET } from '../utils/casino.js';
import { formatRupiah } from '../utils/currency.js';
import { chance } from '../utils/casino.js';

const SLOTS = ['🍒', '🍋', '🔔', '💎', '7️⃣'];

const slotTool: ToolModule = {
    definition: {
        name: 'slot',
        description: 'Play the slot machine. Example: .slot 1.000.000 or .slot all',
        category: 'Casino',
        parameters: {
            type: 'object',
            properties: {
                bet: { type: 'string', description: 'The amount of coins to bet' }
            },
            required: ['bet']
        }
    },
    execute: async (args: Record<string, any>, ctx: ToolContext) => {
        const { msg, sock, jid } = ctx;
        const senderJid = getSenderJid(msg);

        const pushName = msg.pushName || undefined;
        const user = await getUser(prisma, senderJid, pushName);

        const inputStr = String(args.bet || '').trim();
        if (!inputStr) {
            return `❌ Please specify your bet amount. Example: .slot 1.000.000`;
        }

        const bet = parseBet(inputStr, Number(user.balance));
        if (bet === null) {
            return `❌ Invalid bet amount. Minimum bet is ${formatRupiah(MIN_BET)}.`;
        }

        // Slot probabilities: 20% win, 80% lose
        const result = await executeGamble(prisma, senderJid, bet, 3, 20, 80, sock, msg);

        if (!result.success) {
            return `❌ ${result.error}`;
        }

        let slot1, slot2, slot3;
        if (result.isWin) {
            const winSymbol = chance.pickone(SLOTS);
            slot1 = slot2 = slot3 = winSymbol;
        } else {
            slot1 = chance.pickone(SLOTS);
            slot2 = chance.pickone(SLOTS);
            do {
                slot3 = chance.pickone(SLOTS);
            } while (slot1 === slot2 && slot2 === slot3); // Ensure they don't match
        }

        const winMsg = result.isWin
            ? `🎉 *JACKPOT!* You won *${formatRupiah(result.winAmount)}*!`
            : `💀 *YOU LOSE!* You lost *${formatRupiah(bet)}*.`;

        const text =
            `🎰 *SLOT MACHINE* 🎰\n\n` +
            `[ ${slot1} | ${slot2} | ${slot3} ]\n\n` +
            `${winMsg}\n` +
            `Current Balance: *${formatRupiah(result.newBalance)}*`;

        await new Promise((resolve) => setTimeout(resolve, 3000));
        await sock.sendMessage(jid, { text }, { quoted: msg });
    }
};

export default slotTool;
