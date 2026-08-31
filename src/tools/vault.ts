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
        
        const income = vault.income.toString();
        const payout = vault.payout.toString();
        const netProfit = vault.netProfit.toString();

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

        const text = `🏦 *House Vault Statistics*\n\n` +
            `📈 *Total Income:* ${income} coins\n` +
            `📉 *Total Payout:* ${payout} coins\n` +
            `💰 *Net Profit:* ${netProfit} coins`;

        await new Promise(resolve => setTimeout(resolve, 3000));
        await sock.sendMessage(jid, { text }, { quoted: fakeWafQuote as any });
    }
};

export default vaultTool;
