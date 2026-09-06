# Plan: Implement i18n (Internationalization) Support

This issue outlines the step-by-step plan to update the bot to support multiple languages using JSON files. This approach will allow us to easily manage translations and integrate with translation platforms like Crowdin.

## 1. Setup Locales Directory and Dependencies
- Install `i18next` as the core internationalization library: `pnpm add i18next` (it's lightweight and handles JSON parsing, interpolation, and pluralization natively).
- Create a new directory for translations: `src/locales/`.
- Initialize translation JSON files:
  - `src/locales/en.json` (This will be the source of truth).
  - `src/locales/id.json` (For Indonesian translations).

## 2. Update Database Schema
Modify `prisma/schema.prisma` to track language preferences. It is critical to store language preferences for both Users and Groups, to avoid confusing mixed-language replies in group chats where bot features trigger automatically.
```prisma
model User {
  // ... existing fields
  language       String    @default("en") 
}

model WhitelistedGroup {
  // ... existing fields
  language       String    @default("en")
}
```
- Apply the changes via `pnpm prisma generate` and `pnpm prisma db push` (or `pnpm prisma migrate dev`).

## 3. Create i18n Utility Helper
Create a new utility `src/utils/i18n.ts`:
- Load the JSON files from `src/locales/` into memory and initialize `i18next`.
- Export a helper function `getTranslator(lang: string)` that returns a translation function `t(key: string, variables?: object)`.

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

## 6. Refactor Tools and Utilities (Batched Approach)
Due to the large volume of tools (~55+) and utility files, the refactoring should be broken down into sub-issues or separate Pull Requests to ensure stability:
- **Phase 1: Utilities**: Update function signatures in files like `src/utils/idCard.ts` to accept `t` as a parameter and replace their hardcoded strings.
- **Phase 2: Core/Admin Tools**: Refactor administrative and core configuration tools (e.g., `.addgroup`, `.addbalance`).
- **Phase 3: Casino/Minigame Tools**: Refactor tools related to betting, as they involve many output strings.
- **Phase 4: Downloader/Media Tools**: Refactor sticker and media download tools.

## 7. Create Language Settings Tools
- Create `src/tools/setlang.ts`: Command `.setlang <lang>` to update the `language` column in the `User` table for the individual sender.
- Create `src/tools/setgrouplang.ts`: Command `.setgrouplang <lang>` (Admin only) to update the `WhitelistedGroup`'s default language.

## 8. Crowdin Integration Setup
- Create a `crowdin.yml` configuration file in the project root to map the source file (`src/locales/en.json`) to the translation files (`src/locales/%two_letters_code%.json`).
- Link the Crowdin project to the GitHub repository to enable automatic bi-directional sync for translators.

---

### Open Questions & Considerations for Implementation
1. **Formatting Rules (Currency)**: `AGENTS.md` mandates strict Rupiah formatting globally (`Rp`). If a user switches to English (`en`), we need to decide if currency formats should adapt (e.g., USD format) or strictly remain in IDR standard formatting.
2. **Dynamic Database Content**: Item names (e.g., Properties, Inventory) are stored dynamically in the database. The current i18n JSON plan covers static UI/command strings. A strategy will be needed if we want to translate dynamic database enums/values.
3. **Offline AI Responder**: The AI responder (`src/utils/offlineAi.ts`) generates natural language responses. We will need to pass the resolved group/user language string directly into the AI's system prompt so its generated text output matches the chat's local preference.
