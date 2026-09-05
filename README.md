# 🚀 Cosmos - WhatsApp Bot Framework

**Cosmos** is a modern, enterprise-grade WhatsApp Bot framework built with **TypeScript**, **@whiskeysockets/baileys v7**, **Groq AI SDK**, and **Prisma ORM (SQLite)**.

---

## 🌟 Key Features

- ⚡ **TypeScript & ESM Native:** Written in strict TypeScript with ES Modules (`type: "module"`).
- 🗄️ **Local Prisma Database:** Session keys, configuration, auto-delete queues, and history are stored efficiently using Prisma ORM with SQLite, ensuring self-contained offline capability and fast I/O.
- 📥 **Advanced Auto Downloader:** Automatically detects and downloads media from TikTok, YouTube, Instagram (including carousels), Twitter/X, Facebook, Threads, and Pinterest with a powerful queueing and concurrency limiter.
- 🕒 **Auto-Delete Memory:** Downloads self-destruct locally and remove triggers gracefully (via Prisma-persisted queues) to preserve chat cleanliness and respect admin privileges.
- 🤖 **Groq AI & Native Function Calling:** Native integration with Groq LLMs and Whisper Speech-to-Text.
- 🎰 **Casino & Economy System:** Built-in virtual economy with games (dice, slot, coinflip), daily rewards, transfers, and real-time global/group leaderboards.
- 🎨 **Media & Sticker Processing:** High-performance image and video sticker rendering via `sharp` & `ffmpeg-static`.
- 🔄 **Daemon & Systemd Support:** Background process management with Systemd service (`waf-bot.service`) and standalone daemon scripts without unwanted auto-restarts.

---

## 🛠️ Tech Stack

| Component                    | Technology                                    |
| :--------------------------- | :-------------------------------------------- |
| **Package Manager**          | [PNPM](https://pnpm.io/) (`pnpm-lock.yaml`)   |
| **Language**                 | TypeScript / Node.js ES Modules               |
| **WhatsApp Engine**          | `@whiskeysockets/baileys` (v7+)               |
| **Database**                 | Prisma ORM (`@prisma/client` + SQLite)        |
| **AI STT & LLM**             | Groq SDK (`groq-sdk`)                         |
| **Image & Video Processing** | `sharp`, `@img/sharp-wasm32`, `ffmpeg-static` |
| **Media Extraction**         | `yt-dlp`, APIs                                |
| **Logging**                  | `pino`                                        |

---

## 📋 Prerequisites

- **Node.js** `>= 20.x` (Tested on Node `v24.x`)
- **PNPM** `>= 8.x` (_Do NOT use `npm` or `yarn`_)
- **Groq API Key**
- **FFmpeg & yt-dlp** (For some media extraction features, though statics are bundled)

---

## 🗄️ Database Setup (Prisma)

Before starting the bot, initialize the SQLite database using Prisma:

```bash
pnpm prisma db push
pnpm prisma generate
```

---

## 🚀 Quick Start & Installation

### 1. Clone & Install Dependencies

```bash
git clone git@github.com:razaelmahasaputra/cosmos.git
cd cosmos
pnpm install
```

### 2. Environment Configuration

Create a `.env` file in the root directory:

```env
BOT_PHONE_NUMBER="your-bot-number"
GROQ_API_KEY="your-groq-api-key"
```

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
cosmos/
├── src/
│   ├── index.ts                  # Application entry point
│   ├── db.ts                     # Prisma database client
│   ├── logger.ts                 # Logging utility
│   ├── handlers/                 # Message & event handlers
│   ├── tools/                    # Bot commands (Downloaders, AI tools)
│   └── utils/
│       ├── prismaAuthState.ts    # Baileys auth state handler for Prisma
│       ├── autodl.ts             # Auto-downloader URL interceptor & queue
│       ├── autoDelete.ts         # Persistent DB-backed media cleanup service
│       └── messageCache.ts       # Message caching
├── prisma/
│   └── schema.prisma             # SQLite schema for Auth, Config, Deletions
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
