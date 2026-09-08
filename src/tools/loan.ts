import { ToolDefinition, ToolContext, ToolModule } from './types.js';
import { getSenderJid } from '#/utils/casino.js';
import { formatRupiah, parseCurrencyAmount } from '#/utils/currency.js';
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
        return ctx.t('tools.loan.cannot_determine_sender');
    }

    // Step 1: Verification Hook (IdCard Requirement)
    const auth = await requireIdCard(senderJid, ctx.t);
    if (!auth.authorized || !auth.idCard) {
        return auth.message!;
    }

    const rawAmount = args.amount;
    const loanAmount = parseCurrencyAmount(rawAmount);

    if (!loanAmount || loanAmount <= 0) {
        return ctx.t('tools.loan.invalid_amount');
    }

    // Bind debt / approve loan registered under NIK
    return ctx.t('tools.loan.approved', {
        amount: formatRupiah(loanAmount),
        nik: auth.idCard.nik
    });
}

const loanTool: ToolModule = {
    definition,
    execute
};

export default loanTool;
