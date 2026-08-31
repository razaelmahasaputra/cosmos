import { ToolModule, ToolContext } from './types.js';
import { prisma } from '../db.js';
import { cleanId } from '../utils/casino.js';
import { getUser } from '../utils/casino.js';

const dailyTool: ToolModule = {
    definition: {
        name: 'daily',
        aliases: ['klaim', 'claim'],
        description: 'Claim your daily casino coin reward.',
        category: 'Casino',
        parameters: {
            type: 'object',
            properties: {}
        }
    },
    execute: async (args: Record<string, any>, ctx: ToolContext) => {
        const { msg, sock } = ctx;
        const senderJid = cleanId(msg.key.participant || msg.key.remoteJid!);
        
        const pushName = msg.pushName || undefined;
        const user = await getUser(prisma, senderJid, pushName);
        
        const now = new Date();
        const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

        if (user.lastDailyClaim) {
            const lastClaimUTC = new Date(Date.UTC(
                user.lastDailyClaim.getUTCFullYear(),
                user.lastDailyClaim.getUTCMonth(),
                user.lastDailyClaim.getUTCDate()
            ));
            
            if (todayUTC.getTime() === lastClaimUTC.getTime()) {
                await sock.sendMessage(msg.key.remoteJid!, {
                    text: `⏳ You have already claimed your daily reward for today.\nPlease return tomorrow (UTC) for your next claim.`
                }, { quoted: msg });
                return;
            }
        }

        const reward = 50;
        await prisma.user.update({
            where: { id: senderJid },
            data: {
                balance: { increment: reward },
                lastDailyClaim: now
            }
        });

        await new Promise(resolve => setTimeout(resolve, 3000));
        await sock.sendMessage(msg.key.remoteJid!, {
            text: `🎉 *Daily Reward Claimed!*\n\nYou have received *${reward}* coins.\nYour new balance is *${user.balance + reward}* coins.`
        }, { quoted: msg });
    }
};

export default dailyTool;
