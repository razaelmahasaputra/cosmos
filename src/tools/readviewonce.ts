import { ToolDefinition, ToolContext } from './types.js';
import { downloadContentFromMessage, jidNormalizedUser } from '@whiskeysockets/baileys';
import { writeLog } from '#/logger.js';

export const definition: ToolDefinition = {
    name: 'readviewonce',
    title: 'Read View-Once',
    category: 'Media & Stickers',
    aliases: ['.rvo', '.readviewonce'],
    description: 'Reveals a view-once media message (image, video, or voice note) and resends it as a normal forwarded message.',
    owner: true,
    parameters: {
        type: 'object',
        properties: {},
        required: []
    }
};

export async function execute(_args: Record<string, any>, ctx: ToolContext): Promise<string | void> {
    const { sock, msg, jid } = ctx;

    const getMessage = (m: any): { msg: any; isViewOnce: boolean } => {
        if (!m) return { msg: null, isViewOnce: false };
        if (m.viewOnceMessage?.message) {
            const res = getMessage(m.viewOnceMessage.message);
            return { msg: res.msg, isViewOnce: true };
        }
        if (m.viewOnceMessageV2?.message) {
            const res = getMessage(m.viewOnceMessageV2.message);
            return { msg: res.msg, isViewOnce: true };
        }
        if (m.viewOnceMessageV2Extension?.message) {
            const res = getMessage(m.viewOnceMessageV2Extension.message);
            return { msg: res.msg, isViewOnce: true };
        }
        return { msg: m, isViewOnce: false };
    };

    const quotedMsgInfo = ctx.msg.message?.extendedTextMessage?.contextInfo;
    const quotedMsgRaw = quotedMsgInfo?.quotedMessage;

    if (!quotedMsgRaw) {
        return 'Failed: Please reply to a view-once message with this command.';
    }

    const { msg: quotedMsg, isViewOnce: wrapperIsViewOnce } = getMessage(quotedMsgRaw);

    const imageMessage = quotedMsg?.imageMessage;
    const videoMessage = quotedMsg?.videoMessage;
    const audioMessage = quotedMsg?.audioMessage;

    const isViewOnce = wrapperIsViewOnce || imageMessage?.viewOnce || videoMessage?.viewOnce || audioMessage?.viewOnce;

    if (!isViewOnce) {
        return 'Failed: The quoted message is not a view-once message.';
    }

    if (!imageMessage && !videoMessage && !audioMessage) {
        return 'Failed: Unsupported view-once media type.';
    }

    try {
        let type: 'image' | 'video' | 'audio';
        let mediaMessage: any;

        if (imageMessage) {
            type = 'image';
            mediaMessage = imageMessage;
        } else if (videoMessage) {
            type = 'video';
            mediaMessage = videoMessage;
        } else {
            type = 'audio';
            mediaMessage = audioMessage;
        }

        const stream = await downloadContentFromMessage(mediaMessage, type);
        const chunks: Buffer[] = [];
        for await (const chunk of stream) {
            chunks.push(chunk);
        }
        const buffer = Buffer.concat(chunks);

        const senderRaw = msg.key.fromMe ? sock.user?.id || msg.key.participant || msg.key.remoteJid : msg.key.participant || msg.key.remoteJid;
        const normalizedSender = senderRaw ? jidNormalizedUser(senderRaw) : '';

        const contextInfo = {
            isForwarded: true,
            forwardingScore: 999,
            participant: '0@s.whatsapp.net',
            stanzaId: 'WHATSAPP_RVO',
            quotedMessage: { conversation: 'Done.' },
            mentionedJid: normalizedSender ? [normalizedSender] : []
        };

        if (type === 'image') {
            await sock.sendMessage(jid, {
                image: buffer,
                caption: mediaMessage.caption || '',
                contextInfo
            });
        } else if (type === 'video') {
            await sock.sendMessage(jid, {
                video: buffer,
                caption: mediaMessage.caption || '',
                mimetype: mediaMessage.mimetype,
                contextInfo
            });
        } else if (type === 'audio') {
            await sock.sendMessage(jid, {
                audio: buffer,
                ptt: mediaMessage.ptt || false,
                mimetype: mediaMessage.mimetype,
                contextInfo
            });
        }

        writeLog('INFO', 'Revealed view-once message', { jid, type });
        return;
    } catch (err: any) {
        console.error('[Read View Once Error]', err);
        writeLog('ERROR', 'Failed to reveal view-once message', { error: err.message });
        return `Failed: Could not process the view-once message. Error: ${err.message}`;
    }
}
