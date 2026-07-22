import { WAMessage, proto } from '@whiskeysockets/baileys';

/**
 * Shared in-memory message cache for getMessage retry callbacks.
 * Exported so any module (tools, handlers) can cache sent messages.
 */
const messageCache = new Map<string, proto.IMessage>();

const MAX_CACHE_SIZE = 500;

export function cacheMessage(msg: WAMessage): void {
    if (!msg.key?.id || !msg.message) return;
    messageCache.set(msg.key.id, msg.message);
    if (messageCache.size > MAX_CACHE_SIZE) {
        const firstKey = messageCache.keys().next().value;
        if (firstKey) {
            messageCache.delete(firstKey);
        }
    }
}

export function getCachedMessage(id: string): proto.IMessage | undefined {
    return messageCache.get(id) || undefined;
}
