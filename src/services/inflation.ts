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
            const response = await axios.get('https://api.exchangerate-api.com/v4/latest/USD');
            const idrRate = response.data.rates.IDR;

            // 2. Save to database for persistence
            await prisma.exchangeRateLog.create({
                data: {
                    rate: idrRate,
                    source: 'ExchangeRate-API'
                }
            });

            // 3. Trigger AI Analysis
            await analyzeEconomyWithAI(idrRate, sock);
        } catch (error) {
            console.error('Failed to update inflation data:', error);
        }
    });
}
