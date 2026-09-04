import { ToolModule, ToolContext } from './types.js';
import { prisma } from '../db.js';
import { formatRupiah } from '../utils/currency.js';

const marketTool: ToolModule = {
    definition: {
        name: 'market',
        aliases: ['economy'],
        description: 'Check the current state of the global economy and inflation.',
        category: 'Economy'
    },
    execute: async (args: Record<string, any>, ctx: ToolContext) => {
        const { msg, sock, jid } = ctx;

        // Fetch latest multiplier
        const latestData = await prisma.economyMultiplier.findFirst({
            orderBy: { appliedAt: 'desc' }
        });

        // Fetch latest exchange rate
        const latestRate = await prisma.exchangeRateLog.findFirst({
            orderBy: { createdAt: 'desc' }
        });

        if (!latestData || !latestRate) {
            await sock.sendMessage(jid, { text: 'Economy data is currently unavailable.' }, { quoted: msg });
            return;
        }

        const text =
            `*📊 Current Market Status*\n\n` +
            `• *Multiplier:* ${latestData.multiplier}x\n` +
            `• *Last Updated:* ${latestData.appliedAt.toLocaleString()}\n` +
            `• *Current Rate:* ${formatRupiah(latestRate.rate)} / USD\n\n` +
            `_Tip: Sell your loot now while inflation is high! 💰_`;

        await sock.sendMessage(jid, { text }, { quoted: msg });
    }
};

export default marketTool;
