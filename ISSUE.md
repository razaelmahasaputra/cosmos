# [RFC / Refactor] Modernize and Modularize Menu & Help System

- **Target Version:** `RF-2609-04`
- **Component:** Core UX / Tools Subsystem
- **Status:** Proposed / Planned
- **Development Branch:** [`feature/refactor-menu`](https://github.com/razaelmahasaputra/cosmos/tree/feature/refactor-menu)
- **Banner Asset:** `https://files.catbox.moe/hygluw.png` (stored locally in [`assets/menu_banner.png`](file:///home/razael/cosmos/assets/menu_banner.png))
- **Related Files:**
  - [`assets/menu_banner.png`](file:///home/razael/cosmos/assets/menu_banner.png) (Local media banner)
  - [`src/tools/help.ts`](file:///home/razael/cosmos/src/tools/help.ts)
  - [`src/tools/handler.ts`](file:///home/razael/cosmos/src/tools/handler.ts)
  - [`src/tools/types.ts`](file:///home/razael/cosmos/src/tools/types.ts)
  - [`src/utils/menuAssets.ts`](file:///home/razael/cosmos/src/utils/menuAssets.ts)
  - [`src/utils/menuFormatter.ts`](file:///home/razael/cosmos/src/utils/menuFormatter.ts)
  - [`src/services/menuService.ts`](file:///home/razael/cosmos/src/services/menuService.ts)
  - [`src/locales/en/tools.json`](file:///home/razael/cosmos/src/locales/en/tools.json)
  - [`src/locales/id/tools.json`](file:///home/razael/cosmos/src/locales/id/tools.json)
  - [`src/handlers/message.ts`](file:///home/razael/cosmos/src/handlers/message.ts)

---

## 1. Problem Statement & Motivation

The current implementation of the bot's help and menu commands in [`src/tools/help.ts`](file:///home/razael/cosmos/src/tools/help.ts) suffers from architectural clutter, limited usability, and visual deficiencies:

1. **Monolithic & Coupled Architecture**:
   - [`src/tools/help.ts`](file:///home/razael/cosmos/src/tools/help.ts) contains dynamic reflection, category aggregation, prefix formatting, and raw string composition all intertwined within a single function.
   - Re-iterates and allocates memory on every single command invocation without caching static tool definitions.
   - Command aliases have inconsistent prefix conventions across tool definitions (some include a leading dot like `['.help', '.menu']` while others omit it like `['shift', 'kerja']`), leading to messy or missing prefixes when rendered.

2. **Broken Command Inspection (`.help <command>`)**:
   - The current logic treats the argument strictly as a category name:
     ```typescript
     const matchedCategory = categories.find(
         (c) => c.toLowerCase() === requestedCategory || c.toLowerCase().includes(requestedCategory)
     );
     ```
   - When a user asks for help with a specific command (e.g., `.help slot` or `.help bank`), the system fails and responds that the category was not found, instead of inspecting the command.

3. **Rudimentary & Plain Output (Un-bot-like Aesthetic)**:
   - Modern WhatsApp bot ecosystems (Baileys-based bots) rely on structured UI cards with Unicode frames (`╭─`, `│`, `╰─` or `┌─`, `│`, `└─`), dynamic user dashboards (pushname, latency, uptime, active language, command count), category badges, and **visual media banners**.
   - Currently, help messages are delivered as plain text monospace command strings (` ```.help Casino``` `) lacking visual hierarchy, icons, or banner imagery.

4. **Missing Navigation Modes**:
   - No dedicated overview menu displaying categories alongside command tallies.
   - No all-in-one command catalog option (`.menu all` / `.allmenu`) for users who want to review the complete feature set at a glance.
   - No distinction between `.menu` (quick navigation dashboard) and `.help` (detailed command documentation and syntax guide).

---

## 2. Proposed Architecture & Design

### A. Architectural Overview

We decouple the presentation and indexing logic from the tool entrypoints by introducing a dedicated Service, Formatter, and Media Asset layer:

```
┌──────────────────────────────────────────────┐
│            Incoming Chat Message             │
│           (.menu, .help, .bantuan)           │
└───────────────────────┬──────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────┐
│              src/tools/help.ts               │◄── Entrypoint Controller
│              src/tools/menu.ts               │    (Parses intent: all / category / command)
└───────────────┬───────────────┬──────────────┘
                │               │
        ┌───────┴───────┐       ▼
        ▼               ▼ ┌───────────────────────────┐
┌──────────────┐ ┌──────────────┐ │ MenuAssets Utility        │
│ MenuService  │ │MenuFormatter │ │ (assets/menu_banner.png)  │
│ (Catalog &   │ │ (Unicode UI  │ └─────────────┬─────────────┘
│  Reflection) │ │  Templates)  │               │
└───────┬──────┘ └──────┬───────┘               │
        │               │                       │
        └───────┬───────┴───────────────────────┘
                ▼
┌──────────────────────────────────────────────┐
│ Baileys sendMessage with Banner Attribute    │
│ contextInfo.externalAdReply                  │
│ renderLargerThumbnail: true                  │
└──────────────────────────────────────────────┘
```

### B. Module Breakdown

1. **[`assets/menu_banner.png`](file:///home/razael/cosmos/assets/menu_banner.png)** (Media Asset):
   - Located in the root `assets/` folder, downloaded from `https://files.catbox.moe/hygluw.png`.
   - Acts as the visual banner for all menu and help invocations.
   - Includes a generated placeholder fallback in [`assets/menu_banner.placeholder.png`](file:///home/razael/cosmos/assets/menu_banner.placeholder.png) if the remote URL serves an empty (0-byte) file.

2. **[`src/utils/menuAssets.ts`](file:///home/razael/cosmos/src/utils/menuAssets.ts)** (Asset Loader):
   - Safely loads and caches the binary image buffer from `assets/menu_banner.png`.
   - Validates buffer integrity (ensures non-zero byte length).
   - Exports `getMenuBannerBuffer(): Buffer` for seamless Baileys payload integration.

3. **[`src/services/menuService.ts`](file:///home/razael/cosmos/src/services/menuService.ts)** (Catalog Service):
   - **Catalog Indexing & Cache:** Memoizes tool definitions from [`ToolsHandler`](file:///home/razael/cosmos/src/tools/handler.ts) on startup.
   - **Category Normalization:** Consolidates related micro-categories (e.g., maps `Banking` into `Economy & Banking`, `Music & Lyrics` into `Music & Audio`, `Licensing` into `Employment`).
   - **Lookup Engine:** Efficient lookup by command name, alias (with or without dot), or category fuzzy-match.
   - **System Stats Provider:** Computes uptime, formatted date, latency, and counts total active commands.

4. **[`src/utils/menuFormatter.ts`](file:///home/razael/cosmos/src/utils/menuFormatter.ts)** (UI Formatter):
   - **Header / Dashboard Card:** Generates a card with user pushname, role (Owner/Member), bot uptime, response latency, prefix, and active language.
   - **Category Overview View (`.menu`):** Renders numbered category cards with thematic icons (🎰, 🎮, 💰, 💼, 📥, 🎵, 🎨, 🤖, 🛠️, ⚙️, ℹ️) and command counts.
   - **Category Detail View (`.menu <category>`):** Renders all commands in a category with usage signatures and descriptions.
   - **All-In-One Menu View (`.menu all`):** Compact, categorized listing of all commands.
   - **Command Inspector View (`.help <command>`):** Detailed card displaying command name, aliases, description, parameters, required permissions, and example usages.

5. **[`src/tools/help.ts`](file:///home/razael/cosmos/src/tools/help.ts) & [`src/tools/menu.ts`](file:///home/razael/cosmos/src/tools/menu.ts)**:
   - Clean, lightweight action handlers that delegate data retrieval to `MenuService` and formatting to `MenuFormatter`, then dispatch the message via Baileys with the banner attribute.

---

## 3. Baileys Banner Implementation (`renderLargerThumbnail`)

### A. The Specific Baileys Attribute

In Baileys (`@whiskeysockets/baileys`), WhatsApp message bubbles support an interactive hero preview banner attached to text messages using the **`externalAdReply`** attribute inside **`contextInfo`**.

Specifically, setting **`renderLargerThumbnail: true`** (defined in `proto.ContextInfo.ExternalAdReplyInfo` field 11) forces WhatsApp mobile and web clients to render the thumbnail buffer as a **wide, full-bleed hero banner** at the top of the message card, rather than a small square thumbnail on the side:

```typescript
import fs from 'fs';
import path from 'path';
import { getMenuBannerBuffer } from '#utils/menuAssets.js';

// Construct Baileys payload with large hero banner
const bannerBuffer = getMenuBannerBuffer();

await ctx.sock.sendMessage(
    ctx.jid,
    {
        text: menuText,
        contextInfo: {
            externalAdReply: {
                title: 'COSMOS SYSTEM BOT',
                body: 'Multi-Device WhatsApp Bot Framework',
                mediaType: 1, // IMAGE
                thumbnail: bannerBuffer,
                renderLargerThumbnail: true, // Specific Baileys attribute for hero banner
                sourceUrl: 'https://github.com/razaelmahasaputra/cosmos',
                mediaUrl: 'https://files.catbox.moe/hygluw.png'
            },
            mentionedJid: mentions
        }
    },
    { quoted: ctx.msg }
);
```

### B. Why `renderLargerThumbnail: true` is Superior

1. **No Media Quota Overhead:** It attaches as an enriched preview metadata card on the text message rather than a standalone photo upload, ensuring lightning-fast delivery even on slow mobile networks.
2. **Authentic Bot Aesthetic:** It delivers the signature high-end look recognized across standard WhatsApp bots.
3. **Interactive & Clean:** The image sits neatly at the header of the card while the entire menu text remains fully copyable and readable below.

---

## 4. UI / UX Design Specifications

### A. Top Banner & Dashboard Header

The menu message arrives with the hero banner rendered by Baileys at the top, immediately followed by the standardized user and server dashboard card:

```text
[ 🖼️ HERO BANNER: assets/menu_banner.png rendered via renderLargerThumbnail: true ]

╭━━━〔 *COSMOS BOT* 〕━━━╮
┃ 👤 *User:* @PushName
┃ 👑 *Role:* Owner / Member
┃ ⚡ *Speed:* 42ms
┃ ⏱️ *Uptime:* 2d 14h 32m
┃ 📅 *Date:* Saturday, 12 Sep 2026
┃ 🌐 *Language:* English (en)
┃ ⌨️ *Prefix:* [ . ]
┃ 📊 *Total Commands:* 48
╰━━━━━━━━━━━━━━━━━━━━━╯
```

### B. Category Overview Menu (`.menu`)

When the user types `.menu` (or `.help` with no arguments), a clean category overview is displayed:

```text
┌──「 *COMMAND CATEGORIES* 」
│ 🎰 1. Casino [11 commands]
│ 🎮 2. Games [6 commands]
│ 💰 3. Economy & Banking [8 commands]
│ 💼 4. Employment [3 commands]
│ 📥 5. Downloaders [7 commands]
│ 🎵 6. Music & Audio [3 commands]
│ 🎨 7. Media & Stickers [3 commands]
│ 🤖 8. AI & Correction [5 commands]
│ 🛠️ 9. Tools & Utilities [3 commands]
│ ⚙️ 10. Settings [3 commands]
│ ℹ️ 11. System & Help [4 commands]
└─────────────────────

💡 *Navigation Tips:*
• Type `.menu <category>` to view commands in a specific category (e.g. `.menu casino`).
• Type `.menu all` to view the complete command catalog.
• Type `.help <command>` for detailed syntax and parameters (e.g. `.help slot`).
```

### C. Category Command List (`.menu <category>`)

When the user types `.menu casino` or `.help casino`:

```text
╭───「 🎰 *CASINO COMMANDS* 」
│
│ ⭔ *.slot* <bet>
│   _Play the slot machine with coins_
│
│ ⭔ *.coinflip* <side> <bet>
│   _Flip a coin for double or nothing_
│
│ ⭔ *.dice* <1-6> <bet>
│   _Roll a 6-sided die against the house_
│
│ ⭔ *.balance*
│   _Check wallet, bank, and net worth_
│
│ ⭔ *.daily*
│   _Claim daily reward coins_
│
│ ⭔ *.transfer* <@user> <amount>
│   _Transfer coins to another user_
│
│ ⭔ *.vault*
│   _View house vault balance and jackpot_
│
│ ⭔ *.top*
│   _View chat leaderboard_
│
│ ⭔ *.topglobal*
│   _View global leaderboard_
│
╰───────────────────────────
💡 *Tip:* Type `.help <command>` to see detailed parameters and usage.
```

### D. Single Command Inspector (`.help <command>`)

When the user types `.help slot` or `.help bank`:

```text
╭───「 *COMMAND GUIDE: .slot* 」
│ 🏷️ *Command:* slot
│ 📁 *Category:* Casino
│ 📝 *Description:* Play the slot machine with coins.
│ 🔁 *Aliases:* .slot, .judi
│ 📌 *Usage:* .slot <bet_amount|all>
│ 💡 *Example:* .slot 50000 or .slot all
│ 🔒 *Permission:* Public
╰───────────────────────────
```

### E. All-In-One Full Menu (`.menu all`)

When the user types `.menu all`, it outputs a compact listing of all commands grouped by category with icons and bullet points, suitable for mobile screens without excessive scrolling.

---

## 5. Detailed Implementation Plan

### Phase 1: Media Asset Storage & Baileys Banner Subsystem
- [x] Create the root [`assets/`](file:///home/razael/cosmos/assets/) directory.
- [x] Download media banner from `https://files.catbox.moe/hygluw.png` and store it at [`assets/menu_banner.png`](file:///home/razael/cosmos/assets/menu_banner.png).
- [x] Provide a generated placeholder fallback ([`assets/menu_banner.placeholder.png`](file:///home/razael/cosmos/assets/menu_banner.placeholder.png)) to protect against corrupt or empty 0-byte remote files.
- [ ] Implement [`src/utils/menuAssets.ts`](file:///home/razael/cosmos/src/utils/menuAssets.ts) to safely read and cache the banner buffer.
- [ ] Configure `contextInfo.externalAdReply` with `renderLargerThumbnail: true` in [`src/tools/help.ts`](file:///home/razael/cosmos/src/tools/help.ts).

### Phase 2: Service Layer & Tool Reflection
- [ ] Create [`src/services/menuService.ts`](file:///home/razael/cosmos/src/services/menuService.ts):
  - Index all tools from [`toolsHandler.getAllTools()`](file:///home/razael/cosmos/src/tools/handler.ts).
  - Normalize command aliases (ensure every alias is prefixed with dot `.`).
  - Implement category consolidation mapping.
  - Expose helper methods:
    - `getCategoryList()`: Returns categories with command counts and assigned emoji.
    - `getCommandsByCategory(categoryName: string)`: Returns array of tools.
    - `findCommand(query: string)`: Searches by exact name, alias, or stripped dot.
    - `findCategory(query: string)`: Matches category with case-insensitive / substring search.
    - `getCatalogStats()`: Returns total command count and category count.

### Phase 3: Formatter & Aesthetic UI Engine
- [ ] Create [`src/utils/menuFormatter.ts`](file:///home/razael/cosmos/src/utils/menuFormatter.ts):
  - Implement `formatDashboardHeader(options: DashboardOptions)` with uptime, latency, pushname, role, and total commands.
  - Implement `formatCategoryOverview(categories, t, prefix)`.
  - Implement `formatCategoryCommands(category, tools, t, prefix)`.
  - Implement `formatAllCommands(groupedTools, t, prefix)`.
  - Implement `formatCommandDetail(tool, t, prefix)`.
  - Ensure all layout lines utilize Unicode box characters (`╭─`, `│`, `╰─`, `┌─`, `└─`, `⭔`) and markdown formatting (`*bold*`, `_italic_`).

### Phase 4: Tool Refactoring & Entrypoint Routing
- [ ] Refactor [`src/tools/help.ts`](file:///home/razael/cosmos/src/tools/help.ts):
  - Retain aliases `['.help', '.menu', '.bantuan']`.
  - Support arguments:
    - No argument or `all`: If triggered via `.menu`, show Category Overview (or full menu if `.menu all`). If `.help`, show help guide.
    - `<query>`: If `<query>` matches a command name or alias, render Command Inspector. If it matches a category name, render Category Command List. If no match, return a helpful suggestion with available categories.
  - Send message directly via `ctx.sock.sendMessage` with `contextInfo.externalAdReply` (`renderLargerThumbnail: true`) and return `undefined` to prevent message echo.
- [ ] Register [`src/tools/menu.ts`](file:///home/razael/cosmos/src/tools/menu.ts) pointing to the shared menu service for standalone command execution.

### Phase 5: Internationalization & Localization
- [ ] Update [`src/locales/en/tools.json`](file:///home/razael/cosmos/src/locales/en/tools.json):
  - Add keys under `tools.menu` and `tools.help`:
    - `dashboard_title`, `role_owner`, `role_member`, `speed`, `uptime`, `date`, `total_commands`.
    - `categories_header`, `category_hint`, `all_commands_hint`, `command_detail_hint`.
    - `command_not_found`, `category_not_found`.
    - `permission_owner`, `permission_public`.
    - `usage_label`, `example_label`, `aliases_label`.
- [ ] Update [`src/locales/id/tools.json`](file:///home/razael/cosmos/src/locales/id/tools.json) with symmetric Indonesian translations.
- [ ] Run `pnpm run validate:i18n` to verify parity.

### Phase 6: Testing & Quality Assurance
- [ ] Create unit tests in [`tests/menu.test.ts`](file:///home/razael/cosmos/tests/menu.test.ts):
  - Verify banner asset buffer loading and fallback mechanism.
  - Verify category aggregation and counts.
  - Verify command lookup by alias and by primary name.
  - Verify `.help <command>` returns parameter details.
  - Verify `.menu <category>` returns correct tool list.
  - Verify `.menu all` output contains all loaded tools.
  - Verify localization output in both English and Indonesian.
- [ ] Run verification pipeline:
  - `pnpm typecheck`
  - `pnpm lint`
  - `pnpm format`
  - `pnpm build`

---

## 6. Acceptance Criteria

- [ ] **Banner Media Asset in `assets/` Folder**: Media file is placed in [`assets/menu_banner.png`](file:///home/razael/cosmos/assets/menu_banner.png) (downloaded from `https://files.catbox.moe/hygluw.png`), with an automated fallback if the remote file is empty.
- [ ] **Baileys Hero Banner Attribute**: The command output is sent with `contextInfo.externalAdReply` using the specific Baileys attribute **`renderLargerThumbnail: true`** to render a full-width hero banner atop the menu text.
- [ ] **Clean Code & Separation of Concerns**: Logic is decoupled into [`src/services/menuService.ts`](file:///home/razael/cosmos/src/services/menuService.ts), [`src/utils/menuFormatter.ts`](file:///home/razael/cosmos/src/utils/menuFormatter.ts), and [`src/utils/menuAssets.ts`](file:///home/razael/cosmos/src/utils/menuAssets.ts); [`src/tools/help.ts`](file:///home/razael/cosmos/src/tools/help.ts) acts purely as an orchestrator.
- [ ] **WhatsApp Bot Visual Styling**: Menu displays a professional bot header card with runtime statistics (pushname, uptime, latency, commands count, prefix) and structured Unicode box borders.
- [ ] **Dual Inspection Mode**: Typing `.help <command>` inspects specific command usage, while `.help <category>` or `.menu <category>` lists commands for that category.
- [ ] **All-in-One Catalog Support**: Typing `.menu all` renders the complete organized command catalog.
- [ ] **Consistent Prefixing**: All displayed commands and aliases uniformly start with the dot prefix (`.`).
- [ ] **Bilingual Localization**: English and Indonesian locales are 100% symmetric and validated with zero missing keys.
- [ ] **Zero Regressions**: Passes ESLint, TypeScript typecheck, and all automated unit tests.
