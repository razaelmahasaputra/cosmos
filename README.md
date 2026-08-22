# 🚀 WAF - WhatsApp Bot Framework

**WAF (WhatsApp Bot Framework)** is a modern, enterprise-grade WhatsApp Bot framework built with **TypeScript**, **@whiskeysockets/baileys v7**, **Groq AI SDK**, and **Supabase Cloud Backend**.

---

## 🌟 Key Features

- ⚡ **TypeScript & ESM Native:** Written in strict TypeScript with ES Modules (`type: "module"`).
- ☁️ **Supabase Cloud Authentication State:** Session keys & pairing tokens are stored in Supabase PostgreSQL (`whatsapp_auth` table), ensuring zero session loss across restarts or server redeployments.
- 🤖 **Groq AI & Native Function Calling:** Native integration with Groq LLMs and Whisper Speech-to-Text.
- 🎨 **Media & Sticker Processing:** High-performance image and video sticker rendering via `sharp` & `ffmpeg-static`.
- 🔄 **Daemon & Systemd Support:** Background process management with Systemd service (`waf-bot.service`) and standalone daemon scripts without unwanted auto-restarts.

---

## 🛠️ Tech Stack

| Component                    | Technology                                    |
| :--------------------------- | :-------------------------------------------- |
| **Package Manager**          | [PNPM](https://pnpm.io/) (`pnpm-lock.yaml`)   |
| **Language**                 | TypeScript / Node.js ES Modules               |
| **WhatsApp Engine**          | `@whiskeysockets/baileys` (v7+)               |
| **Cloud Database**           | Supabase (`@supabase/supabase-js`)            |
| **AI STT & LLM**             | Groq SDK (`groq-sdk`)                         |
| **Image & Video Processing** | `sharp`, `@img/sharp-wasm32`, `ffmpeg-static` |
| **Logging**                  | `pino`                                        |

---

## 📋 Prerequisites

- **Node.js** `>= 20.x` (Tested on Node `v24.x`)
- **PNPM** `>= 8.x` (_Do NOT use `npm` or `yarn`_)
- **Supabase Account** with a active project
- **Groq API Key**

---

## 🗄️ Database Setup (Supabase)

Before starting the bot, create the required database tables in your **Supabase Dashboard -> SQL Editor**:

```sql
-- 1. Table for storing Baileys WhatsApp Authentication Tokens
CREATE TABLE IF NOT EXISTS whatsapp_auth (
    id TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Table for storing Scheduled WhatsApp Status / Story Posts
CREATE TABLE IF NOT EXISTS scheduled_stories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_jid TEXT NOT NULL,
    media_type TEXT NOT NULL,
    content TEXT NOT NULL,
    caption TEXT,
    scheduled_at TIMESTAMPTZ NOT NULL,
    status TEXT DEFAULT 'pending',
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 🚀 Quick Start & Installation

### 1. Clone & Install Dependencies

```bash
git clone <repository-url>
cd waf
pnpm install
```

### 2. Environment Configuration

Create a `.env` file in the root directory with your Supabase bootstrap credentials:

```env
# Supabase Cloud Database Credentials
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="your-supabase-service-role-key"
```

> **Note:** Make sure you have your other configurations (`BOT_PHONE_NUMBER`, `GROQ_API_KEY`, etc.) set in your `.env` file or environment variables.

### 3. Build & Typecheck

```bash
pnpm typecheck
pnpm build
```

---

## ⚙️ Running the Bot

### 🔗 1. Pair your WhatsApp Account (Required)

Before starting the bot, you must pair your WhatsApp account to generate the authentication state. 
Run the pairing script and enter the pairing code in your WhatsApp app (Linked Devices > Pair a device):

```bash
pnpm pair
```

Once successfully connected, the script will exit and you can start the bot using one of the methods below.

### 🟢 2. Development Mode (Local Testing)

Runs the bot using `tsx`:

```bash
pnpm dev
```

### 🔵 3. Production Mode (Static Build)

Runs the compiled JavaScript build (`dist/index.js`):

```bash
pnpm build
pnpm start
```

### 🟣 4. Background Daemon Mode (No Auto-Restart)

Runs the bot in the background using `nohup` without restarting automatically when code changes:

```bash
# Start bot in background
pnpm start:bg   # or ./start.sh

# Check daemon status
pnpm status:bg  # or ./status.sh

# Stop background bot
pnpm stop:bg    # or ./stop.sh

# View live log output
tail -f bot_output.log
```

### 🐧 5. Linux Systemd Daemon Service

To run the bot as a system service on Linux (Ubuntu/Debian):

```bash
# Run the automated installer
./setup-systemd.sh

# Manage the service
sudo systemctl status waf-bot
sudo systemctl start waf-bot
sudo systemctl stop waf-bot
sudo systemctl restart waf-bot

# View realtime systemd log
sudo journalctl -u waf-bot -f
```

---

## 📁 Directory Structure

```text
waf/
├── src/
│   ├── index.ts                  # Application entry point
│   ├── db.ts                     # Supabase database client
│   ├── logger.ts                 # Logging utility
│   ├── handlers/                 # Message & event handlers
│   ├── tools/                    # Bot commands and tools
│   └── utils/
│       ├── supabaseAuthState.ts  # Baileys auth state handler for Supabase
│       ├── autoCorrection.ts     # AI message auto-correction
│       ├── autoSticker.ts        # Sticker generation utilities
│       └── messageCache.ts       # Message caching
├── dist/                         # Compiled JavaScript output (`pnpm build`)
├── .agents/skills/               # AI Agent skills and guidelines
├── start.sh                      # Daemon startup script
├── stop.sh                       # Daemon stop script
├── status.sh                     # Daemon status script
├── setup-systemd.sh              # Systemd service setup script
├── waf-bot.service               # Systemd service unit configuration
└── AGENTS.md                     # AI Agent guidelines & repo rules
```

---

## 📜 Available NPM Scripts

| Command          | Function                                             |
| :--------------- | :--------------------------------------------------- |
| `pnpm dev`       | Runs the bot in development mode using `tsx`         |
| `pnpm pair`      | Requests pairing code to link a new WhatsApp session |
| `pnpm build`     | Compiles TypeScript (`src/`) to JavaScript (`dist/`) |
| `pnpm start`     | Runs the production build (`dist/index.js`)          |
| `pnpm start:bg`  | Starts the bot as a background daemon process        |
| `pnpm status:bg` | Checks background daemon status                      |
| `pnpm stop:bg`   | Stops the background daemon process                  |
| `pnpm typecheck` | Checks TypeScript types without emitting output      |
| `pnpm lint`      | Runs ESLint code quality checks                      |
| `pnpm format`    | Formats codebase using Prettier                      |

---

## ⚖️ License

Distributed under the **ISC License**.
