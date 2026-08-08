import { Groq } from 'groq-sdk';
import { WASocket, WAMessage, downloadContentFromMessage } from '@whiskeysockets/baileys';
import { writeLog } from '#/logger.js';
import dotenv from 'dotenv';
import { isGroupWhitelisted } from '#/db.js';
import { addMessageToHistory, getConversationContext } from '#/utils/aiHistory.js';

dotenv.config();

let isGlobalOfflineAiEnabled = false;

// Buffer to hold incoming messages while waiting for the 3-second delay
const messageBuffer = new Map<string, string[]>();
const imageBuffer = new Map<string, string[]>();

// Keeps track of JIDs that are currently being processed
const processingJids = new Set<string>();

export function toggleOfflineAi(): boolean {
    isGlobalOfflineAiEnabled = !isGlobalOfflineAiEnabled;
    return isGlobalOfflineAiEnabled;
}

export function isOfflineAiEnabled(): boolean {
    return isGlobalOfflineAiEnabled;
}

let groqClient: Groq | null = null;
function getGroqClient(): Groq {
    if (!groqClient) {
        groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
    }
    return groqClient;
}

export async function handleOfflineAiResponder(sock: WASocket, msg: WAMessage, jid: string, text: string): Promise<boolean> {
    if (!isGlobalOfflineAiEnabled) return false;

    // Do not respond to commands
    if (text.trim().startsWith('.')) return false;
    
    const m = msg.message;
    const unwrapped = m?.viewOnceMessage?.message || m?.viewOnceMessageV2?.message || m?.viewOnceMessageV2Extension?.message || m;
    const imageMsg = unwrapped?.imageMessage;

    // Ignore if no text and no image
    if (!text.trim() && !imageMsg) return false;

    // If it's a group, only respond if whitelisted, AND if the bot/owner is mentioned or replied to
    if (jid.endsWith('@g.us')) {
        const whitelisted = await isGroupWhitelisted(jid);
        if (!whitelisted) return false;

        const cleanId = (idStr?: string | null) => (idStr ? idStr.split(':')[0].split('@')[0] : null);
        const botRawJid = cleanId(sock.user?.id);
        const botRawLid = cleanId((sock.user as any)?.lid);

        const contextInfo = unwrapped?.extendedTextMessage?.contextInfo || unwrapped?.imageMessage?.contextInfo || unwrapped?.videoMessage?.contextInfo;
        
        const mentionedJids: string[] = contextInfo?.mentionedJid || [];
        const isMentioned = mentionedJids.some(j => {
            const raw = cleanId(j);
            return (botRawJid && raw === botRawJid) || (botRawLid && raw === botRawLid);
        });

        const repliedToJid = contextInfo?.participant;
        const repliedToRaw = cleanId(repliedToJid);
        const isReplied = (botRawJid && repliedToRaw === botRawJid) || (botRawLid && repliedToRaw === botRawLid);

        if (!isMentioned && !isReplied) {
            return false;
        }
    }

    let base64Image: string | null = null;
    if (imageMsg) {
        try {
            const stream = await downloadContentFromMessage(imageMsg, 'image');
            let buffer = Buffer.from([]);
            for await (const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk]);
            }
            const mime = imageMsg.mimetype || 'image/jpeg';
            base64Image = `data:${mime};base64,${buffer.toString('base64')}`;
        } catch (err) {
            console.error('[Offline AI] Failed to download image:', err);
        }
    }

    // Add message and image to buffer
    const currentBuffer = messageBuffer.get(jid) || [];
    if (text.trim()) currentBuffer.push(text.trim());
    messageBuffer.set(jid, currentBuffer);

    const currentImageBuffer = imageBuffer.get(jid) || [];
    if (base64Image) currentImageBuffer.push(base64Image);
    imageBuffer.set(jid, currentImageBuffer);

    // Anti-spam system: check if already processing a message from this JID
    if (processingJids.has(jid)) {
        console.log(`[Offline AI] Queued additional message bubble for ${jid}`);
        return true; 
    }

    processingJids.add(jid);

    try {
        // Delay 3 seconds with "composing" status
        await sock.sendPresenceUpdate('composing', jid);
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Re-update presence as it might expire or we just want to ensure it's still composing
        await sock.sendPresenceUpdate('composing', jid);
        
        // After 3 seconds, gather all buffered messages and clear buffer
        const finalMessages = messageBuffer.get(jid) || [];
        messageBuffer.delete(jid);
        const combinedText = finalMessages.join('\n\n');
        
        const finalImages = imageBuffer.get(jid) || [];
        imageBuffer.delete(jid);

        if (!combinedText && finalImages.length === 0) return false;

        // Add the new combined user message to history
        const historyText = combinedText || '[Image received]';
        await addMessageToHistory(jid, 'user', historyText);

        const systemPrompt = `You are a helpful AI assistant replying on behalf of the user who is currently offline.
Engage in casual conversation with the contacts while they wait for the user to come back online.
Keep your responses friendly, casual, and natural. Do not mention that you are an AI unless explicitly asked, act naturally as a stand-in.
CRITICAL INSTRUCTION: Always reply in the exact same language that the contact is using (e.g., if they speak Indonesian, reply in Indonesian; if they speak Spanish, reply in Spanish).
Important: Reply natively. Do not use XML tags for function calls. Return ONLY the text you want to send.`;

        const groq = getGroqClient();
        
        // Retrieve the conversation context (includes summary and recent messages)
        const chatContext = await getConversationContext(jid, groq);

        let modelToUse = 'openai/gpt-oss-20b';
        if (finalImages.length > 0) {
            modelToUse = 'qwen/qwen3.6-27b';
            const lastMsg = chatContext[chatContext.length - 1];
            if (lastMsg && lastMsg.role === 'user') {
                const contentArray: any[] = [{ type: 'text', text: historyText }];
                for (const img of finalImages) {
                    contentArray.push({ type: 'image_url', image_url: { url: img } });
                }
                lastMsg.content = contentArray;
            }
        }

        const response = await groq.chat.completions.create({
            model: modelToUse,
            messages: [
                { role: 'system', content: systemPrompt },
                ...chatContext
            ],
            temperature: 0.7
        });
        
        const aiText = response.choices[0]?.message?.content?.trim();
        if (aiText) {
            // Save AI response to history
            await addMessageToHistory(jid, 'assistant', aiText);

            const finalReply = `${aiText}\n\n> Message generated by AI may contain errors; please double-check`;
            await sock.sendMessage(jid, { text: finalReply }, { quoted: msg });
            writeLog('INFO', 'Offline AI responded', { jid, responseLength: finalReply.length });
        }
        return true;
    } catch (err: any) {
        console.error('[Offline AI Groq Error]', err);
        writeLog('ERROR', 'Offline AI Groq completion failed', { error: err.message });
        return false;
    } finally {
        processingJids.delete(jid);
    }
}
