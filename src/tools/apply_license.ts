import { ToolDefinition, ToolContext, ToolModule } from './types.js';
import { getSenderJid } from '#/utils/casino.js';
import { requireIdCard } from '#/utils/idCard.js';

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

export async function execute(_args: Record<string, any>, ctx: ToolContext): Promise<string> {
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

    // Step 2: Calculate user's age from dateOfBirth
    let birthYear = 2000;
    const match = idCard.dateOfBirth.match(/\d{4}/);
    if (match) {
        birthYear = parseInt(match[0], 10);
    } else {
        const parts = idCard.dateOfBirth.match(/\d+/g);
        if (parts && parts.length >= 3) {
            const lastPart = parseInt(parts[parts.length - 1], 10);
            birthYear = lastPart < 100 ? (lastPart > 30 ? 1900 + lastPart : 2000 + lastPart) : lastPart;
        }
    }

    const currentYear = new Date().getFullYear();
    const age = currentYear - birthYear;

    if (age < 17) {
        return `Application Denied. You must be at least 17 years old to apply for a driver's license. (Calculated age: ${age} years old).`;
    }

    return `Identity verified! Name: ${idCard.fullName}. Age requirement met. Starting your virtual driving test now...`;
}

const applyLicenseTool: ToolModule = {
    definition,
    execute
};

export default applyLicenseTool;
