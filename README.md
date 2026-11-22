# WhatsApp Automation for eKart

A simple WhatsApp Web automation server built with [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js).

## Features

- **QR Code auth** — scan the QR printed in the terminal to link your WhatsApp account.
- **Persistent sessions** — auth is stored in `.wwebjs_auth/` so you don't re-scan after restarts.
- **Single-number security** — only messages from the configured `ALLOWED_NUMBER` are processed; everything else is silently ignored.
- **Clean architecture** — separated into small modules for easy extension.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure the allowed sender
#    Copy .env.example → .env and set your number
cp .env.example .env        # then edit ALLOWED_NUMBER

# 3. Start the server
npm start                    # or: npm run dev (auto-restart on changes)
```

On first run a QR code appears in the terminal — scan it with WhatsApp → Linked Devices.

## Project Structure

```
src/
├── index.js        # Entry point — boots the client
├── client.js       # Client creation + event wiring
├── automation.js   # Message gate-keeper + command router
├── config.js       # Loads .env into a typed config object
└── logger.js       # Minimal structured logger
```

## Extending

Add your automation handlers inside `automation.js → processCommand()`.
For larger flows, create handler files in `src/handlers/` and import them.
