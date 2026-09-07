# Plan: Implement i18n (Internationalization) Support

This issue outlines the step-by-step plan to update the bot to support multiple languages using JSON files. This approach will allow us to easily manage translations and integrate with translation platforms like Crowdin.

## 1. Setup Locales Directory and Dependencies
- Install `i18next` as the core internationalization library, along with `i18next-fs-backend` for loading files from the disk: `pnpm add i18next i18next-fs-backend` (this combination seamlessly handles JSON parsing, interpolation, and loading locales from the file system).
- Create a new directory for translations: `src/locales/`.
- Implement Namespace-Based Organization by separating strings into logical namespaces instead of monolithic files:
```text
src/locales/
├── id/
│   ├── core.json          (Core system messages, errors)
│   ├── tools.json         (All tool-specific strings)
│   ├── games.json         (Minigame & casino strings)
│   ├── media.json         (Downloader & media tools)
│   └── utilities.json     (Utility function outputs)
├── en/
│   ├── core.json
│   ├── tools.json
│   └── ...
└── i18n.config.ts         (i18next initialization config)
```
- Define Cache Strategy in the i18n utility initialization:
```typescript
// Load all namespaces once at application startup (not per-request)
// Cache translations in memory during runtime
// Reload only on explicit refresh (for development/testing)
```

## 2. Update Database Schema
Modify `prisma/schema.prisma` to track language preferences. It is critical to store language preferences for both Users and Groups, to avoid confusing mixed-language replies in group chats where bot features trigger automatically.
```prisma
enum Language {
  ID
  EN
}

model User {
  // ... existing fields
  language Language @default(ID)
}

model WhitelistedGroup {
  // ... existing fields
  language Language @default(ID)
}

model Item {
  id        Int     @id @default(autoincrement())
  key       String  @unique  // e.g., "item.pedang_emas"
  basePrice Int
  rarity    String
  // Translation occurs at retrieval time via getTranslator
}

model Property {
  id        Int     @id @default(autoincrement())
  key       String  @unique  // e.g., "property.rumah_mewah"
  price     Int
}
```
- Provide a helper for dynamic content retrieval:
```typescript
export async function getItemWithTranslation(itemId: number, lang: string) {
  const item = await prisma.item.findUnique({ where: { id: itemId } });
  const t = getTranslator(lang);
  return {
    ...item,
    name: t(item.key), // Translates "item.pedang_emas" → "Pedang Emas"
  };
}
```
- Apply the changes via `pnpm prisma generate` and `pnpm prisma db push` (or `pnpm prisma migrate dev`).

## 3. Create i18n Utility Helper
Create a new utility `src/utils/i18n.ts`:
- Load the JSON files from `src/locales/` into memory and initialize `i18next`.
- Export a helper function `getTranslator(lang: string)` that returns a translation function `t(key: string, variables?: object)`.
- Implement Supported Languages Registry and Fallback Chain:
```typescript
export const SUPPORTED_LANGUAGES = ['id', 'en'] as const;

export function getTranslator(lang: string) {
  // Validate requested language
  const finalLang = SUPPORTED_LANGUAGES.includes(lang as any) 
    ? lang 
    : 'id'; // Fallback to Indonesian
  
  return (key: string, variables?: Record<string, any>) => {
    // Load from cache or file
    // If key not found in finalLang, fallback to 'id'
  };
}
```
- **Missing Key Handling**: Specify behavior when a translation key is missing: log a warning in development, return the key itself (e.g., `"tools.balance.title"`) in production, and never throw errors.

## 4. Update Tool Context
Modify `src/tools/types.ts` to expose the translation function inside `ToolContext` so all tools can easily access it:
```typescript
export interface ToolContext {
    sock: WASocket;
    msg: WAMessage;
    jid: string;
    t: (key: string, args?: Record<string, any>) => string;
    // ... other existing context properties
}
```

## 5. Update Message Handler (`src/handlers/message.ts`)
- In `handleMessage`, determine the chat language dynamically: 
  - If the chat is a group (`jid.endsWith('@g.us')`), fetch the `language` from `WhitelistedGroup`.
  - Otherwise, fetch the `language` from `User`.
- Initialize the translation function for the current request: `const t = getTranslator(language);`
- Pass `t` into `toolsHandler.execute` within the context object.
- Replace raw string responses directly inside `message.ts` (e.g., `"This command can only be used by the bot owner."`) with `t('core.owner_only')`.
- Ensure all currency output utilizes the new `formatCurrency()` helper to maintain strict IDR formatting.

## 6. Crowdin Integration Setup
- Create a `crowdin.yml` configuration file in the project root to map the source files (`src/locales/id/*.json`) to the translation files (`src/locales/%two_letters_code%/%original_file_name%`).
- Link the Crowdin project to the GitHub repository to enable automatic bi-directional sync for translators.

## 7. Refactor Tools and Utilities (Batched Approach)
Due to the large volume of tools (~55+) and utility files, the refactoring should be broken down into sub-issues or separate Pull Requests to ensure stability:
- **Phase 1: Utilities**: Update function signatures in files like `src/utils/idCard.ts` to accept `t` as a parameter and replace their hardcoded strings.
- **Phase 2: Core/Admin Tools**: Refactor administrative and core configuration tools (e.g., `.addgroup`, `.addbalance`).
- **Phase 3: Casino/Minigame Tools**: Refactor tools related to betting, as they involve many output strings.
- **Phase 4: Downloader/Media Tools**: Refactor sticker and media download tools.

## 8. Create Language Settings Tools
- Create `src/tools/setlang.ts`: Command `.setlang <lang>` to update the `language` column in the `User` table for the individual sender.
- Create `src/tools/setgrouplang.ts`: Command `.setgrouplang <lang>` (Admin only) to update the `WhitelistedGroup`'s default language.

## 9. Translation Keys Naming Convention
Establish and document the following naming convention:
- **Naming Pattern**: `<namespace>.<feature>.<string_purpose>`
  - Examples:
    ```json
    {
      "core.owner_only": "This command can only be used by the bot owner.",
      "core.error_database": "Database error occurred. Please try again.",
      "tools.balance.title": "💰 Balance",
      "tools.balance.no_account": "You don't have an account yet. Use .daily to start.",
      "games.coinflip.won": "You won Rp{{amount}}!",
      "games.coinflip.lost": "You lost Rp{{amount}}.",
      "media.ytdl.invalid_url": "Invalid YouTube URL provided."
    }
    ```
- **Variable Interpolation**: Use double-brace syntax for variables: `"games.roulette.bullet_count": "Bullets loaded: {{count}}/6"`
- **Pluralization**: For tools supporting plural forms:
  ```json
  {
    "tools.inventory.items_count_one": "You have 1 item.",
    "tools.inventory.items_count_other": "You have {{count}} items."
  }
  ```

## 10. Translation Keys Validation & Tooling
- **Add Validation Script**: Create `scripts/validate-i18n.ts`:
  ```typescript
  // Validates that all keys in id.json exist in other language files
  // Warns about missing or extra keys
  // Runs in CI/CD pipeline
  import * as fs from 'fs';
  import * as path from 'path';

  const localesDir = path.join(__dirname, '../src/locales');
  const baseLanguage = 'id';
  // Compare key structures and report discrepancies
  ```
- **Pre-commit Hook**: Add to `package.json`:
  ```json
  {
    "husky": {
      "hooks": {
        "pre-commit": "pnpm run validate:i18n"
      }
    }
  }
  ```

## 11. RTL Language Preparation (Future-Proofing)
- **Prepare for RTL Support**: Add a configuration layer to `src/utils/i18n.ts`:
  ```typescript
  export const LANGUAGE_CONFIG = {
    id: { nativeName: 'Bahasa Indonesia', direction: 'ltr' },
    en: { nativeName: 'English', direction: 'ltr' },
    // ar: { nativeName: 'العربية', direction: 'rtl' }, // Future
  };

  export function isRTL(lang: string): boolean {
    return LANGUAGE_CONFIG[lang]?.direction === 'rtl';
  }
  ```

---

### Resolved Considerations for Implementation
1. **Formatting Rules (Currency)**: As per `AGENTS.md`, strict Rupiah formatting globally (`Rp`) will be maintained. Use the `formatCurrency()` helper exclusively for all monetary values. This bypasses language-specific i18n and ensures IDR is always formatted consistently (e.g., "Rp1.000.000" or "1.000.000 IDR") regardless of user language preference.
   - Create `src/utils/format.ts` to centralize locale-aware formatting:
     ```typescript
     export function formatCurrency(amount: number): string {
       return new Intl.NumberFormat('id-ID', {
         style: 'currency',
         currency: 'IDR',
         minimumFractionDigits: 0,
       }).format(amount);
     }
     
     export function formatNumber(num: number, lang: 'id' | 'en' = 'id'): string {
       const localeMap = { id: 'id-ID', en: 'en-US' };
       return new Intl.NumberFormat(localeMap[lang]).format(num);
     }
     
     export function formatDate(date: Date, lang: 'id' | 'en' = 'id'): string {
       const localeMap = { id: 'id-ID', en: 'en-US' };
       return new Intl.DateTimeFormat(localeMap[lang], {
         year: 'numeric',
         month: 'long',
         day: 'numeric',
       }).format(date);
     }
     ```
2. **Dynamic Database Content**: Database strings (like item names and properties) will be refactored to store static translation keys (e.g., `item.pedang_emas`) rather than literal strings. This ensures they can be fully translated when fetched and displayed by the bot.
3. **Offline AI Responder**: The AI responder (`src/utils/offlineAi.ts`) generates natural language responses. We will need to pass the resolved group/user language string directly into the AI's system prompt so its generated text output matches the chat's local preference.
   - Modify `src/utils/offlineAi.ts`:
     ```typescript
     export async function generateAiResponse(
       message: string,
       lang: 'id' | 'en' = 'id'
     ): Promise<string> {
       const languageMap = {
         id: 'Indonesian',
         en: 'English',
       };

       const systemPrompt = `You are a helpful WhatsApp bot assistant. Always respond in ${languageMap[lang]}.
         
         ${lang === 'id' 
           ? 'Gunakan Rupiah (Rp) untuk mata uang dan format Indonesia untuk angka dan tanggal.'
           : 'Use Rupiah (Rp) for currency and Indonesian number/date formatting (required by business logic).'
         }
       `;

       // ... rest of AI logic
     }
     ```

## 12. Translation File Checklist
Below is a categorized checklist of files that require string translation, ordered by importance. This should be used by the coding agent as a reference:

### Priority 1: Core Systems & Handlers
- [ ] `src/handlers/message.ts`
- [ ] `src/tools/handler.ts`

### Priority 2: Utilities (User-facing output)
- [ ] `src/utils/idCard.ts`
- [ ] `src/utils/casino.ts`
- [ ] `src/utils/roulette.ts`
- [ ] `src/utils/rouletteAfkTimer.ts`
- [ ] `src/utils/lyricsPlayer.ts`
- [ ] `src/utils/autoSticker.ts`
- [ ] `src/utils/autoDelete.ts`
- [ ] `src/utils/autodl.ts`

### Priority 3: Core & Admin Tools
- [ ] `src/tools/help.ts`
- [ ] `src/tools/cancel.ts`
- [ ] `src/tools/addbalance.ts`
- [ ] `src/tools/forceupdate.ts`
- [ ] `src/tools/system_info.ts`

### Priority 4: Minigame & Economy Tools
- [ ] `src/tools/balance.ts`
- [ ] `src/tools/daily.ts`
- [ ] `src/tools/coinflip.ts`
- [ ] `src/tools/dice.ts`
- [ ] `src/tools/slot.ts`
- [ ] `src/tools/transfer.ts`
- [ ] `src/tools/loan.ts`
- [ ] `src/tools/vault.ts`
- [ ] `src/tools/top.ts`
- [ ] `src/tools/topglobal.ts`
- [ ] `src/tools/apply_job.ts`
- [ ] `src/tools/apply_license.ts`
- [ ] `src/tools/market.ts`
- [ ] `src/tools/shop.ts`

### Priority 5: Buckshot Roulette Tools
- [ ] `src/tools/roulette_creategame.ts`
- [ ] `src/tools/roulette_joingame.ts`
- [ ] `src/tools/roulette_startgame.ts`
- [ ] `src/tools/roulette_shoot.ts`
- [ ] `src/tools/roulette_use.ts`
- [ ] `src/tools/roulette_bet.ts`

### Priority 6: Properties & Inventory Tools
- [ ] `src/tools/property_buy.ts`
- [ ] `src/tools/property_catalog.ts`
- [ ] `src/tools/property_inventory.ts`
- [ ] `src/tools/property_sell.ts`

### Priority 7: Media & Downloader Tools
- [ ] `src/tools/ytdl.ts`
- [ ] `src/tools/tiktokdl.ts`
- [ ] `src/tools/telegramdl.ts`
- [ ] `src/tools/pinterestdl.ts`
- [ ] `src/tools/play.ts`
- [ ] `src/tools/playlyrics.ts`
- [ ] `src/tools/stoplyrics.ts`

### Priority 8: Sticker & Processing Tools
- [ ] `src/tools/sticker_maker.ts`
- [ ] `src/tools/togglesticker.ts`
- [ ] `src/tools/stoptogglesticker.ts`
- [ ] `src/tools/getprofilephoto.ts`
- [ ] `src/tools/quoted.ts`
- [ ] `src/tools/readviewonce.ts`

### Priority 9: AI & Misc Tools
- [ ] `src/tools/stt.ts`
- [ ] `src/tools/idcard.ts`
- [ ] `src/tools/toggleofflineai.ts`
- [ ] `src/tools/startautocorrection.ts`
- [ ] `src/tools/stopautocorrection.ts`
- [ ] `src/tools/toggleautocorrection.ts`
- [ ] `src/tools/tgadd.ts`
- [ ] `src/tools/tgdel.ts`
- [ ] `src/tools/tglist.ts`

---

## Appendix: Clarifying Questions for Scope
Before proceeding with implementation, the following areas require clarification:

### 1. Language Roadmap
- **Question**: How many languages are currently planned for Phase 1 release? Currently only Indonesian (id) and English (en) are mentioned. Are additional languages (Spanish, Portuguese, etc.) planned for future phases?
- **Action**: Update plan with explicit language support timeline once clarified.

### 2. Crowdin Collaboration
- **Question**: Will Crowdin be used for collaborative community translation, or is this an internal team effort?
- **Action**: Clarify translator workflow (pull request-based, Crowdin-only, hybrid).

### 3. Plural Forms & Gender Agreement
- **Question**: Will the bot use i18next's pluralization and context features for language-specific grammar (e.g., Indonesian gender-neutral vs. Romance languages with gender)?
- **Action**: If yes, note which tools require plural support in the translation file checklist.
