import { ToolDefinition, ToolContext, ToolModule } from './types.js';
import { getSenderJid } from '#/utils/casino.js';
import { requireIdCard, calculateAge } from '#/utils/idCard.js';

export const definition: ToolDefinition = {
    name: 'apply-license',
    title: 'Driver License Application',
    category: 'Licensing',
    aliases: ['applylicense', 'sim'],
    description: 'Apply for a virtual driver license. Requires a valid Virtual ID Card and age >= 17.',
    parameters: {
        type: 'object',
        properties: {
            licenseType: {
                type: 'string',
                description: 'Optional license category (e.g. A, C).'
            }
        }
    }
};

export async function execute(args: Record<string, any>, ctx: ToolContext): Promise<string> {
    const senderJid = getSenderJid(ctx.msg, ctx.sock);
    if (!senderJid) {
        return ctx.t('tools.apply_license.cannot_determine_sender');
    }

    // Step 1: Verification Hook (IdCard Requirement)
    const auth = await requireIdCard(senderJid, ctx.t);
    if (!auth.authorized || !auth.idCard) {
        return auth.message!;
    }

    const { idCard } = auth;

    // Step 2: Calculate user's age from dateOfBirth with month/day precision
    const age = calculateAge(idCard.dateOfBirth);

    if (age < 17) {
        return ctx.t('tools.apply_license.underage', { age });
    }

    const licenseType = (args.licenseType || 'A').toUpperCase().trim();
    return ctx.t('tools.apply_license.verified', {
        name: idCard.fullName,
        age,
        licenseType
    });
}

const applyLicenseTool: ToolModule = {
    definition,
    execute
};

export default applyLicenseTool;
