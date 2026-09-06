import assert from 'assert';
import sharp from 'sharp';
import { prisma } from '../src/db.js';
import {
    generateNik,
    saveIdCard,
    getIdCardByUser,
    requireIdCard,
    startRegistrationSession,
    isUserRegistering,
    processRegistrationStep
} from '../src/utils/idCard.js';
import { generateIdCardImage, createPlaceholderPhotoBuffer } from '../src/utils/imageProcessing.js';
import idCardTool from '../src/tools/idcard.js';
import loanTool from '../src/tools/loan.js';
import applyLicenseTool from '../src/tools/apply_license.js';
import applyJobTool from '../src/tools/apply_job.js';

async function runTests() {
    console.log('--- STARTING VIRTUAL ID CARD TESTS ---');

    const testJid = `test_user_${Date.now()}@s.whatsapp.net`;
    const testJidClean = testJid.split('@')[0];

    // 1. Test NIK Generation
    console.log('[Test 1] Testing NIK generation...');
    const maleNik = await generateNik('LAKI-LAKI', '17-08-1990');
    assert.strictEqual(maleNik.length, 16, 'NIK must be 16 digits');
    assert.strictEqual(maleNik.startsWith('317101'), true, 'NIK must start with Cosmos area code 317101');
    assert.strictEqual(maleNik.slice(6, 12), '170890', 'Male birth date in NIK should be 170890');

    const femaleNik = await generateNik('PEREMPUAN', '17-08-1990');
    assert.strictEqual(femaleNik.length, 16, 'Female NIK must be 16 digits');
    assert.strictEqual(femaleNik.slice(6, 12), '570890', 'Female birth date day in NIK should be day + 40 (57)');
    console.log('✓ NIK generation verified successfully.');

    // 2. Test Verification Hook when ID card does not exist (Scenario D)
    console.log('[Test 2] Testing Graceful Rejection for unregistered user (Scenario D)...');
    const authBefore = await requireIdCard(testJidClean);
    assert.strictEqual(authBefore.authorized, false);
    assert.strictEqual(
        authBefore.message,
        'Access Denied. You must possess a Virtual ID Card to use this feature. Please register your identity first using the .register-id command.'
    );

    // Test loan tool rejection
    const mockCtxUnreg: any = {
        sock: { user: { id: 'bot_id' } },
        msg: { key: { participant: testJidClean, remoteJid: testJidClean } },
        jid: testJidClean
    };
    const loanReject = await loanTool.execute({ amount: '5000000' }, mockCtxUnreg);
    assert.strictEqual(loanReject, authBefore.message);

    // Test apply-license tool rejection
    const licenseReject = await applyLicenseTool.execute({}, mockCtxUnreg);
    assert.strictEqual(licenseReject, authBefore.message);

    // Test apply-job tool rejection
    const jobReject = await applyJobTool.execute({ role: 'Developer' }, mockCtxUnreg);
    assert.strictEqual(jobReject, authBefore.message);
    console.log('✓ Scenario D (Graceful Rejection) verified successfully.');

    // 3. Test Image Generation & Compositing (Sharp + Opentype)
    console.log('[Test 3] Testing Sharp image generation...');
    const placeholderBuffer = await createPlaceholderPhotoBuffer();
    assert(placeholderBuffer.length > 0, 'Placeholder photo buffer must be valid');

    const sampleData = {
        nik: maleNik,
        fullName: 'BUDI SANTOSO',
        placeOfBirth: 'JAKARTA',
        dateOfBirth: '17-08-1990',
        gender: 'LAKI-LAKI',
        address: 'JL. MERDEKA NO. 1',
        religion: 'ISLAM',
        maritalStatus: 'BELUM KAWIN',
        occupation: 'DEVELOPER',
        citizenship: 'WNI',
        validUntil: 'SEUMUR HIDUP'
    };

    const imageBuffer = await generateIdCardImage(sampleData, placeholderBuffer);
    assert(imageBuffer.length > 10000, 'Image buffer must be non-trivial size');

    const metadata = await sharp(imageBuffer).metadata();
    assert.strictEqual(metadata.width, 1264, 'Output width should match template');
    assert.strictEqual(metadata.height, 848, 'Output height should match template');
    assert.strictEqual(metadata.format, 'jpeg', 'Output format should be JPEG');
    console.log('✓ Image generation and Sharp compositing verified successfully.');

    // 4. Test Database Persistence
    console.log('[Test 4] Testing Prisma database persistence...');
    const savedCard = await saveIdCard({
        userJid: testJidClean,
        fullName: 'Budi Santoso',
        placeOfBirth: 'Jakarta',
        dateOfBirth: '17-08-1990',
        gender: 'Laki-laki',
        address: 'Jl. Merdeka No. 1',
        religion: 'Islam',
        maritalStatus: 'Belum Kawin',
        occupation: 'Developer'
    });

    assert.strictEqual(savedCard.userJid, testJidClean);
    assert.strictEqual(savedCard.fullName, 'BUDI SANTOSO');
    assert.strictEqual(savedCard.citizenship, 'WNI');
    assert.strictEqual(savedCard.validUntil, 'SEUMUR HIDUP');

    const fetched = await getIdCardByUser(testJidClean);
    assert.strictEqual(fetched?.nik, savedCard.nik);
    assert.strictEqual(fetched?.fullName, 'BUDI SANTOSO');
    console.log('✓ Database persistence verified successfully.');

    // 5. Test Future Integration Scenarios with registered ID card
    console.log('[Test 5] Testing Scenarios A, B, C with registered user...');
    // Scenario A: Loan
    const loanApprove = await loanTool.execute({ amount: '5000000' }, mockCtxUnreg);
    assert(
        typeof loanApprove === 'string' && loanApprove.includes('Identity verification successful'),
        'Loan should be approved for registered user'
    );
    assert(
        typeof loanApprove === 'string' && loanApprove.includes(savedCard.nik),
        'Loan approval should mention user NIK'
    );
    assert(
        typeof loanApprove === 'string' && loanApprove.includes('Rp5.000.000'),
        'Loan approval should format amount as Rp5.000.000'
    );

    // Scenario B: License (Age >= 17)
    const licenseApprove = await applyLicenseTool.execute({}, mockCtxUnreg);
    assert(
        typeof licenseApprove === 'string' && licenseApprove.includes('Identity verified!'),
        'License application should be verified'
    );
    assert(
        typeof licenseApprove === 'string' && licenseApprove.includes('BUDI SANTOSO'),
        'License application should include full name'
    );

    // Scenario C: Job
    const jobApprove = await applyJobTool.execute({ role: 'Developer' }, mockCtxUnreg);
    assert(
        typeof jobApprove === 'string' &&
            jobApprove.includes("contract for 'Developer' has been registered under the name BUDI SANTOSO"),
        'Job application should populate contract with name and address'
    );
    console.log('✓ Scenarios A, B, C verified successfully.');

    // 6. Test Interactive Registration Flow & Session Management
    console.log('[Test 6] Testing interactive registration session flow...');
    const regUser = `interactive_user_${Date.now()}`;
    assert.strictEqual(isUserRegistering(regUser), false);

    const welcome = startRegistrationSession(regUser, 'chat_jid');
    assert(welcome.includes('Welcome to the Cosmos Identity System'));
    assert.strictEqual(isUserRegistering(regUser), true);

    const mockSock: any = {
        sentMessages: [] as any[],
        sendMessage: async (jid: string, content: any) => {
            mockSock.sentMessages.push({ jid, content });
        }
    };
    const mockMsg: any = { key: { id: 'msg_1', participant: regUser, remoteJid: 'chat_jid' } };

    // Step 1: Send name
    await processRegistrationStep(mockSock, mockMsg, regUser, 'chat_jid', 'Jane Doe');
    assert(mockSock.sentMessages.pop().content.text.includes('Place and Date of Birth'));

    // Step 2: Send DOB
    await processRegistrationStep(mockSock, mockMsg, regUser, 'chat_jid', 'Surabaya, 20-11-2002');
    assert(mockSock.sentMessages.pop().content.text.includes('Gender'));

    // Step 3: Send Gender
    await processRegistrationStep(mockSock, mockMsg, regUser, 'chat_jid', 'Female');
    assert(mockSock.sentMessages.pop().content.text.includes('Address'));

    // Step 4: Send Address
    await processRegistrationStep(mockSock, mockMsg, regUser, 'chat_jid', 'Jl. Pahlawan No. 45');
    assert(mockSock.sentMessages.pop().content.text.includes('Religion'));

    // Step 5: Send Religion
    await processRegistrationStep(mockSock, mockMsg, regUser, 'chat_jid', 'Kristen');
    assert(mockSock.sentMessages.pop().content.text.includes('Marital Status'));

    // Step 6: Send Marital Status
    await processRegistrationStep(mockSock, mockMsg, regUser, 'chat_jid', 'Single');
    assert(mockSock.sentMessages.pop().content.text.includes('Occupation'));

    // Step 7: Send Occupation (Triggers card generation)
    await processRegistrationStep(mockSock, mockMsg, regUser, 'chat_jid', 'UI Designer');
    assert.strictEqual(isUserRegistering(regUser), false, 'Registration session should be closed after completion');

    // Check that card was delivered as image
    const finalSent = mockSock.sentMessages.pop();
    assert(finalSent.content.image, 'Bot should have sent the final KTP image');
    assert(finalSent.content.caption.includes('Your Virtual ID Card has been successfully issued!'));
    assert(finalSent.content.caption.includes('JANE DOE'));

    // Check cancellation
    const cancelUser = `cancel_user_${Date.now()}`;
    startRegistrationSession(cancelUser, 'chat_jid');
    assert.strictEqual(isUserRegistering(cancelUser), true);
    await processRegistrationStep(mockSock, mockMsg, cancelUser, 'chat_jid', '.cancel');
    assert.strictEqual(isUserRegistering(cancelUser), false);
    assert(mockSock.sentMessages.pop().content.text.includes('cancelled'));

    // Duplicate registration check
    const dupCtx: any = {
        sock: mockSock,
        msg: {
            message: { conversation: '.register-id' },
            key: { participant: testJidClean, remoteJid: testJidClean }
        },
        jid: testJidClean
    };
    await idCardTool.execute({}, dupCtx);
    const dupResponse = mockSock.sentMessages.find((m: any) =>
        m.content.text?.includes('Duplicate registrations are not permitted')
    );
    assert(dupResponse, 'Should reject duplicate registration');
    console.log('✓ Interactive registration flow and duplicate prevention verified successfully.');

    // Cleanup test data from DB
    await prisma.idCard.deleteMany({
        where: { userJid: { in: [testJidClean, regUser] } }
    });
    await prisma.user.deleteMany({
        where: { id: { in: [testJidClean, regUser, cancelUser] } }
    });

    console.log('--- ALL TESTS PASSED SUCCESSFULLY! ---');
}

runTests()
    .catch((err) => {
        console.error('Test failed with error:', err);
        process.exit(1);
    })
    .finally(() => {
        process.exit(0);
    });
