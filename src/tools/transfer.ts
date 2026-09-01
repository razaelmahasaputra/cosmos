import { ToolModule, ToolContext } from './types.js';
import { prisma } from '../db.js';
import { getSenderJid, resolveId } from '../utils/casino.js';
import { getUser } from '../utils/casino.js';

const transferTool: ToolModule = {
    definition: {
        name: 'transfer',
        aliases: ['tf'],
        description: 'Transfer casino coins to another user.',
        category: 'Casino',
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
        const senderJid = getSenderJid(msg);

        const pushName = msg.pushName || undefined;
        const user = await getUser(prisma, senderJid, pushName);

        const mentionedJidList = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        const targetJid = mentionedJidList.length > 0 ? mentionedJidList[0] : null;

        if (!targetJid) {
            return `❌ Please mention a user to transfer coins to. Example: .transfer @user 50`;
        }

        const cleanTargetJid = resolveId(targetJid);

        if (cleanTargetJid === senderJid) {
            return `❌ You cannot transfer coins to yourself.`;
        }

        let cleanedInputStr = String(args.input || '').trim();
        for (const jid of mentionedJidList) {
            const num = jid.split('@')[0];
            cleanedInputStr = cleanedInputStr.replace(new RegExp(`@?${num}`, 'g'), '');
        }

        const amountMatch = cleanedInputStr.match(/\b(\d+)\b/);
        const amount = amountMatch ? parseInt(amountMatch[1], 10) : 0;

        if (isNaN(amount) || amount <= 0) {
            return `❌ Invalid amount. Please specify a valid amount of coins to transfer.`;
        }

        if (user.balance < amount) {
            return `❌ Insufficient balance. You only have ${user.balance} coins.`;
        }

        // Anti-Miss: Transaction wrapper
        try {
            await prisma.$transaction(async (tx) => {
                const sender = await tx.user.findUnique({ where: { id: senderJid } });
                if (!sender || sender.balance < amount) {
                    throw new Error('Insufficient balance');
                }

                await tx.user.upsert({
                    where: { id: cleanTargetJid },
                    update: { balance: { increment: amount } },
                    create: { id: cleanTargetJid, balance: 5 + amount } // 5 is starterpack
                });

                await tx.user.update({
                    where: { id: senderJid },
                    data: { balance: { decrement: amount } }
                });
            });

            await new Promise((resolve) => setTimeout(resolve, 3000));
            await sock.sendMessage(
                msg.key.remoteJid!,
                {
                    text: `💸 *Transfer Successful!*\n\nYou have successfully transferred *${amount}* coins to @${targetJid.split('@')[0]}.\nYour remaining balance is *${user.balance - amount}* coins.`,
                    mentions: [targetJid]
                },
                { quoted: msg }
            );
        } catch (error: any) {
            return `❌ Transfer failed: ${error.message}`;
        }
    }
};

export default transferTool;
