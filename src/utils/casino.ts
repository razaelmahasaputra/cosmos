import { PrismaClient } from '../generated/prisma/client.js';
import Chance from 'chance';

export const chance = new Chance();

// Fever Time in-memory state
export const casinoState = {
    feverTimeEnd: 0
};

export const isFeverTime = () => Date.now() < casinoState.feverTimeEnd;

export async function getHouseVault(prisma: PrismaClient) {
    let vault = await prisma.houseVault.findUnique({ where: { id: 1 } });
    if (!vault) {
        vault = await prisma.houseVault.create({ data: { id: 1 } });
    }
    return vault;
}

export async function getUser(prisma: PrismaClient, jid: string, pushName?: string) {
    let user = await prisma.user.findUnique({ where: { id: jid } });
    if (!user) {
        user = await prisma.user.create({
            data: { id: jid, pushName: pushName || null }
        });
    } else if (pushName && user.pushName !== pushName) {
        user = await prisma.user.update({
            where: { id: jid },
            data: { pushName }
        });
    }
    return user;
}

export function parseBet(input: string, balance: number): number | null {
    const raw = input.toLowerCase().trim();
    if (raw === 'all' || raw === 'allin' || raw === 'all-in') {
        return balance > 0 ? balance : null;
    }
    const amount = parseInt(raw, 10);
    if (isNaN(amount) || amount <= 0) return null;
    return amount;
}

const mutex = new Set<string>();

type GambleResult = 
    | { success: true; isWin: boolean; winAmount: number; newBalance: number }
    | { success: false; error: string };

export async function executeGamble(
    prisma: PrismaClient,
    jid: string,
    bet: number,
    winMultiplier: number,
    baseWinWeight: number,
    baseLoseWeight: number
): Promise<GambleResult> {
    if (mutex.has(jid)) {
        return { success: false, error: 'Tunggu sebentar, transaksi sedang diproses.' };
    }
    mutex.add(jid);

    try {
        return await prisma.$transaction(async (tx) => {
            const user = await tx.user.findUnique({ where: { id: jid } });
            if (!user) throw new Error('User not found');

            if (user.balance < bet) {
                return { success: false, error: `Saldo tidak mencukupi. Saldo Anda: ${user.balance} Koin.` };
            }
            if (bet < 10) {
                return { success: false, error: 'Minimal taruhan adalah 10 koin.' };
            }

            const now = Date.now();
            if (user.lastGambleAt) {
                const diff = now - user.lastGambleAt.getTime();
                if (diff < 5100) {
                    const sisaDetik = ((5100 - diff) / 1000).toFixed(1);
                    return { success: false, error: `Sabar! Tunggu ${sisaDetik} detik lagi sebelum bertaruh.` };
                }
            }

            let vault = await tx.houseVault.findUnique({ where: { id: 1 } });
            if (!vault) {
                vault = await tx.houseVault.create({ data: { id: 1 } });
            }
            
            let winWeight = baseWinWeight;
            let loseWeight = baseLoseWeight;

            // Fever Time Buff
            if (isFeverTime()) {
                winWeight += 30; // Massive buff
            }

            // Anti-win streak: if won many games recently or total wins > total losses heavily
            if (user.totalWins > user.totalLosses + 10) {
                winWeight = Math.max(1, winWeight - 15);
            }

            // Global RTP
            const netProfit = Number(vault.netProfit);
            if (netProfit < 0 && bet > 500) {
                // Force Lose
                winWeight = 1;
                loseWeight = 99;
            } else if (netProfit > 5000 && bet <= 50) {
                // Breadcrumbing
                winWeight += 40;
            }

            // Dynamic bet scaling (All-in or large bets)
            if (bet >= user.balance * 0.8 && bet >= 100) {
                // Large percentage of balance
                winWeight = Math.max(1, Math.floor(winWeight * 0.5));
            }

            const isWin = chance.weighted([true, false], [winWeight, loseWeight]);

            let winAmount = 0;
            const profitChange = isWin 
                ? BigInt(-1) * BigInt(Math.floor(bet * winMultiplier) - bet) 
                : BigInt(bet);

            if (isWin) {
                winAmount = Math.floor(bet * winMultiplier);
            }

            const balanceChange = isWin ? (winAmount - bet) : -bet;

            // Transaction
            const updatedUser = await tx.user.update({
                where: { id: jid },
                data: {
                    balance: { increment: balanceChange },
                    lastGambleAt: new Date(now),
                    gamesPlayed: { increment: 1 },
                    totalWins: isWin ? { increment: 1 } : undefined,
                    totalLosses: !isWin ? { increment: 1 } : undefined,
                }
            });

            await tx.houseVault.update({
                where: { id: 1 },
                data: {
                    income: isWin ? undefined : { increment: BigInt(bet) },
                    payout: isWin ? { increment: BigInt(winAmount - bet) } : undefined,
                    netProfit: { increment: profitChange }
                }
            });

            return {
                success: true as const,
                isWin,
                winAmount,
                newBalance: updatedUser.balance
            };
        });
    } finally {
        mutex.delete(jid);
    }
}

export const cleanId = (idStr: string | null | undefined): string => {
    if (!idStr) return '';
    const parts = idStr.split('@');
    const user = parts[0].split(':')[0];
    const domain = parts[1] || 's.whatsapp.net';
    return `${user}@${domain}`;
};
