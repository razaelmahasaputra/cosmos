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
        return ctx.t('tools.apply_job.cannot_determine_sender');
    }

    // Step 1: Verification Hook (IdCard Requirement)
    const auth = await requireIdCard(senderJid, ctx.t);
    if (!auth.authorized || !auth.idCard) {
        return auth.message!;
    }

    const role = (args.role || '').trim();
    if (!role) {
        return ctx.t('tools.apply_job.specify_role');
    }

    return ctx.t('tools.apply_job.submitted', {
        role,
        name: auth.idCard.fullName,
        address: auth.idCard.address
    });
}

const applyJobTool: ToolModule = {
    definition,
    execute
};

export default applyJobTool;
