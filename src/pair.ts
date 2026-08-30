import dotenv from 'dotenv';
import { connectToWhatsApp } from '#/utils/connectionManager.js';

dotenv.config();

async function startPairing(): Promise<void> {
    console.log('Starting QR code pairing process...');

    connectToWhatsApp({
        sessionId: 'default',
        isPairingMode: true,
        onConnected: () => {
            console.log('Successfully paired and connected!');
            process.exit(0);
        }
    });
}

startPairing();
