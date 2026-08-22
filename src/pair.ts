import dotenv from 'dotenv';
import { connectToWhatsApp } from '#/utils/connectionManager.js';

dotenv.config();

async function startPairing(): Promise<void> {
    const phoneNumber = process.env.BOT_PHONE_NUMBER;
    if (!phoneNumber) {
        console.error('BOT_PHONE_NUMBER is not set in .env');
        process.exit(1);
    }

    console.log('Starting pairing process...');
    
    connectToWhatsApp({
        sessionId: 'default',
        phoneNumber,
        isPairingMode: true,
        onConnected: () => {
            console.log('Successfully paired and connected!');
            process.exit(0);
        }
    });
}

startPairing();
