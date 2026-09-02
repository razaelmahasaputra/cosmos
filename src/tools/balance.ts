import { ToolModule, ToolContext } from './types.js';
import { prisma } from '../db.js';
import { getSenderJid, resolveId } from '../utils/casino.js';
import { getUser } from '../utils/casino.js';

const balanceTool: ToolModule = {
    definition: {
        name: 'balance',
        aliases: ['uang'],
        description: 'Check your current casino coin balance. Owner can check other users by mentioning them.',
        category: 'Casino',
        parameters: {
            type: 'object',
            properties: {
                target: { type: 'string', description: 'Target user to check balance of (Optional, Owner only)' }
            }
        }
    },
    execute: async (args: Record<string, any>, ctx: ToolContext) => {
        const { msg, sock } = ctx;
        const senderJid = getSenderJid(msg);

        const mentionedJidList = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        const targetJid = mentionedJidList.length > 0 ? mentionedJidList[0] : null;

        let queryJid = senderJid;
        let isCheckingOther = false;

        if (targetJid && targetJid !== senderJid) {
            const ownerNumber = process.env.BOT_PHONE_NUMBER ? process.env.BOT_PHONE_NUMBER.trim() : null;
            const senderRaw = senderJid ? senderJid.split(':')[0].split('@')[0] : null;
            const isOwner = Boolean(msg.key.fromMe) || (ownerNumber !== null && senderRaw === ownerNumber);

            if (!isOwner) {
                await sock.sendMessage(
                    msg.key.remoteJid!,
                    { text: "❌ Only the bot owner can check other users' balances." },
                    { quoted: msg }
                );
                return;
            }
            queryJid = await resolveId(targetJid, sock, msg.key.remoteJid);
            isCheckingOther = true;
        }

        const pushName = !isCheckingOther ? msg.pushName || undefined : undefined;
        const user = await getUser(prisma, queryJid, pushName);

        await new Promise((resolve) => setTimeout(resolve, 3000));

        let displayId = queryJid.split('@')[0];
        let mentionArray: string[] = [];

        if (isCheckingOther && targetJid) {
            displayId = targetJid.split('@')[0];
            mentionArray = [targetJid];
        }

        let text = `💰 *Your Balance*\n\nYou currently have *Rp ${Number(user.balance).toLocaleString('id-ID')}*.\nKeep playing and claim your daily reward!`;
        if (isCheckingOther) {
            text = `💰 *User Balance*\n\n@${displayId} currently has *Rp ${Number(user.balance).toLocaleString('id-ID')}*.`;
        }

        await sock.sendMessage(
            msg.key.remoteJid!,
            {
                text,
                mentions: mentionArray
            },
            { quoted: msg }
        );
    }
};

export default balanceTool;
