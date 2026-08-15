import express from 'express';
import cors from 'cors';
import { connectToWhatsApp, activeConnections } from './utils/connectionManager.js';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/pair', async (req, res) => {
    const { phoneNumber } = req.body;
    if (!phoneNumber) return res.status(400).json({ error: 'Missing phoneNumber' });

    const sessionId = `subbot_${phoneNumber}`;

    if (activeConnections.has(sessionId)) {
         return res.status(400).json({ error: 'Pairing already in progress or connected' });
    }

    try {
        let pairingCodeSent = false;
        
        connectToWhatsApp({
            sessionId,
            phoneNumber,
            disableReconnect: true,
            onPairingCode: (code) => {
                if (!pairingCodeSent) {
                    pairingCodeSent = true;
                    res.json({ pairingCode: code });
                }
            },
            onConnected: async () => {
                 console.log(`[API] Pairing successful for ${sessionId}, transferring to bot process...`);
                 
                 const sock = activeConnections.get(sessionId);
                 if (sock) {
                     sock.end(undefined);
                     activeConnections.delete(sessionId);
                 }
                 
                 try {
                     const internalPort = process.env.INTERNAL_PORT || 3001;
                     await axios.post(`http://localhost:${internalPort}/internal/start-subbot`, { sessionId });
                 } catch (e: any) {
                     console.error('[API] Failed to start subbot in main process:', e.message);
                 }
            }
        });

        // Set a timeout in case requestPairingCode takes too long or fails internally
        setTimeout(() => {
            if (!pairingCodeSent) {
                pairingCodeSent = true;
                const sock = activeConnections.get(sessionId);
                if (sock) {
                    sock.end(undefined);
                    activeConnections.delete(sessionId);
                }
                if (!res.headersSent) {
                    res.status(500).json({ error: 'Timeout waiting for pairing code' });
                }
            }
        }, 20000);

    } catch (err: any) {
        if (!res.headersSent) {
            res.status(500).json({ error: err.message });
        }
    }
});

const port = process.env.API_PORT || 3000;
app.listen(port, () => {
    console.log(`[API] Server listening on port ${port}`);
});
