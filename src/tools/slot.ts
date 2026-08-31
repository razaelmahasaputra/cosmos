import { ToolModule, ToolContext } from './types.js';
import { prisma } from '../db.js';
import { cleanId } from '../utils/casino.js';
import { getUser, parseBet, executeGamble } from '../utils/casino.js';
import { chance } from '../utils/casino.js';

const SLOTS = ['🍒', '🍋', '🔔', '💎', '7️⃣'];

const slotTool: ToolModule = {
    definition: {
        name: 'slot',
        description: 'Play the slot machine. Example: .slot 100 or .slot all',
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
        const senderJid = cleanId(msg.key.participant || msg.key.remoteJid!);
        
        const pushName = msg.pushName || undefined;
        const user = await getUser(prisma, senderJid, pushName);
        
        const inputStr = String(args.bet || '').trim();
        if (!inputStr) {
            return `❌ Please specify your bet amount. Example: .slot 100`;
        }

        const bet = parseBet(inputStr, user.balance);
        if (bet === null) {
            return `❌ Invalid bet amount. Minimum bet is 10 coins.`;
        }

        // Slot probabilities: 20% win, 80% lose
        const result = await executeGamble(prisma, senderJid, bet, 3, 20, 80);
        
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
            ? `🎉 *JACKPOT!* You won *${result.winAmount}* coins!` 
            : `💀 *YOU LOSE!* You lost *${bet}* coins.`;

        const text = `🎰 *SLOT MACHINE* 🎰\n\n` +
            `[ ${slot1} | ${slot2} | ${slot3} ]\n\n` +
            `${winMsg}\n` +
            `Current Balance: *${result.newBalance}* coins`;

        await sock.sendMessage(jid, { text }, { quoted: msg });
    }
};

export default slotTool;
