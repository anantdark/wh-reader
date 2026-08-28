# WhatsApp Chat Reader

<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License">
  <img src="https://img.shields.io/github/deployments/anantdark/wh-reader/github-pages" alt="GitHub Pages">
  <img src="https://img.shields.io/badge/platform-web-blue" alt="Platform">
</p>

> Read exported WhatsApp chats in a beautiful, familiar interface — right in your browser. Nothing leaves your device.

![WhatsApp Chat Reader Interface](https://user-images.githubusercontent.com/66427020/placeholder-preview.png)

## Why This Exists

You exported your WhatsApp chats for backup or to keep the memories safe. But opening a raw `.txt` file isn't exactly a great experience. This tool lets you read those exports in an interface that feels just like WhatsApp — complete with conversations, search, and that clean aesthetic you know.

## Features

- 💬 **WhatsApp-style interface** — Feels just like the real app
- 🔍 **Powerful search** — Find messages across all chats or within a specific conversation
- 🌙 **Dark & Light themes** — Switch between modes instantly
- ⭐ **Favorites** — Star important chats for quick access
- 📊 **Chat stats** — See message counts, busiest days, and more
- 🔒 **100% private** — All processing happens in your browser. Your chats never leave your device.

## How to Use

1. **Export a chat from WhatsApp:**
   - Open the chat → Tap the name → **Export chat** → **Without media**

2. **Open the exported file:**
   - Drag & drop the `.txt` file anywhere on the page, or
   - Click the folder icon to browse

3. **That's it!** Your chat loads instantly.

## Live Demo

🔗 **[https://anantdark.github.io/wh-reader](https://anantdark.github.io/wh-reader)**

## Supported Formats

- iOS exports (12-hour and 24-hour timestamps)
- Android exports (12-hour and 24-hour timestamps)
- Group and individual chats
- Multi-chat support — load several exports at once

## Tech Stack

- **Vanilla JavaScript** — No frameworks, no build step
- **CSS Variables** — Theming made simple
- **FileReader API** — Client-side file processing

## Running Locally

```bash
# Clone the repo
git clone https://github.com/anantdark/wh-reader.git
cd wh-reader

# Open in browser
open index.html
# or
python3 -m http.server 8000
```

Then visit `http://localhost:8000`

## Privacy First

This tool runs entirely in your browser. No data is sent to any server — not even for "analytics" or "improvements." Your conversations stay on your device, period.

## License

MIT — do whatever you want with it.

---

<p align="center">Made with ❤️ for preserving conversations</p>