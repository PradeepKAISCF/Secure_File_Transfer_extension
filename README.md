# VajraShare (V1.0) - Secure File Transfer

A secure, zero-knowledge file transfer extension with **Hybrid Cloud & Intranet Support**.

## Features
- **Public Cloud Mode**: Works instantly using PythonAnywhere.
- **Intranet Mode**: Configure your own local server URL for internal networks.
- **Backup Vault**: Encrypted Private Keys are backed up, allowing you to restore your identity on new devices.
- **Hybrid Encryption**: RSA-4096 (Key Exchange) + AES-256-GCM (File Encryption).

## Quick Start (Public Cloud)
1.  **Load Extension**: Load the `extension/` folder in Chrome.
2.  **Initialize**: Choose a handle and password.
3.  **Use**: Send files to anyone else who has initialized.

## Intranet Setup (Private Network)
If you want to run your own server:
1.  **Start Server**: Run `python server/app.py` on your machine.
    *   Find your IP: `ipconfig` (e.g., `192.168.1.50`).
2.  **Configure Extension**:
    *   Click the **Gear Icon (⚙️)** in the extension header.
    *   Select **Server Mode: Intranet / Localhost**.
    *   Enter URL: `http://192.168.1.50:5000`.
    *   Click **Save & Reload**.

## Security Model
*   **Zero Knowledge**: The server never sees your password or raw private key.
*   **Encrypted Sync**: Your keys are synced to the server as encrypted blobs (`.priv` files). This allows you to recover your account if you clear your browser cache, provided you remember your password.
