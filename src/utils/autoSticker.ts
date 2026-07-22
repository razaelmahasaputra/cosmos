const activeAutoStickerJids = new Set<string>();

export function enableAutoSticker(jid: string): void {
    activeAutoStickerJids.add(jid);
}

export function disableAutoSticker(jid: string): boolean {
    return activeAutoStickerJids.delete(jid);
}

export function toggleAutoSticker(jid: string): boolean {
    if (activeAutoStickerJids.has(jid)) {
        activeAutoStickerJids.delete(jid);
        return false;
    } else {
        activeAutoStickerJids.add(jid);
        return true;
    }
}

export function isAutoStickerEnabled(jid: string): boolean {
    return activeAutoStickerJids.has(jid);
}
