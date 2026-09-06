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
        return 'Could not determine your sender identity.';
    }

    // Step 1: Verification Hook (IdCard Requirement)
    const auth = await requireIdCard(senderJid);
    if (!auth.authorized || !auth.idCard) {
        return auth.message!;
    }

    const { idCard } = auth;

    // Step 2: Calculate user's age from dateOfBirth with month/day precision
    const age = calculateAge(idCard.dateOfBirth);

    if (age < 17) {
        return `Application Denied. You must be at least 17 years old to apply for a driver's license. (Calculated age: ${age} years old).`;
    }

    const licenseType = (args.licenseType || 'A').toUpperCase().trim();
    return `Identity verified! Name: ${idCard.fullName}. Age requirement met (${age} years old). Starting your virtual driving test for SIM ${licenseType} now...`;
}

const applyLicenseTool: ToolModule = {
    definition,
    execute
};

export default applyLicenseTool;
