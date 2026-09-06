import { ToolDefinition, ToolContext, ToolModule } from './types.js';
import { getSenderJid } from '#/utils/casino.js';
import { requireIdCard } from '#/utils/idCard.js';

export const definition: ToolDefinition = {
    name: 'apply-job',
    title: 'Job Application',
    category: 'Employment',
    aliases: ['applyjob', 'job'],
    description: 'Apply for virtual employment. Requires a valid Virtual ID Card.',
    parameters: {
        type: 'object',
        properties: {
            role: {
                type: 'string',
                description: 'The job position or role you are applying for (e.g. Developer, Designer).'
            }
        },
        required: ['role']
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

    const role = (args.role || '').trim();
    if (!role) {
        return 'Please specify the job position you are applying for (e.g., .apply-job Developer).';
    }

    return `Your application has been submitted. The contract for '${role}' has been registered under the name ${auth.idCard.fullName}, residing at ${auth.idCard.address}.`;
}

const applyJobTool: ToolModule = {
    definition,
    execute
};

export default applyJobTool;
