import { PrismaClient } from './generated/prisma/client.js';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { AsyncLocalStorage } from 'async_hooks';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

export const dbContext = new AsyncLocalStorage<{ sessionId: string; prisma: PrismaClient }>();
const clients = new Map<string, PrismaClient>();

export function getPrismaClient(sessionId: string = 'default'): PrismaClient {
    if (clients.has(sessionId)) return clients.get(sessionId)!;

    const baseDbPath = process.env.DATABASE_URL?.replace('file:', '') || './storage/database.sqlite';
    let targetDbPath = baseDbPath;

    if (sessionId !== 'default') {
        const parsed = path.parse(baseDbPath);
        targetDbPath = path.join(parsed.dir, `${sessionId}.sqlite`);

        if (!fs.existsSync(targetDbPath)) {
            // Copy base schema/DB if it exists to ensure migrations are present
            if (fs.existsSync(baseDbPath)) {
                fs.copyFileSync(baseDbPath, targetDbPath);
                console.log(`[DB] Created separate database for session: ${sessionId}`);
            }
        }
    }

    const adapter = new PrismaBetterSqlite3({ url: targetDbPath });
    const client = new PrismaClient({ adapter });
    clients.set(sessionId, client);
    return client;
}

const defaultClient = getPrismaClient('default');

export const prisma = new Proxy(defaultClient, {
    get(target, prop, receiver) {
        const store = dbContext.getStore();
        if (store && store.prisma) {
            return Reflect.get(store.prisma, prop, receiver);
        }
        return Reflect.get(target, prop, receiver);
    }
});


export async function addGroup(jid: string): Promise<boolean> {
    try {
        await prisma.whitelistedGroup.upsert({
            where: { jid },
            update: {},
            create: { jid }
        });
        return true;
    } catch (err) {
        console.error('Error adding group:', err);
        return false;
    }
}

export async function isGroupWhitelisted(jid: string): Promise<boolean> {
    try {
        const group = await prisma.whitelistedGroup.findUnique({
            where: { jid }
        });
        return !!group;
    } catch {
        return false;
    }
}
