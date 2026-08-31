import { ToolModule, ToolContext } from './types.js';
import { prisma } from '../db.js';

const addBalanceTool: ToolModule = {
    definition: {
        name: 'addbalance',
        description: 'Add balance to a user from the house vault. (Owner only)',
        category: 'Casino',
        owner: true,
        parameters: {
            type: 'object',
            properties: {
                input: { type: 'string', description: 'Target user and amount' }
            },
            required: ['input']
        }
    },
    execute: async (args: Record<string, any>, ctx: ToolContext) => {
        const { msg, sock } = ctx;

        const mentionedJidList = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        const targetJid = mentionedJidList.length > 0 ? mentionedJidList[0] : null;

        if (!targetJid) {
            return `❌ Please mention a user to add coins to. Example: .addbalance @user 50`;
        }

        let cleanedInputStr = String(args.input || '').trim();
        for (const jid of mentionedJidList) {
            const num = jid.split('@')[0];
            cleanedInputStr = cleanedInputStr.replace(new RegExp(`@?${num}`, 'g'), '');
        }

        const amountMatch = cleanedInputStr.match(/\b(\d+)\b/);
        const amount = amountMatch ? parseInt(amountMatch[1], 10) : 0;

        if (isNaN(amount) || amount <= 0) {
            return `❌ Invalid amount. Please specify a valid amount of coins to add.`;
        }

        try {
            await prisma.$transaction(async (tx) => {
                // Ensure target user exists and add balance
                await tx.user.upsert({
                    where: { id: targetJid },
                    update: { balance: { increment: amount } },
                    create: { id: targetJid, balance: 5 + amount }
                });

                // Ensure vault exists and update
                const vault = await tx.houseVault.findUnique({ where: { id: 1 } });
                if (!vault) {
                    await tx.houseVault.create({
                        data: {
                            id: 1,
                            payout: BigInt(amount),
                            netProfit: BigInt(-amount)
                        }
                    });
                } else {
                    await tx.houseVault.update({
                        where: { id: 1 },
                        data: {
                            payout: { increment: BigInt(amount) },
                            netProfit: { decrement: BigInt(amount) }
                        }
                    });
                }
            });

            await new Promise(resolve => setTimeout(resolve, 1000));
            await sock.sendMessage(msg.key.remoteJid!, {
                text: `✅ *Balance Added!*\n\nSuccessfully added *${amount}* coins to @${targetJid.split('@')[0]} from the house vault.`,
                mentions: [targetJid]
            }, { quoted: msg });
        } catch (error: any) {
            return `❌ Failed to add balance: ${error.message}`;
        }
    }
};

export default addBalanceTool;
