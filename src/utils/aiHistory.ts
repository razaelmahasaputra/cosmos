import { Groq } from 'groq-sdk';
import { writeLog } from '#/logger.js';
import axios from 'axios';

export type ChatMessage = {
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
};

export type ChatSession = {
    summary: string;
    messages: ChatMessage[];
};

const chatSessions = new Map<string, ChatSession>();
const TWO_HOURS = 2 * 60 * 60 * 1000;
const MAX_MESSAGES_BEFORE_SUMMARY = 10;

export function addMessageToHistory(jid: string, role: 'user' | 'assistant', content: string): void {
    if (!chatSessions.has(jid)) {
        chatSessions.set(jid, { summary: '', messages: [] });
    }
    const session = chatSessions.get(jid)!;
    session.messages.push({ role, content, timestamp: Date.now() });
}

export async function getConversationContext(jid: string, groqClient: Groq): Promise<any[]> {
    if (!chatSessions.has(jid)) return [];
    
    const session = chatSessions.get(jid)!;
    const now = Date.now();
    
    // Filter messages strictly within the last 2 hours to avoid stale context
    session.messages = session.messages.filter(m => now - m.timestamp < TWO_HOURS);
    
    // If the history is getting too long, summarize the older parts to save AI quota
    if (session.messages.length > MAX_MESSAGES_BEFORE_SUMMARY) {
        // Keep the last 2 messages intact for immediate context, summarize the rest
        const keepCount = 2;
        const summarizeCount = session.messages.length - keepCount;
        const messagesToSummarize = session.messages.slice(0, summarizeCount);
        const remainingMessages = session.messages.slice(summarizeCount);
        
        const transcript = messagesToSummarize.map(m => `${m.role === 'user' ? 'User' : 'AI'}: ${m.content}`).join('\n');
        
        const summaryPrompt = `You are an AI tasked with maintaining a concise running summary of a conversation.
Update the previous summary with the new chat history provided below.
Be extremely concise. Retain important facts, context, and the user's intent.

[Previous Summary]
${session.summary || 'No previous summary.'}

[New Chat History]
${transcript}

Return ONLY the updated summary text. Do not add any conversational filler.`;
        
        try {
            const openRouterKey = process.env.OPENROUTER_API_KEY;
            let newSummary = '';

            if (openRouterKey) {
                const response = await axios.post(
                    'https://openrouter.ai/api/v1/chat/completions',
                    {
                        model: 'nvidia/nemotron-nano-9b-v2:free',
                        messages: [{ role: 'system', content: summaryPrompt }],
                        temperature: 0.2
                    },
                    {
                        headers: {
                            'Authorization': `Bearer ${openRouterKey}`,
                            'Content-Type': 'application/json'
                        }
                    }
                );
                newSummary = response.data.choices?.[0]?.message?.content?.trim() || '';
            } else {
                // Fallback to groq if OPENROUTER_API_KEY is missing
                const response = await groqClient.chat.completions.create({
                    model: 'openai/gpt-oss-20b',
                    messages: [{ role: 'system', content: summaryPrompt }],
                    temperature: 0.2
                });
                newSummary = response.choices[0]?.message?.content?.trim() || '';
            }
            
            if (newSummary) {
                session.summary = newSummary;
                session.messages = remainingMessages;
                writeLog('INFO', 'AI History summarized', { jid, newSummaryLength: newSummary.length });
            }
        } catch (err: any) {
            console.error('[AI History Summarization Error]', err);
            writeLog('ERROR', 'AI History Summarization failed', { error: err.message });
            // If summarization fails, we proceed without modifying the array to not lose data,
            // though it might use more quota this round.
        }
    }

    const contextMessages: any[] = [];
    
    if (session.summary) {
        contextMessages.push({ 
            role: 'system', 
            content: `[Previous Conversation Context/Summary]\n${session.summary}` 
        });
    }
    
    for (const m of session.messages) {
        contextMessages.push({ role: m.role, content: m.content });
    }
    
    return contextMessages;
}
