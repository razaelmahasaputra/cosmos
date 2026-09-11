import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const localesDir = path.resolve(__dirname, '../src/locales');
const baseLanguage = 'id';
const targetLanguages = ['en'];

function getAllKeyPaths(obj: Record<string, any>, prefix = ''): string[] {
    let keys: string[] = [];
    for (const [k, v] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${k}` : k;
        if (v && typeof v === 'object' && !Array.isArray(v)) {
            keys = keys.concat(getAllKeyPaths(v, fullKey));
        } else {
            keys.push(fullKey);
        }
    }
    return keys;
}

function validateI18n(): boolean {
    console.log(`[i18n-validator] Validating translation files in: ${localesDir}`);
    const baseDir = path.join(localesDir, baseLanguage);

    if (!fs.existsSync(baseDir)) {
        console.error(`[i18n-validator] Base language directory not found: ${baseDir}`);
        return false;
    }

    const baseFiles = fs.readdirSync(baseDir).filter((f) => f.endsWith('.json'));
    let hasError = false;

    for (const file of baseFiles) {
        const baseFilePath = path.join(baseDir, file);
        let baseContent: Record<string, any>;
        try {
            baseContent = JSON.parse(fs.readFileSync(baseFilePath, 'utf-8'));
        } catch (err: any) {
            console.error(`[i18n-validator] Failed to parse ${baseFilePath}:`, err.message);
            hasError = true;
            continue;
        }

        const baseKeys = getAllKeyPaths(baseContent);

        for (const targetLang of targetLanguages) {
            const targetFilePath = path.join(localesDir, targetLang, file);
            if (!fs.existsSync(targetFilePath)) {
                console.error(`[i18n-validator] Missing translation file: ${targetFilePath}`);
                hasError = true;
                continue;
            }

            let targetContent: Record<string, any>;
            try {
                targetContent = JSON.parse(fs.readFileSync(targetFilePath, 'utf-8'));
            } catch (err: any) {
                console.error(`[i18n-validator] Failed to parse ${targetFilePath}:`, err.message);
                hasError = true;
                continue;
            }

            const targetKeys = getAllKeyPaths(targetContent);

            const missingKeys = baseKeys.filter((k) => !targetKeys.includes(k));
            const extraKeys = targetKeys.filter((k) => !baseKeys.includes(k));

            if (missingKeys.length > 0) {
                console.error(
                    `[i18n-validator] [${targetLang}/${file}] Missing ${missingKeys.length} keys:\n  - ${missingKeys.join('\n  - ')}`
                );
                hasError = true;
            }

            if (extraKeys.length > 0) {
                console.warn(
                    `[i18n-validator] [${targetLang}/${file}] Extra ${extraKeys.length} keys:\n  - ${extraKeys.join('\n  - ')}`
                );
            }
        }
    }

    if (!hasError) {
        console.log('✓ [i18n-validator] All translation keys are in sync across all supported languages.');
        return true;
    }
    return false;
}

const success = validateI18n();
if (!success) {
    process.exit(1);
}
