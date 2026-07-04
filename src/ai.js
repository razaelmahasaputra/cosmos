import { Groq } from 'groq-sdk';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Load tools
const toolsPath = path.resolve(process.cwd(), 'src', 'tools');
let availableTools = {};
let groqTools = [];

// Dynamic loading of tools
if (fs.existsSync(toolsPath)) {
    const files = fs.readdirSync(toolsPath).filter((f) => f.endsWith('.js'));
    for (const file of files) {
        const toolModule = await import(path.join('file://', toolsPath, file));
        if (toolModule.definition && toolModule.execute) {
            availableTools[toolModule.definition.name] = toolModule.execute;
            groqTools.push({
                type: 'function',
                function: toolModule.definition
            });
        }
    }
}

export async function processAI(query, jid, ctx) {
    const messages = [
        { role: 'system', content: 'You are a helpful AI assistant connected to WhatsApp.' },
        { role: 'user', content: query }
    ];

    let response = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: messages,
        tools: groqTools.length > 0 ? groqTools : undefined,
        tool_choice: 'auto'
    });

    const responseMessage = response.choices[0].message;

    if (responseMessage.tool_calls) {
        messages.push(responseMessage);

        for (const toolCall of responseMessage.tool_calls) {
            const functionName = toolCall.function.name;
            const functionToCall = availableTools[functionName];
            const functionArgs = JSON.parse(toolCall.function.arguments);

            let functionResponse;
            try {
                functionResponse = await functionToCall(functionArgs, ctx);
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
            model: 'llama-3.3-70b-versatile',
            messages: messages
        });

        return secondResponse.choices[0].message.content;
    }

    return responseMessage.content;
}
