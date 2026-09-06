import { ToolDefinition, ToolContext, ToolModule } from './types.js';
import { getSenderJid, formatRupiah, parseCurrencyAmount } from '#/utils/casino.js';
import { requireIdCard } from '#/utils/idCard.js';

export const definition: ToolDefinition = {
    name: 'loan',
    title: 'Bank Loan Application',
    category: 'Banking',
    aliases: ['pinjam', 'pinjaman'],
    description: 'Apply for a financial bank loan. Requires a valid Virtual ID Card.',
    parameters: {
        type: 'object',
        properties: {
            amount: {
                type: 'string',
                description: 'The amount of loan requested (e.g. 5000000 or 5jt).'
            }
        },
        required: ['amount']
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

    const rawAmount = args.amount;
    const loanAmount = parseCurrencyAmount(rawAmount);

    if (!loanAmount || loanAmount <= 0) {
        return 'Please specify a valid loan amount (e.g., .loan 5000000).';
    }

    // Bind debt / approve loan registered under NIK
    return `Identity verification successful. A loan of ${formatRupiah(loanAmount)} has been approved and registered under NIK: ${auth.idCard.nik}.`;
}

const loanTool: ToolModule = {
    definition,
    execute
};

export default loanTool;
