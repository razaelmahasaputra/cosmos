import assert from 'assert';
import { prisma } from '../src/db.js';
import {
    registerCancellableSession,
    unregisterCancellableSession,
    unregisterCancellableSessionByUser,
    findCancellableSession,
    hasCancellableSession,
    cancelActiveSession,
    clearAllCancellableSessions
} from '../src/utils/cancellationManager.js';
import cancelTool from '../src/tools/cancel.js';
import { startRegistrationSession, isUserRegistering, cancelRegistrationSession } from '../src/utils/idCard.js';
import createGameTool from '../src/tools/roulette_creategame.js';

async function runTests() {
    console.log('--- STARTING GLOBAL CANCELLATION SYSTEM TESTS ---');

    clearAllCancellableSessions();

    const mockSock: any = {
        sentMessages: [] as any[],
        sendMessage: async (jid: string, content: any, opts: any) => {
            mockSock.sentMessages.push({ jid, content, opts });
            return { key: { id: `mock_${Date.now()}` } };
        }
    };

    const mockMsg = {
        key: {
            remoteJid: 'test_chat@g.us',
            participant: '628111111111@s.whatsapp.net',
            fromMe: false
        },
        message: { conversation: '.cancel' },
        pushName: 'Tester'
    };

    // [Test 1] Basic Cancellation Manager Operations
    console.log('[Test 1] Testing basic Cancellation Manager operations...');
    let cancelledFlag = false;

    registerCancellableSession({
        sessionId: 'session_1',
        feature: 'generic_feature',
        userJid: '628111111111',
        chatJid: 'test_chat@g.us',
        description: 'Generic Feature Confirmation',
        onCancel: async () => {
            cancelledFlag = true;
            return 'Generic feature confirmation cancelled.';
        }
    });

    assert.strictEqual(hasCancellableSession('628111111111', 'test_chat@g.us'), true);
    assert.strictEqual(hasCancellableSession('628222222222', 'test_chat@g.us'), false);
    assert.strictEqual(hasCancellableSession('628111111111', 'other_chat@g.us'), false);

    const session = findCancellableSession('628111111111', 'test_chat@g.us');
    assert(session, 'Session must be found');
    assert.strictEqual(session.description, 'Generic Feature Confirmation');

    // Execute cancellation
    const cancelRes = await cancelActiveSession('628111111111', 'test_chat@g.us', mockSock, mockMsg);
    assert.strictEqual(cancelledFlag, true, 'onCancel callback should have executed');
    assert.strictEqual(cancelRes, 'Generic feature confirmation cancelled.');
    assert.strictEqual(hasCancellableSession('628111111111', 'test_chat@g.us'), false, 'Session must be unregistered');

    // Test unregister by session ID directly
    registerCancellableSession({
        sessionId: 'direct_unreg_id',
        feature: 'temp',
        userJid: 'temp_user',
        chatJid: 'temp_chat',
        onCancel: () => {}
    });
    assert.strictEqual(hasCancellableSession('temp_user', 'temp_chat'), true);
    assert.strictEqual(unregisterCancellableSession('direct_unreg_id'), true);
    assert.strictEqual(hasCancellableSession('temp_user', 'temp_chat'), false);
    console.log('✓ Basic Cancellation Manager operations verified.');

    // [Test 2] User and Chat Isolation
    console.log('[Test 2] Testing user and chat isolation...');
    registerCancellableSession({
        sessionId: 'user_a_chat_1',
        feature: 'feature_a',
        userJid: 'user_a',
        chatJid: 'chat_1',
        onCancel: () => 'User A cancelled'
    });
    registerCancellableSession({
        sessionId: 'user_b_chat_1',
        feature: 'feature_b',
        userJid: 'user_b',
        chatJid: 'chat_1',
        onCancel: () => 'User B cancelled'
    });

    // User A cancels in chat_1
    const resA = await cancelActiveSession('user_a', 'chat_1', mockSock, mockMsg);
    assert.strictEqual(resA, 'User A cancelled');
    // User B should still remain active
    assert.strictEqual(hasCancellableSession('user_b', 'chat_1'), true);
    assert.strictEqual(hasCancellableSession('user_a', 'chat_1'), false);

    // Clean up
    unregisterCancellableSessionByUser('user_b', 'chat_1');
    assert.strictEqual(hasCancellableSession('user_b', 'chat_1'), false);
    console.log('✓ User and chat isolation verified.');

    // [Test 3] Global .cancel Tool Execution
    console.log('[Test 3] Testing .cancel tool execution...');
    // When idle / no session
    const idleCtx: any = {
        sock: mockSock,
        msg: mockMsg,
        jid: 'test_chat@g.us'
    };
    const idleResult = await cancelTool.execute({}, idleCtx);
    assert(
        typeof idleResult === 'string' &&
            idleResult.includes('You do not have any active operation or pending confirmation'),
        'Should return informative message when no cancellable session exists'
    );

    // When an active session is present
    let toolCancelled = false;
    registerCancellableSession({
        sessionId: 'tool_test',
        feature: 'dialog',
        userJid: '628111111111',
        chatJid: 'test_chat@g.us',
        description: 'Interactive Dialog',
        onCancel: () => {
            toolCancelled = true;
            return 'Interactive dialog has been cancelled.';
        }
    });

    const activeResult = await cancelTool.execute({}, idleCtx);
    assert.strictEqual(toolCancelled, true);
    assert.strictEqual(activeResult, 'Interactive dialog has been cancelled.');
    console.log('✓ .cancel tool execution verified.');

    // [Test 4] Integration with Virtual ID Card Registration
    console.log('[Test 4] Testing Virtual ID Card registration cancellation integration...');
    const idUser = '628333333333';
    const idChat = 'id_test_chat@g.us';

    startRegistrationSession(idUser, idChat);
    assert.strictEqual(isUserRegistering(idUser, idChat), true);
    assert.strictEqual(hasCancellableSession(idUser, idChat), true);

    const idCtx: any = {
        sock: mockSock,
        msg: {
            key: { remoteJid: idChat, participant: `${idUser}@s.whatsapp.net`, fromMe: false },
            message: { conversation: '.cancel' }
        },
        jid: idChat
    };

    const idCancelResult = await cancelTool.execute({}, idCtx);
    assert.strictEqual(idCancelResult, 'Virtual ID card registration has been cancelled.');
    assert.strictEqual(isUserRegistering(idUser, idChat), false);
    assert.strictEqual(hasCancellableSession(idUser, idChat), false);

    // Direct cancelRegistrationSession check
    startRegistrationSession('temp_reg_user', idChat);
    assert.strictEqual(isUserRegistering('temp_reg_user', idChat), true);
    cancelRegistrationSession('temp_reg_user', idChat);
    assert.strictEqual(isUserRegistering('temp_reg_user', idChat), false);
    assert.strictEqual(hasCancellableSession('temp_reg_user', idChat), false);
    console.log('✓ Virtual ID Card cancellation integration verified.');

    // [Test 5] Integration with Buckshot Roulette Lobby Cancellation & Bet Refund
    console.log('[Test 5] Testing Buckshot Roulette lobby cancellation integration...');
    const rouletteHost = '628444444444';
    const rouletteChat = 'roulette_chat@g.us';

    // Seed test user in database
    await prisma.user.upsert({
        where: { id: rouletteHost },
        update: { balance: 50000n },
        create: { id: rouletteHost, balance: 50000n }
    });

    const rCtx: any = {
        sock: mockSock,
        msg: {
            key: { remoteJid: rouletteChat, participant: `${rouletteHost}@s.whatsapp.net`, fromMe: false },
            pushName: 'RouletteHost'
        },
        jid: rouletteChat
    };

    const createRes = await createGameTool.execute({}, rCtx);
    assert(typeof createRes === 'string' && createRes.includes('Room successfully created'));
    assert.strictEqual(hasCancellableSession(rouletteHost, rouletteChat), true);

    // Cancel lobby via .cancel tool
    const rCancelRes = await cancelTool.execute({}, rCtx);
    assert(typeof rCancelRes === 'string' && rCancelRes.includes('GAME CANCELLED'));
    assert.strictEqual(hasCancellableSession(rouletteHost, rouletteChat), false);

    // Clean up
    await prisma.user.deleteMany({
        where: { id: rouletteHost }
    });
    console.log('✓ Buckshot Roulette lobby cancellation integration verified.');

    console.log('--- ALL GLOBAL CANCELLATION TESTS PASSED SUCCESSFULLY! ---');
}

runTests().catch((err) => {
    console.error('Test failed with error:', err);
    process.exit(1);
});
