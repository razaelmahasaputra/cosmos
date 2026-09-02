import { ToolModule, ToolContext } from './types.js';
import { prisma } from '../db.js';
import { getHouseVault } from '../utils/casino.js';

const vaultTool: ToolModule = {
    definition: {
        name: 'vault',
        aliases: ['bandar'],
        description: 'View the House Vault statistics.',
        category: 'Casino',
        owner: true,
        parameters: {
            type: 'object',
            properties: {}
        }
    },
    execute: async (args: Record<string, any>, ctx: ToolContext) => {
        const { sock, jid } = ctx;

        const vault = await getHouseVault(prisma);

        const incomeStr = Number(vault.income).toLocaleString('id-ID');
        const payoutStr = Number(vault.payout).toLocaleString('id-ID');
        const netProfitStr = Number(vault.netProfit).toLocaleString('id-ID');

        const fakeWafQuote = {
            key: {
                remoteJid: '0@s.whatsapp.net',
                fromMe: false,
                id: 'WAF_VAULT_MSG',
                participant: '0@s.whatsapp.net'
            },
            message: {
                conversation: '🏦 WAF Global Vault System'
            }
        };

        const text =
            `🏦 *House Vault Statistics*\n\n` +
            `📈 *Total Income:* Rp ${incomeStr}\n` +
            `📉 *Total Payout:* Rp ${payoutStr}\n` +
            `💰 *Net Profit:* Rp ${netProfitStr}`;

        await new Promise((resolve) => setTimeout(resolve, 3000));
        await sock.sendMessage(jid, { text }, { quoted: fakeWafQuote as any });
    }
};

export default vaultTool;
