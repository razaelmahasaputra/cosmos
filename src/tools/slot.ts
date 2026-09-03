import { ToolModule, ToolContext } from './types.js';
import { prisma } from '../db.js';
import { getSenderJid } from '../utils/casino.js';
import { getUser, parseBet, executeGamble, MIN_BET } from '../utils/casino.js';
import { formatRupiah } from '../utils/currency.js';
import { chance } from '../utils/casino.js';

const SLOT_ITEMS = [
    { symbol: '🍒', multiplier: 2, bonus: 100000, weight: 50 },
    { symbol: '🍋', multiplier: 3, bonus: 200000, weight: 30 },
    { symbol: '🔔', multiplier: 5, bonus: 500000, weight: 12 },
    { symbol: '7️⃣', multiplier: 10, bonus: 1000000, weight: 6 },
    { symbol: '💎', multiplier: 20, bonus: 2000000, weight: 2 }
];

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
        const senderJid = getSenderJid(msg, sock);

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

        // Pre-roll the winning symbol to determine the multiplier
        const winItem = chance.weighted(
            SLOT_ITEMS,
            SLOT_ITEMS.map((item) => item.weight)
        );

        // Slot probabilities: 20% win, 80% lose
        const result = await executeGamble(
            prisma,
            senderJid,
            bet,
            winItem.multiplier,
            20,
            80,
            sock,
            msg,
            winItem.bonus
        );

        if (!result.success) {
            return `❌ ${result.error}`;
        }

        let slot1, slot2, slot3;
        const symbols = SLOT_ITEMS.map((item) => item.symbol);

        if (result.isWin) {
            slot1 = slot2 = slot3 = winItem.symbol;
        } else {
            slot1 = chance.pickone(symbols);
            slot2 = chance.pickone(symbols);
            do {
                slot3 = chance.pickone(symbols);
            } while (slot1 === slot2 && slot2 === slot3); // Ensure they don't match
        }

        const winMsg = result.isWin
            ? `🎉 *JACKPOT!* You got 3 ${winItem.symbol} (${winItem.multiplier}x + ${formatRupiah(winItem.bonus)} Bonus) and won *${formatRupiah(result.winAmount)}*!`
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
