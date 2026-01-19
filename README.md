# VajraShare - Secure Intranet File Transfer

A secure, zero-knowledge file transfer system built with a **Vanilla JS Chrome Extension** and a **Python Flask Relay Server**.

## Project Structure

```
cs-ce/
├── extension/           # Client-side Chrome Extension
│   ├── background/      # Service Worker (crypto calls)
│   ├── utils/           # Crypto & API Logic
│   ├── popup.html       # UI Layout
│   ├── popup.js         # UI Logic (Vanilla JS)
│   ├── style.css        # Cybersecurity Theme
│   └── manifest.json    # Extension Config
└── server/              # Server-side Relay
    ├── app.py           # Flask Backend
    └── data/            # Storage for files & keys
```

## How to Run

### 1. Start the Server
1. Open a terminal in the `server` folder.
2. Install dependencies: `pip install flask flask-cors`
3. Run: `python app.py`
   * Runs on port 5000 by default.

### 2. Install the Extension
1. Open Chrome and go to `chrome://extensions`.
2. Enable **Developer Mode**.
3. Click **Load Unpacked**.
4. Select the `extension` folder.

## Features
- **Hybrid Encryption**: RSA-4096 (Key Exchange) + AES-256-GCM (File Encryption).
- **Zero Knowledge**: Private keys are encrypted with your password. The server never sees them.
- **Intranet Ready**: Works across LAN if you update `extension/utils/api_client.js` with the Server IP.
