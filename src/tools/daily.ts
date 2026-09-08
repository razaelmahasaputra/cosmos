import { ToolModule, ToolContext } from './types.js';
import { prisma } from '../db.js';
import { getSenderJid, getUser } from '../utils/casino.js';
import { formatRupiah } from '../utils/currency.js';

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
        const senderJid = getSenderJid(msg, sock);

        const pushName = msg.pushName || undefined;
        const user = await getUser(prisma, senderJid, pushName);

        const now = new Date();

        if (user.lastDailyClaim) {
            const cooldownMs = 24 * 60 * 60 * 1000;
            const timePassed = now.getTime() - user.lastDailyClaim.getTime();

            if (timePassed < cooldownMs) {
                const remainingMs = cooldownMs - timePassed;
                const remainingHours = Math.floor(remainingMs / (1000 * 60 * 60));
                const remainingMinutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));

                let timeString = '';
                if (remainingHours > 0) {
                    timeString += `${remainingHours} hour${remainingHours > 1 ? 's' : ''}`;
                }
                if (remainingMinutes > 0) {
                    if (timeString) timeString += ' and ';
                    timeString += `${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''}`;
                }
                if (!timeString) {
                    timeString = 'less than a minute';
                }

                await sock.sendMessage(
                    msg.key.remoteJid!,
                    {
                        text: `⏳ ${ctx.t('tools.daily.cooldown', { remaining: timeString })}`
                    },
                    { quoted: msg }
                );
                return;
            }
        }

        const reward = 30000;
        const updatedUser = await prisma.user.update({
            where: { id: user.id },
            data: {
                balance: { increment: reward },
                lastDailyClaim: now
            }
        });

        await new Promise((resolve) => setTimeout(resolve, 3000));
        await sock.sendMessage(
            msg.key.remoteJid!,
            {
                text: `🎉 ${ctx.t('tools.daily.claimed', { amount: formatRupiah(reward) })}\nYour new balance is *${formatRupiah(updatedUser.balance)}*.`
            },
            { quoted: msg }
        );
    }
};

export default dailyTool;
