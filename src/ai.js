import { Groq } from 'groq-sdk';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { writeLog } from './logger.js';
import toolsHandler from './tools/handler.js';

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

    const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: query }
    ];

    const groqTools = toolsHandler.getGroqTools();

    let response = await groq.chat.completions.create({
        model: 'openai/gpt-oss-20b',
        messages: messages,
        tools: groqTools.length > 0 ? groqTools : undefined,
        temperature: 0.1,
        tool_choice: 'auto'
    });

    const responseMessage = response.choices[0].message;

    if (responseMessage.tool_calls) {
        messages.push(responseMessage);

        for (const toolCall of responseMessage.tool_calls) {
            const functionName = toolCall.function.name;
            const functionArgs = JSON.parse(toolCall.function.arguments);

            writeLog('INFO', 'AI Tool Call', { jid, tool: functionName, args: functionArgs });

            let functionResponse;
            try {
                functionResponse = await toolsHandler.execute(functionName, functionArgs, ctx);
            } catch (err) {
                functionResponse = `Error executing tool: ${err.message}`;
            }

            messages.push({
                tool_call_id: toolCall.id,
                role: 'tool',
                name: functionName,
                content: typeof functionResponse === 'string' ? functionResponse : JSON.stringify(functionResponse)
            });
        }

        // Get final response from model
        const secondResponse = await groq.chat.completions.create({
            model: 'openai/gpt-oss-20b',
            messages: messages
        });

        return secondResponse.choices[0].message.content;
    }

    return responseMessage.content;
}
