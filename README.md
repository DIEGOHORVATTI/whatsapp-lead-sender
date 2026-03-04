# WA Sender Pro

Free & open-source Chrome Extension for WhatsApp Web bulk messaging campaigns. No server needed — runs entirely in your browser.

## Features

### Campaign Management
- Create, edit, duplicate, and delete campaigns
- Campaign progress tracking with real-time stats (sent, failed, pending)
- Pause, resume, and stop campaigns mid-execution
- Campaign history with full results stored locally (IndexedDB)
- Export campaign results to CSV

### Smart Messaging
- Template variables with dynamic replacement (`{nome}`, `{cidade}`, `{decisor}`, `{segmento}`, etc.)
- Multiple messages per contact (sent sequentially with natural delays)
- A/B testing — up to 4 message variants per campaign with performance comparison
- AI-powered message generation (Claude / OpenAI) with custom prompts
- Dry-run preview before sending

### Contact Management
- CSV import with flexible column mapping
- Phone deduplication on import
- Contact database with search and filters (name, segment, city, decision-maker)
- Select contacts from saved database or paste numbers directly
- Automatic phone fallback (tries `telefone_2` if primary fails)
- Country code prefix auto-detection

### Anti-Ban Protection
- Randomized delays between messages (simulates human behavior)
- Configurable safety levels: Safe, Moderate, Aggressive
- Daily sending limits with auto-pause
- Business hours scheduling (configurable days and hours)
- Batch sending with optional manual resume between batches

### Internationalization
- Multi-language support: Portugues, English, Espanol
- Auto-detects browser language
- Persistent language preference

### Technical
- Chrome Extension Manifest V3
- Side Panel UI (no popup clutter)
- Built with React + TypeScript + TailwindCSS
- Uses [@wppconnect/wa-js](https://github.com/wppconnect-team/wa-js) for WhatsApp Web integration
- All data stored locally — no external servers, no data collection
- Lightweight build with Vite

## Installation

Install from the [Chrome Web Store](https://chrome.google.com/webstore/detail/wtf/kcdlihaidnmkenhlnofkjfoachidbnif) or build from source.

## Building from Source

```bash
git clone https://github.com/marcosvrs/wtf.git
cd wtf
bun install
bun run build
```

Then load the `dist` folder as an unpacked extension in `chrome://extensions` (Developer Mode).

## Disclaimer

This extension is not affiliated with WhatsApp or Meta Platforms, Inc. Use at your own risk — the developers are not responsible for any misuse or consequences. Intended for legitimate and ethical use only.
