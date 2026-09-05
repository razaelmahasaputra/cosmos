import { ToolModule, ToolContext } from './types.js';
import { prisma } from '../db.js';
import { getHouseVault } from '../utils/casino.js';
import { formatRupiah } from '../utils/currency.js';

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

        const fakeWafQuote = {
            key: {
                remoteJid: '0@s.whatsapp.net',
                fromMe: false,
                id: 'COSMOS_VAULT_MSG',
                participant: '0@s.whatsapp.net'
            },
            message: {
                conversation: '🏦 Cosmos Global Vault System'
            }
        };

        const text =
            `🏦 *House Vault Statistics*\n\n` +
            `📈 *Total Income:* ${formatRupiah(vault.income)}\n` +
            `📉 *Total Payout:* ${formatRupiah(vault.payout)}\n` +
            `💰 *Net Profit:* ${formatRupiah(vault.netProfit)}`;

        await new Promise((resolve) => setTimeout(resolve, 3000));
        await sock.sendMessage(jid, { text }, { quoted: fakeWafQuote as any });
    }
};

export default vaultTool;
