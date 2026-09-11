import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import opentype from 'opentype.js';
import axios from 'axios';
import { WASocket } from '@whiskeysockets/baileys';

export interface IdCardData {
    nik: string;
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
}

let cachedFontBold: opentype.Font | null = null;
let cachedFontMedium: opentype.Font | null = null;

function toArrayBuffer(buf: Buffer): ArrayBuffer {
    const ab = new ArrayBuffer(buf.byteLength);
    const view = new Uint8Array(ab);
    view.set(buf);
    return ab;
}

function loadFonts(): { fontBold: opentype.Font; fontMedium: opentype.Font } {
    if (cachedFontBold && cachedFontMedium) {
        return { fontBold: cachedFontBold, fontMedium: cachedFontMedium };
    }

    const boldPath = path.resolve(process.cwd(), 'storage', 'fonts', 'static', 'Roboto-Bold.ttf');
    const mediumPath = path.resolve(process.cwd(), 'storage', 'fonts', 'static', 'Roboto-Medium.ttf');

    if (!fs.existsSync(boldPath) || !fs.existsSync(mediumPath)) {
        throw new Error(`Roboto fonts not found in ${path.resolve(process.cwd(), 'storage', 'fonts', 'static')}`);
    }

    const bufBold = fs.readFileSync(boldPath);
    const bufMedium = fs.readFileSync(mediumPath);

    cachedFontBold = opentype.parse(toArrayBuffer(bufBold));
    cachedFontMedium = opentype.parse(toArrayBuffer(bufMedium));

    return { fontBold: cachedFontBold, fontMedium: cachedFontMedium };
}

function getTextWidth(font: opentype.Font, text: string, fontSize: number): number {
    const scale = (1 / font.unitsPerEm) * fontSize;
    let width = 0;
    for (let i = 0; i < text.length; i++) {
        const glyph = font.charToGlyph(text[i]);
        width += (glyph.advanceWidth || font.unitsPerEm) * scale;
    }
    return width;
}

function renderTextPath(
    font: opentype.Font,
    text: string,
    startX: number,
    baselineY: number,
    fontSize: number,
    maxWidth?: number
): string {
    let effectiveFontSize = fontSize;
    if (maxWidth) {
        const currentWidth = getTextWidth(font, text, fontSize);
        if (currentWidth > maxWidth) {
            effectiveFontSize = Math.max(14, Math.floor(fontSize * (maxWidth / currentWidth)));
        }
    }

    const scale = (1 / font.unitsPerEm) * effectiveFontSize;
    const p = new opentype.Path();
    let x = startX;

    for (let i = 0; i < text.length; i++) {
        const glyph = font.charToGlyph(text[i]);
        const glyphPath = glyph.getPath(x, baselineY, effectiveFontSize);
        p.commands.push(...glyphPath.commands);
        x += (glyph.advanceWidth || font.unitsPerEm) * scale;
    }

    return p.toSVG(2);
}

/**
 * Creates a standard placeholder silhouette image (Indonesian red pas-foto background)
 * when a user's WhatsApp profile picture is unavailable.
 */
export async function createPlaceholderPhotoBuffer(): Promise<Buffer> {
    const placeholderSvg = `
        <svg width="270" height="345" xmlns="http://www.w3.org/2000/svg">
            <rect width="270" height="345" fill="#b91c1c" />
            <circle cx="135" cy="120" r="55" fill="#e2e8f0" />
            <path d="M 40 345 C 40 230, 230 230, 230 345 Z" fill="#e2e8f0" />
        </svg>
    `;
    return await sharp(Buffer.from(placeholderSvg)).png().toBuffer();
}

/**
 * Attempts to fetch the WhatsApp profile picture for a given JID or LID.
 * Returns null if the profile picture is hidden, private, or not available.
 */
export async function fetchUserProfilePic(sock: WASocket, userJidOrLid: string): Promise<Buffer | null> {
    if (!sock || typeof sock.profilePictureUrl !== 'function' || !userJidOrLid) {
        return null;
    }

    try {
        const cleaned = userJidOrLid.split(':')[0].split('@')[0];
        const normalizedJid = userJidOrLid.includes('@')
            ? userJidOrLid
            : cleaned.length > 14
              ? `${cleaned}@lid`
              : `${cleaned}@s.whatsapp.net`;

        const url = await sock.profilePictureUrl(normalizedJid, 'image');
        if (!url) return null;

        const response = await axios.get(url, {
            responseType: 'arraybuffer',
            timeout: 8000
        });

        if (response.status === 200 && response.data) {
            return Buffer.from(response.data);
        }
    } catch (err) {
        console.warn(`[IdCard] Could not fetch profile picture for ${userJidOrLid}:`, (err as Error).message);
    }
    return null;
}

/**
 * Generates the complete Virtual ID Card image by compositing user details
 * and their photo onto ktp_template.jpg using sharp.
 */
export async function generateIdCardImage(data: IdCardData, profilePicBuffer?: Buffer | null): Promise<Buffer> {
    const templatePath = path.resolve(process.cwd(), 'storage', 'ktp_template.jpg');
    if (!fs.existsSync(templatePath)) {
        throw new Error(`KTP template image not found at ${templatePath}`);
    }

    const { fontBold, fontMedium } = loadFonts();

    // Prepare text paths (text column has max width ~480 before hitting pas-foto at x=916)
    const paths: string[] = [];

    // NIK (bold, large)
    paths.push(renderTextPath(fontBold, String(data.nik).toUpperCase(), 340, 206, 36, 540));

    // Full Name (bold)
    paths.push(renderTextPath(fontBold, String(data.fullName).toUpperCase(), 420, 268, 25, 480));

    // Place and Date of Birth
    const birthStr = `${data.placeOfBirth}, ${data.dateOfBirth}`.toUpperCase();
    paths.push(renderTextPath(fontMedium, birthStr, 420, 311, 24, 480));

    // Gender
    paths.push(renderTextPath(fontMedium, String(data.gender).toUpperCase(), 420, 355, 24, 480));

    // Address
    paths.push(renderTextPath(fontMedium, String(data.address).toUpperCase(), 420, 398, 24, 480));

    // Religion
    paths.push(renderTextPath(fontMedium, String(data.religion).toUpperCase(), 420, 441, 24, 480));

    // Marital Status
    paths.push(renderTextPath(fontMedium, String(data.maritalStatus).toUpperCase(), 420, 485, 24, 480));

    // Occupation
    paths.push(renderTextPath(fontMedium, String(data.occupation).toUpperCase(), 420, 528, 24, 480));

    // Citizenship (default "WNI")
    const citizenship = (data.citizenship || 'WNI').toUpperCase();
    paths.push(renderTextPath(fontMedium, citizenship, 420, 572, 24, 480));

    // Valid Until (default "SEUMUR HIDUP")
    const validUntil = (data.validUntil || 'SEUMUR HIDUP').toUpperCase();
    paths.push(renderTextPath(fontMedium, validUntil, 420, 616, 24, 480));

    const textSvg = `<svg width="1264" height="848" xmlns="http://www.w3.org/2000/svg">${paths.join('')}</svg>`;

    // Prepare photo buffer (270x345)
    let photoBuffer: Buffer;
    if (profilePicBuffer && profilePicBuffer.length > 0) {
        try {
            photoBuffer = await sharp(profilePicBuffer)
                .resize(270, 345, { fit: 'cover', position: 'center' })
                .toBuffer();
        } catch (photoErr) {
            console.warn('[IdCard] Failed to resize profile picture, falling back to placeholder:', photoErr);
            photoBuffer = await createPlaceholderPhotoBuffer();
        }
    } else {
        photoBuffer = await createPlaceholderPhotoBuffer();
    }

    // Composite onto ktp_template.jpg
    const finalImageBuffer = await sharp(templatePath)
        .composite([
            { input: photoBuffer, top: 198, left: 916 },
            { input: Buffer.from(textSvg), top: 0, left: 0 }
        ])
        .jpeg({ quality: 95 })
        .toBuffer();

    return finalImageBuffer;
}
