import axios from 'axios';
import { prisma } from './src/db.js';

async function test() {
  const idrRate = undefined;
  await prisma.exchangeRateLog.create({
      data: {
          rate: idrRate as any,
          source: 'EODHD'
      }
  });
}
test().catch(console.error);
