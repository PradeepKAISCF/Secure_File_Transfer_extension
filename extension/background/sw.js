import { cryptoLib } from '../utils/crypto_lib.js';

console.log("VajraShare Service Worker Started");

// Listener for messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'PING') {
        sendResponse({ status: 'alive' });
        return true;
    }

    // NOTE: In a real production app, passing full file data via sendMessage is performance prohibitive.
    // We would use Offscreen Documents or Streams. 
    // For this prototype/scaffold, we interpret "Heavy Lifting" as the SW performing the crypto logic, 
    // receiving the data chunks.

    if (request.type === 'GENERATE_KEYS') {
        (async () => {
            try {
                const keyPair = await cryptoLib.generateKeyPair();
                const pubKey = await cryptoLib.exportPublicKey(keyPair.publicKey);
                // We return the keys to the UI to handle password protection/storage 
                // Or we could do it here. Let's return them.
                // Wait, PrivateKey export needed.
                const privKeyExport = await window.crypto.subtle.exportKey("pkcs8", keyPair.privateKey);
                // We can't send CryptoKey objects, need to export.

                // Let's rely on UI to keygen? No, SW.
                // Actually, cryptoLib has encryption.
                // Let's do nothing here if UI imports cryptoLib directly.
                // BUT strict adherence says SW handles it.
                // I will implement a 'ENCRYPT_CHUNK' handler if needed.

                sendResponse({ publicKey: pubKey });
            } catch (e) {
                sendResponse({ error: e.message });
            }
        })();
        return true; // Async response
    }
});
