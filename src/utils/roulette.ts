export type ItemType = 'COLA' | 'MAGNIFYING_GLASS' | 'HAND_SAW' | 'HANDCUFFS' | 'CIGARETTES' | 'INVERTER';
export type ShellType = 'LIVE' | 'BLANK';
export type GameStatus = 'LOBBY' | 'PLAYING' | 'FINISHED';

export interface Player {
    userId: string;
    hp: number;
    inventory: ItemType[];
    betAmount: number;
    isHandcuffed: boolean;
    hasUsedItemThisTurn: boolean;
    handSawActive: boolean;
    isAfk: boolean;
}

export interface GameSession {
    sessionId: string;
    chatId: string;
    status: GameStatus;
    players: Player[];
    potAmount: number;
    turnIndex: number;
    shells: ShellType[];
    createdAt: number;
    lastActionAt: number;
    timeoutId?: NodeJS.Timeout;
}

export const gameSessions = new Map<string, GameSession>();

export function generateSessionId(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let id = '';
    for (let i = 0; i < 5; i++) {
        id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
}

export function generateShells(): ShellType[] {
    const count = 5 + Math.floor(Math.random() * 3); // 5 to 7 shells
    const liveCount = Math.floor(count / 2) + (Math.random() > 0.5 ? 1 : 0);
    const shells: ShellType[] = [];

    for (let i = 0; i < liveCount; i++) shells.push('LIVE');
    for (let i = 0; i < count - liveCount; i++) shells.push('BLANK');

    return shells.sort(() => Math.random() - 0.5);
}

export function getRandomItems(count: number): ItemType[] {
    const allItems: ItemType[] = ['COLA', 'MAGNIFYING_GLASS', 'HAND_SAW', 'HANDCUFFS', 'CIGARETTES', 'INVERTER'];
    const items: ItemType[] = [];
    for (let i = 0; i < count; i++) {
        items.push(allItems[Math.floor(Math.random() * allItems.length)]);
    }
    return items;
}

export function getSessionByChatId(chatId: string): GameSession | undefined {
    for (const session of gameSessions.values()) {
        if (session.chatId === chatId) {
            return session;
        }
    }
    return undefined;
}

export function handleElimination(session: GameSession, deadPlayer: Player): string {
    let msg = `\n💀 *ELIMINATED!*\n@${deadPlayer.userId.split('@')[0]}'s lives have run out (0).\n`;

    const alivePlayers = session.players.filter((p) => p.hp > 0);

    if (deadPlayer.inventory.length > 0 && alivePlayers.length > 0) {
        msg += `\n🎁 *DEATH LOOT!*\n@${deadPlayer.userId.split('@')[0]}'s inventory has been dropped...\n`;

        for (const item of deadPlayer.inventory) {
            const eligiblePlayers = alivePlayers.filter((p) => p.inventory.length < 4);
            if (eligiblePlayers.length > 0) {
                const receiver = eligiblePlayers[Math.floor(Math.random() * eligiblePlayers.length)];
                receiver.inventory.push(item);
                msg += `@${receiver.userId.split('@')[0]} received *${item.replace('_', ' ')}*!\n`;
            }
        }
    }
    deadPlayer.inventory = [];
    return msg;
}

export function nextTurn(session: GameSession, shouldRandomize: boolean): string {
    const alivePlayers = session.players.filter((p) => p.hp > 0);
    if (alivePlayers.length <= 1) return '';

    if (shouldRandomize) {
        const randomPlayer = alivePlayers[Math.floor(Math.random() * alivePlayers.length)];
        session.turnIndex = session.players.findIndex((p) => p.userId === randomPlayer.userId);
    } else {
        do {
            session.turnIndex = (session.turnIndex + 1) % session.players.length;
        } while (session.players[session.turnIndex].hp <= 0);
    }

    const nextPlayer = session.players[session.turnIndex];
    nextPlayer.hasUsedItemThisTurn = false;

    let msg = `\n👉 *NEXT TURN:* @${nextPlayer.userId.split('@')[0]}\n`;

    if (nextPlayer.isHandcuffed) {
        nextPlayer.isHandcuffed = false;
        msg += `🔗 @${nextPlayer.userId.split('@')[0]}'s turn is skipped because they are handcuffed!\n`;
        msg += nextTurn(session, false);
    } else {
        const inventoryStr =
            nextPlayer.inventory.length > 0 ? nextPlayer.inventory.map((i) => i.replace('_', ' ')).join(', ') : 'Empty';
        msg += `❤️ Lives: [${'❤️'.repeat(nextPlayer.hp)}${'🖤'.repeat(5 - nextPlayer.hp)}]\n🎒 Inventory: ${inventoryStr}\n🔥 *Active Status:* ${nextPlayer.handSawActive ? 'Hand Saw (Damage x2)' : 'None'}`;
    }

    return msg;
}

export function checkReloadShells(session: GameSession): string {
    if (session.shells.length > 0) return '';

    session.shells = generateShells();
    for (const player of session.players.filter((p) => p.hp > 0)) {
        player.inventory.push(...getRandomItems(2));
        // Ensure max 4 items
        if (player.inventory.length > 4) player.inventory.splice(4);
    }

    const liveCount = session.shells.filter((s) => s === 'LIVE').length;
    const blankCount = session.shells.length - liveCount;

    return `\n🔄 *NEW ROUND BEGINS* 🔄\n\n*Dealer* loads shells into the shotgun...\n🔴 *Live:* ${liveCount}\n⚪ *Blank:* ${blankCount}\n*(Total ${session.shells.length} shells shuffled mysteriously...)*\n\n📦 *Item Distribution:* Each surviving player receives up to 2 random items!\n`;
}
