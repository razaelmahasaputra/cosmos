import { WASocket } from '@whiskeysockets/baileys';
import { prisma } from '../db.js';
import { formatRupiah } from '../utils/currency.js';

export async function broadcastEconomicUpdate(sock: WASocket, multiplier: number, reasoning: string, rate: number) {
    const groups = await prisma.whitelistedGroup.findMany();

    const message =
        `*🏦 WAF Central Bank Update*\n\n` +
        `*Current Exchange Rate:* $1 = ${formatRupiah(rate)}\n` +
        `*Market Trend:* 📉 AI Evaluated\n\n` +
        `*🔄 Economic Adjustments:*\n` +
        `• Global Inflation Multiplier: *${multiplier}x*\n` +
        `• Shop & Loot: ⬆️ *Adjusted proportionally*\n\n` +
        `_🤖 AI Analyst Note: "${reasoning}"_`;

    for (const group of groups) {
        await sock.sendMessage(group.jid, { text: message });
    }
}
