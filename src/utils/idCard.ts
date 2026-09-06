import { prisma } from '#/db.js';
import { cleanId } from '#/utils/casino.js';
import { WASocket, WAMessage } from '@whiskeysockets/baileys';
import { generateIdCardImage, fetchUserProfilePic, IdCardData } from '#/utils/imageProcessing.js';

export interface RegistrationSession {
    userKey: string;
    remoteJid: string;
    step: number;
    data: Partial<IdCardData>;
    lastActivity: number;
}

// In-memory registration sessions mapped by normalized user ID
const registrationSessions = new Map<string, RegistrationSession>();
const SESSION_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes timeout

/**
 * Checks if a user has an active registration session.
 */
export function isUserRegistering(userKey: string): boolean {
    const session = registrationSessions.get(cleanId(userKey));
    if (!session) return false;
    if (Date.now() - session.lastActivity > SESSION_TIMEOUT_MS) {
        registrationSessions.delete(cleanId(userKey));
        return false;
    }
    return true;
}

/**
 * Cancels an active registration session.
 */
export function cancelRegistrationSession(userKey: string): boolean {
    return registrationSessions.delete(cleanId(userKey));
}

/**
 * Starts a new registration session for a user.
 */
export function startRegistrationSession(userKey: string, remoteJid: string): string {
    const cleaned = cleanId(userKey);
    registrationSessions.set(cleaned, {
        userKey: cleaned,
        remoteJid,
        step: 1,
        data: {},
        lastActivity: Date.now()
    });

    return "Welcome to the Cosmos Identity System. Let's create your virtual ID card. Please reply with your *Full Name*.\n\nType *.cancel* at any time to abort the registration.";
}

/**
 * Retrieves the user's IdCard record if one exists.
 */
export async function getIdCardByUser(userJidOrLid: string) {
    const cleaned = cleanId(userJidOrLid);
    if (!cleaned) return null;

    try {
        const user = await prisma.user.findFirst({
            where: {
                OR: [{ id: cleaned }, { lid: cleaned }]
            },
            include: {
                idCard: true
            }
        });

        if (user && user.idCard) {
            return user.idCard;
        }

        // Direct lookup by userJid if not found via relation
        const direct = await prisma.idCard.findUnique({
            where: { userJid: cleaned }
        });
        return direct;
    } catch (err) {
        console.error('[IdCard] Error fetching ID card:', err);
        return null;
    }
}

/**
 * Future Integration Hook: Requires the user to have a valid Virtual ID Card.
 * Gracefully rejects and returns an authorized flag and standard prompt message.
 */
export async function requireIdCard(userJidOrLid: string) {
    const idCard = await getIdCardByUser(userJidOrLid);
    if (!idCard) {
        return {
            authorized: false,
            idCard: null,
            message:
                'Access Denied. You must possess a Virtual ID Card to use this feature. Please register your identity first using the .register-id command.'
        };
    }
    return {
        authorized: true,
        idCard,
        message: null
    };
}

/**
 * Generates a standard Indonesian 16-digit NIK based on gender and date of birth.
 */
export async function generateNik(gender: string, dateOfBirthStr: string): Promise<string> {
    const provinceCityDistrict = '317101'; // Cosmos / Jakarta Province (31), Kota Utama (71), Sub-district (01)

    // Attempt to parse DD-MM-YYYY or DD/MM/YYYY or YYYY-MM-DD
    let day = 1;
    let month = 1;
    let year = 90;

    const normalizedGender = gender.trim().toUpperCase();
    const isFemale =
        normalizedGender === 'PEREMPUAN' ||
        normalizedGender === 'FEMALE' ||
        normalizedGender === 'WANITA' ||
        normalizedGender === 'F';

    const numbers = dateOfBirthStr.match(/\d+/g);
    if (numbers && numbers.length >= 3) {
        if (numbers[0].length === 4) {
            // YYYY-MM-DD
            year = parseInt(numbers[0].slice(-2), 10) || 90;
            month = parseInt(numbers[1], 10) || 1;
            day = parseInt(numbers[2], 10) || 1;
        } else {
            // DD-MM-YYYY
            day = parseInt(numbers[0], 10) || 1;
            month = parseInt(numbers[1], 10) || 1;
            year = parseInt(numbers[2].slice(-2), 10) || 90;
        }
    }

    // Standard Indonesian NIK: if female, day + 40
    let nikDay = day;
    if (isFemale) {
        nikDay += 40;
    }

    const dayStr = String(nikDay).padStart(2, '0');
    const monthStr = String(month).padStart(2, '0');
    const yearStr = String(year).padStart(2, '0');
    const dobPart = `${dayStr}${monthStr}${yearStr}`;

    // Ensure uniqueness of the 4-digit sequence
    for (let seq = 1; seq <= 9999; seq++) {
        const seqStr = String(seq).padStart(4, '0');
        const candidateNik = `${provinceCityDistrict}${dobPart}${seqStr}`;

        const existing = await prisma.idCard.findUnique({
            where: { nik: candidateNik }
        });

        if (!existing) {
            return candidateNik;
        }
    }

    // Fallback: random 4 digits with timestamp
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    return `${provinceCityDistrict}${dobPart}${randomSuffix}`;
}

/**
 * Saves a new Virtual ID Card to the database.
 */
export async function saveIdCard(data: {
    userJid: string;
    fullName: string;
    placeOfBirth: string;
    dateOfBirth: string;
    gender: string;
    address: string;
    religion: string;
    maritalStatus: string;
    occupation: string;
    citizenship?: string;
    validUntil?: string;
}) {
    const cleanedJid = cleanId(data.userJid);

    // Ensure user exists in database to satisfy foreign key constraint
    await prisma.user.upsert({
        where: { id: cleanedJid },
        update: {},
        create: {
            id: cleanedJid,
            pushName: data.fullName
        }
    });

    const nik = await generateNik(data.gender, data.dateOfBirth);

    const record = await prisma.idCard.create({
        data: {
            nik,
            userJid: cleanedJid,
            fullName: data.fullName.toUpperCase().trim(),
            placeOfBirth: data.placeOfBirth.toUpperCase().trim(),
            dateOfBirth: data.dateOfBirth.trim(),
            gender: data.gender.toUpperCase().trim(),
            address: data.address.toUpperCase().trim(),
            religion: data.religion.toUpperCase().trim(),
            maritalStatus: data.maritalStatus.toUpperCase().trim(),
            occupation: data.occupation.toUpperCase().trim(),
            citizenship: (data.citizenship || 'WNI').toUpperCase().trim(),
            validUntil: (data.validUntil || 'SEUMUR HIDUP').toUpperCase().trim()
        }
    });

    return record;
}

/**
 * Handles incoming conversational input for an ongoing ID registration session.
 * Returns true if the message was handled as part of registration.
 */
export async function processRegistrationStep(
    sock: WASocket,
    msg: WAMessage,
    userKey: string,
    remoteJid: string,
    input: string
): Promise<boolean> {
    const cleaned = cleanId(userKey);
    const session = registrationSessions.get(cleaned);
    if (!session) return false;

    session.lastActivity = Date.now();
    const trimmed = input.trim();

    // Cancellation check
    if (
        trimmed.toLowerCase() === '.cancel' ||
        trimmed.toLowerCase() === 'cancel' ||
        trimmed.toLowerCase() === '.batal'
    ) {
        registrationSessions.delete(cleaned);
        await sock.sendMessage(
            remoteJid,
            { text: 'Virtual ID card registration has been cancelled.' },
            { quoted: msg }
        );
        return true;
    }

    switch (session.step) {
        case 1: {
            // Full Name
            if (trimmed.length < 2) {
                await sock.sendMessage(
                    remoteJid,
                    { text: 'Please provide a valid full name (at least 2 characters).' },
                    { quoted: msg }
                );
                return true;
            }
            session.data.fullName = trimmed;
            session.step = 2;
            await sock.sendMessage(
                remoteJid,
                {
                    text: 'Thank you. Now, please reply with your *Place and Date of Birth* (e.g., Jakarta, 17-08-1990).'
                },
                { quoted: msg }
            );
            return true;
        }

        case 2: {
            // Place and Date of Birth
            const parts = trimmed.split(/,|\//);
            let place = trimmed;
            let dob = '01-01-2000';

            if (parts.length >= 2) {
                place = parts[0].trim();
                dob = parts.slice(1).join('-').trim();
            } else {
                const spaceIndex = trimmed.lastIndexOf(' ');
                if (spaceIndex !== -1) {
                    place = trimmed.substring(0, spaceIndex).trim();
                    dob = trimmed.substring(spaceIndex + 1).trim();
                }
            }

            session.data.placeOfBirth = place || 'INDONESIA';
            session.data.dateOfBirth = dob || '01-01-2000';
            session.step = 3;

            await sock.sendMessage(
                remoteJid,
                { text: 'Thank you. Please specify your *Gender* (e.g., Male / Female or Laki-laki / Perempuan).' },
                { quoted: msg }
            );
            return true;
        }

        case 3: {
            // Gender
            const g = trimmed.toUpperCase();
            let gender: string;
            if (g.includes('FEMALE') || g.includes('PEREMPUAN') || g.includes('WANITA') || g === 'P' || g === 'F') {
                gender = 'PEREMPUAN';
            } else if (g.includes('MALE') || g.includes('LAKI') || g.includes('PRIA') || g === 'L' || g === 'M') {
                gender = 'LAKI-LAKI';
            } else {
                gender = g;
            }

            session.data.gender = gender;
            session.step = 4;

            await sock.sendMessage(
                remoteJid,
                { text: 'Thank you. Please reply with your *Address* (e.g., Jl. Merdeka No. 1).' },
                { quoted: msg }
            );
            return true;
        }

        case 4: {
            // Address
            if (trimmed.length < 3) {
                await sock.sendMessage(remoteJid, { text: 'Please provide a valid address.' }, { quoted: msg });
                return true;
            }
            session.data.address = trimmed;
            session.step = 5;

            await sock.sendMessage(
                remoteJid,
                {
                    text: 'Thank you. Please specify your *Religion* (e.g., Islam, Christian, Catholic, Hindu, Buddhist, Confucian).'
                },
                { quoted: msg }
            );
            return true;
        }

        case 5: {
            // Religion
            session.data.religion = trimmed;
            session.step = 6;

            await sock.sendMessage(
                remoteJid,
                {
                    text: 'Thank you. Please specify your *Marital Status* (e.g., Single / Married or Belum Kawin / Kawin).'
                },
                { quoted: msg }
            );
            return true;
        }

        case 6: {
            // Marital Status
            let status = trimmed.toUpperCase();
            if (status.includes('SINGLE') || status.includes('BELUM')) {
                status = 'BELUM KAWIN';
            } else if (status.includes('MARRIED') || status.includes('KAWIN') || status.includes('MENIKAH')) {
                status = 'KAWIN';
            }
            session.data.maritalStatus = status;
            session.step = 7;

            await sock.sendMessage(
                remoteJid,
                {
                    text: 'Thank you. Please reply with your *Occupation* (e.g., Developer, Student, Entrepreneur).'
                },
                { quoted: msg }
            );
            return true;
        }

        case 7: {
            // Occupation - Final Step!
            session.data.occupation = trimmed;
            registrationSessions.delete(cleaned);

            await sock.sendMessage(
                remoteJid,
                { text: '⏳ All data collected successfully. Processing your virtual ID card...' },
                { quoted: msg }
            );

            try {
                // Save to database
                const saved = await saveIdCard({
                    userJid: cleaned,
                    fullName: session.data.fullName || 'CITIZEN',
                    placeOfBirth: session.data.placeOfBirth || 'INDONESIA',
                    dateOfBirth: session.data.dateOfBirth || '01-01-2000',
                    gender: session.data.gender || 'LAKI-LAKI',
                    address: session.data.address || 'JL. UTAMA NO. 1',
                    religion: session.data.religion || 'ISLAM',
                    maritalStatus: session.data.maritalStatus || 'BELUM KAWIN',
                    occupation: session.data.occupation || 'DEVELOPER',
                    citizenship: 'WNI',
                    validUntil: 'SEUMUR HIDUP'
                });

                // Fetch user's WhatsApp profile picture
                const pfpBuffer = await fetchUserProfilePic(
                    sock,
                    (msg.key.participant || msg.key.remoteJid) ?? cleaned
                );

                // Generate ID card image
                const imageBuffer = await generateIdCardImage(saved, pfpBuffer);

                const caption =
                    `✅ Your Virtual ID Card has been successfully issued! You can now use this ID to apply for future banking loans or licenses.\n\n` +
                    `*NIK:* ${saved.nik}\n` +
                    `*Full Name:* ${saved.fullName}\n` +
                    `*Date of Birth:* ${saved.dateOfBirth}\n` +
                    `*Gender:* ${saved.gender}\n` +
                    `*Citizenship:* ${saved.citizenship}\n` +
                    `*Valid Until:* ${saved.validUntil}`;

                await sock.sendMessage(remoteJid, { image: imageBuffer, caption }, { quoted: msg });
                return true;
            } catch (err) {
                console.error('[IdCard] Error generating final ID card:', err);
                await sock.sendMessage(
                    remoteJid,
                    { text: '❌ An error occurred while generating your Virtual ID Card. Please try again later.' },
                    { quoted: msg }
                );
                return true;
            }
        }

        default:
            registrationSessions.delete(cleaned);
            return false;
    }
}
