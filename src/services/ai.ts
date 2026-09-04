import Groq from 'groq-sdk';
import { prisma } from '../db.js';
import { broadcastEconomicUpdate } from './broadcast.js';
import dotenv from 'dotenv';
dotenv.config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function analyzeEconomyWithAI(currentRate: number, sock?: any) {
    // 1. Fetch last 7 days of rates
    const recentRates = await prisma.exchangeRateLog.findMany({
        take: 7,
        orderBy: { createdAt: 'desc' }
    });

    const ratesList = recentRates.map((r: any) => r.rate).join(', ');

    // 2. Prompt Groq LLM
    const completion = await groq.chat.completions.create({
        messages: [
            {
                role: 'system',
                content: 'You are an economic AI for a bot. Output ONLY valid JSON.'
            },
            {
                role: 'user',
                content: `Recent USD to IDR rates: ${ratesList}. Current rate: ${currentRate}. Calculate the inflation multiplier and provide a short reasoning. Example format: {"multiplier": 1.02, "reasoning": "Slight IDR inflation."}`
            }
        ],
        model: 'llama3-8b-8192',
        response_format: { type: 'json_object' }
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error('Empty response from Groq');

    const aiResponse = JSON.parse(content);

    // 3. Check if multiplier changed to avoid spamming
    const lastMultiplierData = await prisma.economyMultiplier.findFirst({
        orderBy: { appliedAt: 'desc' }
    });

    if (lastMultiplierData && lastMultiplierData.multiplier === aiResponse.multiplier) {
        console.log('Inflation multiplier unchanged. Skipping broadcast.');
        return { multiplier: aiResponse.multiplier, broadcasted: false, reasoning: aiResponse.reasoning };
    }

    // 4. Save new multiplier
    await prisma.economyMultiplier.create({
        data: {
            multiplier: aiResponse.multiplier,
            reasoning: aiResponse.reasoning
        }
    });

    // 5. Trigger Broadcast if socket is provided
    if (sock) {
        await broadcastEconomicUpdate(sock, aiResponse.multiplier, aiResponse.reasoning, currentRate);
    }

    return { multiplier: aiResponse.multiplier, broadcasted: true, reasoning: aiResponse.reasoning };
}
