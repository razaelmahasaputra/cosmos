import { ToolDefinition, ToolContext, ToolModule } from './types.js';
import { getSenderJid } from '#/utils/casino.js';
import {
    getIdCardByUser,
    startRegistrationSession,
    isUserRegistering,
    cancelRegistrationSession
} from '#/utils/idCard.js';
import { generateIdCardImage, fetchUserProfilePic } from '#/utils/imageProcessing.js';

export const definition: ToolDefinition = {
    name: 'idcard',
    title: 'Virtual ID Card',
    category: 'General',
    aliases: ['register-id', 'registerid', 'ktp', 'myid', 'check-id', 'cancel'],
    description: 'View your Virtual ID Card or register a new identity card.',
    parameters: {
        type: 'object',
        properties: {
            action: {
                type: 'string',
                description: 'Optional action parameter (e.g. register, view, cancel).'
            }
        }
    }
};

export async function execute(args: Record<string, any>, ctx: ToolContext): Promise<string | void> {
    const senderJid = getSenderJid(ctx.msg, ctx.sock);
    if (!senderJid) {
        return 'Could not determine your sender identity.';
    }

    const rawText = (ctx.msg.message?.conversation || ctx.msg.message?.extendedTextMessage?.text || '').trim();
    const commandPart = rawText.split(/\s+/)[0]?.toLowerCase() || '';
    const actionArg = (args.action || '').trim().toLowerCase();

    const isRegisterCommand =
        commandPart === '.register-id' ||
        commandPart === '.registerid' ||
        actionArg === 'register' ||
        actionArg === 'daftar';

    const isCancelCommand = commandPart === '.cancel' || actionArg === 'cancel' || actionArg === 'batal';

    if (isCancelCommand) {
        if (isUserRegistering(senderJid, ctx.jid)) {
            cancelRegistrationSession(senderJid);
            return 'Virtual ID card registration has been cancelled.';
        }
        return 'You do not have an active ID card registration session in this chat.';
    }

    if (isRegisterCommand) {
        const existing = await getIdCardByUser(senderJid);
        if (existing) {
            await ctx.sock.sendMessage(
                ctx.jid,
                {
                    text: `You already possess a registered Virtual ID Card (NIK: ${existing.nik}). Duplicate registrations are not permitted. Fetching your card now...`
                },
                { quoted: ctx.msg }
            );

            try {
                const pfp = await fetchUserProfilePic(
                    ctx.sock,
                    (ctx.msg.key.participant || ctx.msg.key.remoteJid) ?? senderJid
                );
                const imageBuffer = await generateIdCardImage(existing, pfp);
                const caption =
                    `Here is your Virtual ID Card.\n\n` +
                    `*NIK:* ${existing.nik}\n` +
                    `*Full Name:* ${existing.fullName}\n` +
                    `*Date of Birth:* ${existing.dateOfBirth}\n` +
                    `*Gender:* ${existing.gender}\n` +
                    `*Citizenship:* ${existing.citizenship}\n` +
                    `*Valid Until:* ${existing.validUntil}`;

                await ctx.sock.sendMessage(ctx.jid, { image: imageBuffer, caption }, { quoted: ctx.msg });
            } catch (err) {
                console.error('[IdCard] Error fetching existing card image:', err);
            }
            return;
        }

        if (isUserRegistering(senderJid, ctx.jid)) {
            return 'You already have an active registration in progress. Please reply to the prompt or type *.cancel* to abort.';
        }

        const prompt = startRegistrationSession(senderJid, ctx.jid);
        await ctx.sock.sendMessage(ctx.jid, { text: prompt }, { quoted: ctx.msg });
        return;
    }

    // Default: View existing ID Card
    const existing = await getIdCardByUser(senderJid);
    if (!existing) {
        return 'You do not possess a Virtual ID Card yet. Please register your identity first using the *.register-id* command.';
    }

    try {
        await ctx.sock.sendMessage(ctx.jid, { text: '⏳ Fetching your Virtual ID Card...' }, { quoted: ctx.msg });
        const pfp = await fetchUserProfilePic(
            ctx.sock,
            (ctx.msg.key.participant || ctx.msg.key.remoteJid) ?? senderJid
        );
        const imageBuffer = await generateIdCardImage(existing, pfp);
        const caption =
            `Here is your Virtual ID Card.\n\n` +
            `*NIK:* ${existing.nik}\n` +
            `*Full Name:* ${existing.fullName}\n` +
            `*Place & Date of Birth:* ${existing.placeOfBirth}, ${existing.dateOfBirth}\n` +
            `*Gender:* ${existing.gender}\n` +
            `*Address:* ${existing.address}\n` +
            `*Religion:* ${existing.religion}\n` +
            `*Marital Status:* ${existing.maritalStatus}\n` +
            `*Occupation:* ${existing.occupation}\n` +
            `*Citizenship:* ${existing.citizenship}\n` +
            `*Valid Until:* ${existing.validUntil}`;

        await ctx.sock.sendMessage(ctx.jid, { image: imageBuffer, caption }, { quoted: ctx.msg });
    } catch (err) {
        console.error('[IdCard] Error viewing ID card:', err);
        return 'An error occurred while generating your Virtual ID Card. Please try again later.';
    }
}

const idCardTool: ToolModule = {
    definition,
    execute
};

export default idCardTool;
