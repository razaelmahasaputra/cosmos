import { ToolModule, ToolContext } from './types.js';
import { prisma } from '../db.js';
import { getSenderJid, resolveId, getUser } from '../utils/casino.js';
import { formatRupiah, parseCurrencyAmount } from '../utils/currency.js';
import { logTransaction } from '../utils/transactionLogger.js';

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
        const senderJid = getSenderJid(msg, sock);

        const pushName = msg.pushName || undefined;
        const user = await getUser(prisma, senderJid, pushName);

        const mentionedJidList = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        const targetJid = mentionedJidList.length > 0 ? mentionedJidList[0] : null;

        if (!targetJid) {
            return `❌ Please mention a user to transfer coins to. Example: .transfer @user 50`;
        }

        const cleanTargetJid = await resolveId(targetJid, sock, msg.key.remoteJid);

        if (cleanTargetJid === senderJid) {
            return `❌ You cannot transfer coins to yourself.`;
        }

        let cleanedInputStr = String(args.input || '').trim();
        for (const jid of mentionedJidList) {
            const num = jid.split('@')[0];
            cleanedInputStr = cleanedInputStr.replace(new RegExp(`@?${num}`, 'g'), '');
        }

        const amount = parseCurrencyAmount(cleanedInputStr, Number(user.balance));

        if (amount === null || amount <= 0) {
            return `❌ Invalid amount. Please specify a valid amount of coins to transfer.`;
        }

        if (Number(user.balance) < amount) {
            return `❌ Insufficient balance. You only have ${formatRupiah(user.balance)}.`;
        }

        // Anti-Miss: Transaction wrapper
        try {
            await prisma.$transaction(async (tx) => {
                const sender = await tx.user.findUnique({ where: { id: senderJid } });
                if (!sender || Number(sender.balance) < amount) {
                    throw new Error('Insufficient balance');
                }

                const targetUser = await getUser(tx as any, cleanTargetJid);
                await tx.user.update({
                    where: { id: targetUser.id },
                    data: { balance: { increment: amount } }
                });

                await tx.user.update({
                    where: { id: senderJid },
                    data: { balance: { decrement: amount } }
                });
            });

            // Log the successful transfer
            logTransaction(senderJid, cleanTargetJid, amount);

            await new Promise((resolve) => setTimeout(resolve, 3000));
            await sock.sendMessage(
                msg.key.remoteJid!,
                {
                    text: `💸 *Transfer Successful!*\n\nYou have successfully transferred *${formatRupiah(amount)}* to @${targetJid.split('@')[0]}.\nYour remaining balance is *${formatRupiah(Number(user.balance) - amount)}*.`,
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
