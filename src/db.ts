import { PrismaClient } from './generated/prisma/client.js';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import dotenv from 'dotenv';

dotenv.config();

// Default path if not specified in .env
let dbPath = process.env.DATABASE_URL?.replace('file:', '') || './storage/database.sqlite';
const adapter = new PrismaBetterSqlite3({ url: dbPath });

export const prisma = new PrismaClient({ adapter });

// Keep supabase export as null for backward compatibility temporarily if needed
export const supabase = null;

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
