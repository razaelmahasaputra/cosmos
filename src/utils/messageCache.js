/**
 * Shared in-memory message cache for getMessage retry callbacks.
 * Exported so any module (tools, handlers) can cache sent messages.
 */
const messageCache = new Map();

const MAX_CACHE_SIZE = 500;

export function cacheMessage(msg) {
    if (!msg.key?.id || !msg.message) return;
    messageCache.set(msg.key.id, msg.message);
    if (messageCache.size > MAX_CACHE_SIZE) {
        const firstKey = messageCache.keys().next().value;
        messageCache.delete(firstKey);
    }
}

export function getCachedMessage(id) {
    return messageCache.get(id) || undefined;
}
