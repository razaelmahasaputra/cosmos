import { Groq } from 'groq-sdk';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { writeLog } from './logger.js';
import toolsHandler from './tools/handler.js';
import { saveMessage, getHistory } from './db.js';
import { sanitizeToolCall } from './utils/jsonSanitizer.js';

dotenv.config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function processAI(query, jid, ctx) {
    let systemPrompt = 'You are a helpful AI assistant connected to WhatsApp.';
    try {
        const coreMd = fs.readFileSync(path.resolve(process.cwd(), 'src', 'prompt', 'core.md'), 'utf-8');
        const skillsIndexMd = fs.readFileSync(
            path.resolve(process.cwd(), 'src', 'prompt', 'skills', 'index.md'),
            'utf-8'
        );
        systemPrompt = `${coreMd}\n\n${skillsIndexMd}`;
    } catch (err) {
        console.error('Failed to load system prompts:', err);
    }

    const history = await getHistory(jid);

    const groqTools = toolsHandler.getGroqTools();

    let responseMessage;
    let temporaryMessages = [];
    const MAX_RETRIES = 3;
    let parsedToolCalls = [];

    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const backoffWithJitter = async (attempt) => {
        const base = 500;
        const max = 4000;
        const calculated = Math.min(max, base * Math.pow(2, attempt));
        const jitter = Math.random() * 200;
        await delay(calculated + jitter);
    };

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        const apiMessages = [
            { role: 'system', content: systemPrompt },
            ...history,
            { role: 'user', content: query },
            ...temporaryMessages
        ];

        try {
            const response = await groq.chat.completions.create({
                model: 'llama-3.3-70b-versatile',
                messages: apiMessages,
                tools: groqTools.length > 0 ? groqTools : undefined,
                temperature: 0.1,
                tool_choice: 'auto',
                stop: ['<', '</', '```']
            });

            responseMessage = response.choices[0].message;
        } catch (apiErr) {
            writeLog('ERROR', `Groq API Call Error (Attempt ${attempt})`, {
                jid,
                error: apiErr.message
            });
            if (attempt === MAX_RETRIES) {
                throw apiErr;
            }
            await backoffWithJitter(attempt);
            continue;
        }

        if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
            let allValid = true;
            let currentParsedCalls = [];
            let validationErrors = [];

            for (const toolCall of responseMessage.tool_calls) {
                const functionName = toolCall.function.name;
                const tool = toolsHandler.getTool(functionName);
                const schema = tool ? tool.definition.parameters : undefined;

                const sanitized = sanitizeToolCall(toolCall.function.arguments, schema);
                if (sanitized.success) {
                    currentParsedCalls.push({
                        toolCall,
                        args: sanitized.data
                    });
                } else {
                    allValid = false;
                    validationErrors.push({
                        id: toolCall.id,
                        name: functionName,
                        error: sanitized.error,
                        rawArgs: toolCall.function.arguments
                    });

                    writeLog('ERROR', `AI Tool Arguments Validation Error (Attempt ${attempt})`, {
                        jid,
                        tool: functionName,
                        error: sanitized.error,
                        rawArguments: toolCall.function.arguments
                    });
                }
            }

            if (allValid) {
                parsedToolCalls = currentParsedCalls;
                break;
            } else {
                if (attempt < MAX_RETRIES) {
                    temporaryMessages.push(responseMessage);
                    for (const toolCall of responseMessage.tool_calls) {
                        const errDetail = validationErrors.find((e) => e.id === toolCall.id);
                        if (errDetail) {
                            temporaryMessages.push({
                                tool_call_id: toolCall.id,
                                role: 'tool',
                                name: toolCall.function.name,
                                content: `Validation failed: ${errDetail.error}. Please correct the JSON arguments to match the schema and try again.`
                            });
                        } else {
                            temporaryMessages.push({
                                tool_call_id: toolCall.id,
                                role: 'tool',
                                name: toolCall.function.name,
                                content: `Arguments are valid, but another tool call in the same batch failed. Pending correction.`
                            });
                        }
                    }
                    await backoffWithJitter(attempt);
                } else {
                    parsedToolCalls = currentParsedCalls;
                    writeLog('ERROR', 'Max retries reached for tool call validation correction', {
                        jid,
                        validationErrors
                    });
                }
            }
        } else {
            break;
        }
    }

    let finalResponse;

    if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
        temporaryMessages.push(responseMessage);

        for (const toolCall of responseMessage.tool_calls) {
            const functionName = toolCall.function.name;
            const parsedCall = parsedToolCalls.find((p) => p.toolCall.id === toolCall.id);

            if (parsedCall) {
                writeLog('INFO', 'AI Tool Call', { jid, tool: functionName, args: parsedCall.args });
                let functionResponse;
                try {
                    functionResponse = await toolsHandler.execute(functionName, parsedCall.args, ctx);
                } catch (err) {
                    functionResponse = `Error executing tool: ${err.message}`;
                }

                temporaryMessages.push({
                    tool_call_id: toolCall.id,
                    role: 'tool',
                    name: functionName,
                    content: typeof functionResponse === 'string' ? functionResponse : JSON.stringify(functionResponse)
                });
            } else {
                temporaryMessages.push({
                    tool_call_id: toolCall.id,
                    role: 'tool',
                    name: functionName,
                    content: 'Validation failed after maximum retries. Error: Invalid arguments.'
                });
            }
        }

        const secondResponse = await groq.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages: [
                { role: 'system', content: systemPrompt },
                ...history,
                { role: 'user', content: query },
                ...temporaryMessages
            ]
        });

        finalResponse = secondResponse.choices[0].message.content;
    } else {
        finalResponse = responseMessage.content;
    }

    // Save history
    await saveMessage(jid, 'user', query);
    await saveMessage(jid, 'assistant', finalResponse);

    return finalResponse;
}
