import { Groq } from 'groq-sdk';
import dotenv from 'dotenv';

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

    const systemPrompt = `You are an automated message auto-correct AI assistant for casual chat/messaging.
Your task is to analyze the sender's text message and correct ONLY clear typos or severe spelling mistakes.

STRICT RULES:
1. Return ONLY the corrected text message without any explanation, context, preamble, or wrapping quote.
2. STRICTLY FORBIDDEN to guess slang, phonetic jokes, internet shorthand, or dialect phrases as typos (e.g., "sek" -> "bentar", "tayem" -> "time").
3. Do NOT rephrase sentences, add context, or standardize casual informal speech into formal language.
4. If the message is intended casual slang, abbreviation, or has no clear typo, respond ONLY with: NO_CHANGE
5. Preserve original slang, abbreviations, emojis, and informal formatting.
6. Use Native Function Calling API if needed. STRICTLY FORBIDDEN to type XML tags like <function=...> manually!`;

    try {
        const groq = getGroqClient();
        let response;
        try {
            response = await groq.chat.completions.create({
                model: 'openai/gpt-oss-120b',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: trimmed }
                ],
                temperature: 0.1
            });
        } catch (modelErr: any) {
            console.warn('[AutoCorrect] openai/gpt-oss-120b failed, retrying with openai/gpt-oss-20b...', modelErr?.message);
            response = await groq.chat.completions.create({
                model: 'openai/gpt-oss-20b',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: trimmed }
                ],
                temperature: 0.1
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
        console.error('AutoCorrect Groq completion failed', { error: err.message });
        return null;
    }
}
