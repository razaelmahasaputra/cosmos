import { WASocket, proto } from '@whiskeysockets/baileys';
import { isAutoDlEnabled } from './autodl.js';

interface DeletionTask {
    sock: WASocket;
    jid: string;
    msgKey: proto.IMessageKey;
    deleteAt: number;
}

const deletionQueue: DeletionTask[] = [];
let timer: NodeJS.Timeout | null = null;

export function scheduleMediaAutoDelete(
    sock: WASocket,
    jid: string,
    sentMsg: any,
    mediaType: 'image' | 'video' | 'audio'
) {
    if (!sentMsg || !sentMsg.key) return;

    // Check if autodelete is enabled for this chat
    if (!isAutoDlEnabled(jid, 'autodelete')) return;

    let delayMs = 0;
    if (mediaType === 'image') delayMs = 30 * 60 * 1000;
    else if (mediaType === 'video') delayMs = 20 * 60 * 1000;
    else if (mediaType === 'audio') delayMs = 5 * 60 * 1000;

    if (delayMs === 0) return;

    const deleteAt = Date.now() + delayMs;
    deletionQueue.push({ sock, jid, msgKey: sentMsg.key, deleteAt });

    // Sort queue so the soonest deletion is first
    deletionQueue.sort((a, b) => a.deleteAt - b.deleteAt);

    processDeletionQueue();
}

function processDeletionQueue() {
    if (timer) {
        clearTimeout(timer);
        timer = null;
    }

    if (deletionQueue.length === 0) return;

    const now = Date.now();
    const nextTask = deletionQueue[0];

    if (nextTask.deleteAt <= now) {
        executeDelete(nextTask);
    } else {
        timer = setTimeout(() => {
            executeDelete(deletionQueue[0]);
        }, nextTask.deleteAt - now);
    }
}

async function executeDelete(task: DeletionTask) {
    deletionQueue.shift(); // Remove the task

    try {
        await task.sock.sendMessage(task.jid, { delete: task.msgKey });
        console.log(`[AutoDelete] Deleted media message ${task.msgKey.id} in ${task.jid}`);
    } catch (err) {
        console.error(`[AutoDelete] Failed to delete media message ${task.msgKey.id}`, err);
    }

    processDeletionQueue(); // Process next in queue
}

export async function deleteSenderLink(sock: WASocket, jid: string, msgKey: proto.IMessageKey) {
    // Check if autodelete is enabled for this chat
    if (!isAutoDlEnabled(jid, 'autodelete')) return;

    try {
        if (msgKey.fromMe) {
            // Self-triggered, delete for everyone
            await sock.sendMessage(jid, { delete: msgKey });
        } else {
            if (jid.endsWith('@g.us')) {
                // If it's a group, check if bot is admin
                const groupMetadata = await sock.groupMetadata(jid);
                const botJid = sock.user?.id?.split(':')[0] + '@s.whatsapp.net';
                const botParticipant = groupMetadata.participants.find((p) => p.id === botJid);

                const isBotAdmin = botParticipant?.admin === 'admin' || botParticipant?.admin === 'superadmin';

                if (isBotAdmin) {
                    await sock.sendMessage(jid, { delete: msgKey }); // for everyone
                } else {
                    // Not admin, delete for me only via chatModify
                    await sock.chatModify(
                        {
                            deleteForMe: {
                                deleteMedia: false,
                                key: msgKey,
                                timestamp: Date.now()
                            }
                        },
                        jid
                    );
                }
            } else {
                // Private chat, delete for me (can't delete other's messages for everyone in private)
                await sock.chatModify(
                    {
                        deleteForMe: {
                            deleteMedia: false,
                            key: msgKey,
                            timestamp: Date.now()
                        }
                    },
                    jid
                );
            }
        }
        console.log(`[AutoDelete] Deleted sender link message ${msgKey.id} in ${jid}`);
    } catch (error) {
        console.error(`[AutoDelete] Failed to delete sender link ${msgKey.id}`, error);
    }
}
