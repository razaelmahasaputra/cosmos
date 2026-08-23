import { prisma } from '#/db.js';
import { WASocket, WAMessage } from '@whiskeysockets/baileys';
import toolsHandler from '#/tools/handler.js';

const autoDlCache = new Map<string, Map<string, boolean>>();

export async function loadAutoDlSettings() {
    try {
        const settings = await prisma.autoDlSetting.findMany();
        for (const setting of settings) {
            let jidMap = autoDlCache.get(setting.jid);
            if (!jidMap) {
                jidMap = new Map<string, boolean>();
                autoDlCache.set(setting.jid, jidMap);
            }
            jidMap.set(setting.platform, setting.enabled);
        }
        console.log('[AutoDl] Settings loaded from DB');
    } catch (error) {
        console.error('[AutoDl] Failed to load settings', error);
    }
}

export function isAutoDlEnabled(jid: string, platform: string): boolean {
    const jidMap = autoDlCache.get(jid);
    if (!jidMap) return false;
    return !!jidMap.get(platform);
}

export async function setAutoDl(jid: string, platform: string, enabled: boolean): Promise<boolean> {
    try {
        await prisma.autoDlSetting.upsert({
            where: {
                jid_platform: {
                    jid,
                    platform
                }
            },
            update: { enabled },
            create: { jid, platform, enabled }
        });

        let jidMap = autoDlCache.get(jid);
        if (!jidMap) {
            jidMap = new Map<string, boolean>();
            autoDlCache.set(jid, jidMap);
        }
        jidMap.set(platform, enabled);
        return true;
    } catch (error) {
        console.error('[AutoDl] Failed to set auto dl', error);
        return false;
    }
}

export async function processAutoDl(sock: WASocket, msg: WAMessage, jid: string, text: string) {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const matches = text.match(urlRegex);
    if (!matches) return;

    for (const url of matches) {
        let platform = '';
        let toolName = '';

        if (url.includes('tiktok.com')) {
            platform = 'tiktok';
            toolName = 'tiktokdl';
        } else if (url.includes('instagram.com') || url.includes('instagr.am')) {
            platform = 'ig';
            toolName = 'ytdl'; // Since ytdl uses yt-dlp which supports IG
        } else if (url.includes('pin.it') || url.includes('pinterest.com')) {
            platform = 'pin';
            toolName = 'pinterestdl';
        } else if (url.includes('youtube.com') || url.includes('youtu.be')) {
            platform = 'yt';
            toolName = 'ytdl';
        } else if (url.includes('t.me')) {
            platform = 'tg';
            toolName = 'telegramdl';
        }

        if (platform && isAutoDlEnabled(jid, platform)) {
            console.log(`[AutoDl] Triggered for platform ${platform} with URL ${url}`);
            try {
                // Ensure we don't spam if there are multiple URLs
                const result = await toolsHandler.execute(toolName, { url }, { sock, msg, jid });
                if (result && typeof result === 'string' && result.trim().length > 0) {
                    await sock.sendMessage(jid, { text: result }, { quoted: msg });
                }
            } catch (err) {
                console.error(`[AutoDl] Error executing ${toolName}:`, err);
            }
        }
    }
}
