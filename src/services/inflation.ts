import cron from 'node-cron';
import axios from 'axios';
import { prisma } from '../db.js';
import { analyzeEconomyWithAI } from './ai.js';

export function startInflationCron(sock: any) {
    // Run every day at 00:00 (Midnight)
    cron.schedule('0 0 * * *', async () => {
        try {
            console.log('Fetching daily exchange rate...');

            // 1. Fetch data
            const apiKey = process.env.EODHD_API_KEY;
            if (!apiKey) throw new Error('EODHD_API_KEY is not configured');
            const response = await axios.get(
                `https://eodhd.com/api/real-time/USDIDR.FOREX?api_token=${apiKey}&fmt=json`
            );
            
            const idrRate = response.data.close;
            if (typeof idrRate !== 'number' || isNaN(idrRate)) {
                throw new Error(`Invalid rate received from EODHD: ${JSON.stringify(response.data)}`);
            }

            // 2. Save to database for persistence
            await prisma.exchangeRateLog.create({
                data: {
                    rate: idrRate,
                    source: 'EODHD'
                }
            });

            // 3. Trigger AI Analysis
            await analyzeEconomyWithAI(idrRate, sock);
        } catch (error) {
            console.error('Failed to update inflation data:', error);
        }
    });
}
