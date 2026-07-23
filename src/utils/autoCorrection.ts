import { Groq } from 'groq-sdk';
import dotenv from 'dotenv';
import { writeLog } from '#/logger.js';

dotenv.config();

import {
    isSessionActive,
    activateSession,
    deactivateSession,
    toggleSession
} from '#/utils/sessionStore.js';

const FEATURE_NAME = 'autocorrection';
let isGlobalAutoCorrectionEnabled = false;

const processedMsgIds = new Set<string>();
const MAX_PROCESSED_IDS = 1000;

export async function enableAutoCorrection(jid?: string): Promise<void> {
    if (jid) {
        await activateSession(FEATURE_NAME, jid);
    } else {
        isGlobalAutoCorrectionEnabled = true;
    }
}

export async function disableAutoCorrection(jid?: string): Promise<boolean> {
    if (jid) {
        return await deactivateSession(FEATURE_NAME, jid);
    } else {
        isGlobalAutoCorrectionEnabled = false;
        return true;
    }
}

export async function toggleAutoCorrection(jid: string): Promise<boolean> {
    return await toggleSession(FEATURE_NAME, jid);
}

export function isAutoCorrectionEnabled(jid: string): boolean {
    return isGlobalAutoCorrectionEnabled || isSessionActive(FEATURE_NAME, jid);
}

export function isMessageProcessed(msgId: string): boolean {
    return processedMsgIds.has(msgId);
}

export function markMessageProcessed(msgId: string): void {
    processedMsgIds.add(msgId);
    if (processedMsgIds.size > MAX_PROCESSED_IDS) {
        const first = processedMsgIds.values().next().value;
        if (first) {
            processedMsgIds.delete(first);
        }
    }
}

let groqClient: Groq | null = null;
function getGroqClient(): Groq {
    if (!groqClient) {
        groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
    }
    return groqClient;
}

/**
 * Analyzes and corrects message text using Groq AI.
 * Returns the corrected text if a typo/misspelled word is found,
 * or null if no changes or an error occurs.
 */
export async function analyzeAndCorrectText(originalText: string): Promise<string | null> {
    const trimmed = originalText.trim();
    if (!trimmed || trimmed.length < 2) return null;

    // Ignore if the message is a URL, command, or code block
    if (
        trimmed.startsWith('.') ||
        trimmed.startsWith('/') ||
        trimmed.startsWith('http://') ||
        trimmed.startsWith('https://') ||
        trimmed.startsWith('```')
    ) {
        return null;
    }

    const systemPrompt = `You are an automated message auto-correct AI assistant.
Your task is to analyze the sender's text message and correct ONLY if there are typos, spelling mistakes, or misspoken words.

STRICT RULES:
1. If there is a typo or misspelled word, return ONLY the corrected text message.
2. STRICTLY FORBIDDEN to add extra words outside the correction, explanations, greetings, intros, outros, or wrapping quotes.
3. STRICTLY FORBIDDEN to alter the overall message structure, casual style, or rephrase sentences unless correcting an actual typo.
4. If the message is already correct and contains no typos or misspoken words, you MUST respond ONLY with the exact string: NO_CHANGE
5. Preserve casual slang, common messaging abbreviations (e.g. yg, gak, klo, etc.), emojis, markdown formatting (*bold*, _italic_), and proper nouns/names.
6. Use Native Function Calling API if needed. STRICTLY FORBIDDEN to type XML tags like <function=...> manually inside your text response!`;

    try {
        const groq = getGroqClient();
        let response;
        try {
            response = await groq.chat.completions.create({
                model: 'llama-3.3-70b-versatile',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: trimmed }
                ],
                temperature: 0.5
            });
        } catch (modelErr: any) {
            console.warn('[AutoCorrect] Llama 3.3 failed, retrying with Llama 3.1 8b...', modelErr?.message);
            response = await groq.chat.completions.create({
                model: 'llama-3.1-8b-instant',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: trimmed }
                ],
                temperature: 0.5
            });
        }

        const resultText = response.choices[0]?.message?.content?.trim();

        if (!resultText || resultText === 'NO_CHANGE' || resultText === trimmed) {
            return null;
        }

        // Strip wrapping quotation marks if LLM accidentally adds surrounding quotes
        let cleanResult = resultText;
        if (
            (cleanResult.startsWith('"') && cleanResult.endsWith('"')) ||
            (cleanResult.startsWith("'") && cleanResult.endsWith("'"))
        ) {
            cleanResult = cleanResult.slice(1, -1).trim();
        }

        if (!cleanResult || cleanResult === 'NO_CHANGE' || cleanResult === trimmed) {
            return null;
        }

        return cleanResult;
    } catch (err: any) {
        console.error('[AutoCorrect Groq Error]', err);
        writeLog('ERROR', 'AutoCorrect Groq completion failed', { error: err.message });
        return null;
    }
}
