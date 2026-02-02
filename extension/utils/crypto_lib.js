export const cryptoLib = {
    // --- Constants ---
    RSA_ALGORITHM: {
        name: "RSA-OAEP",
        modulusLength: 4096,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256"
    },
    AES_ALGORITHM: "AES-GCM",
    PBKDF2_ITERATIONS: 100000,

    // --- Utils ---
    arrayBufferToBase64: (buffer) => {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return window.btoa(binary);
    },

    base64ToArrayBuffer: (base64) => {
        const binary_string = window.atob(base64);
        const len = binary_string.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binary_string.charCodeAt(i);
        }
        return bytes.buffer;
    },

    // --- Key Generation ---
    generateKeyPair: async () => {
        return await window.crypto.subtle.generateKey(
            cryptoLib.RSA_ALGORITHM,
            true,
            ["encrypt", "decrypt"]
        );
    },

    exportPublicKey: async (key) => {
        const exported = await window.crypto.subtle.exportKey("spki", key);
        return cryptoLib.arrayBufferToBase64(exported);
    },

    importPublicKey: async (base64Key) => {
        const buffer = cryptoLib.base64ToArrayBuffer(base64Key);
        return await window.crypto.subtle.importKey(
            "spki",
            buffer,
            cryptoLib.RSA_ALGORITHM,
            true,
            ["encrypt"]
        );
    },

    // --- Private Key Management (Password Protection) ---
    deriveKeyFromPassword: async (password, salt) => {
        const enc = new TextEncoder();
        const keyMaterial = await window.crypto.subtle.importKey(
            "raw",
            enc.encode(password),
            "PBKDF2",
            false,
            ["deriveKey"]
        );
        return await window.crypto.subtle.deriveKey(
            {
                name: "PBKDF2",
                salt: salt,
                iterations: cryptoLib.PBKDF2_ITERATIONS,
                hash: "SHA-256"
            },
            keyMaterial,
            { name: "AES-GCM", length: 256 },
            false,
            ["encrypt", "decrypt"]
        );
    },

    encryptPrivateKey: async (privateKey, password) => {
        const salt = window.crypto.getRandomValues(new Uint8Array(16));
        const wrappingKey = await cryptoLib.deriveKeyFromPassword(password, salt);
        const generatedIV = window.crypto.getRandomValues(new Uint8Array(12));

        // Export private key to PKCS#8
        const keyData = await window.crypto.subtle.exportKey("pkcs8", privateKey);

        const encryptedKey = await window.crypto.subtle.encrypt(
            { name: "AES-GCM", iv: generatedIV },
            wrappingKey,
            keyData
        );

        return {
            salt: cryptoLib.arrayBufferToBase64(salt),
            iv: cryptoLib.arrayBufferToBase64(generatedIV),
            encryptedData: cryptoLib.arrayBufferToBase64(encryptedKey)
        };
    },

    decryptPrivateKey: async (wrapper, password) => {
        const salt = cryptoLib.base64ToArrayBuffer(wrapper.salt);
        const iv = cryptoLib.base64ToArrayBuffer(wrapper.iv);
        const encryptedData = cryptoLib.base64ToArrayBuffer(wrapper.encryptedData);

        const wrappingKey = await cryptoLib.deriveKeyFromPassword(password, salt);

        try {
            const keyData = await window.crypto.subtle.decrypt(
                { name: "AES-GCM", iv: iv },
                wrappingKey,
                encryptedData
            );

            return await window.crypto.subtle.importKey(
                "pkcs8",
                keyData,
                cryptoLib.RSA_ALGORITHM,
                true,
                ["decrypt"]
            );
        } catch (e) {
            throw new Error("Incorrect password or corrupted key.");
        }
    },

    // --- File Encryption (Hybrid) ---
    encryptFile: async (file, recipientPublicKeyBase64, onProgress) => {
        // 1. Generate AES-256-GCM transaction key
        const uniqueKey = await window.crypto.subtle.generateKey(
            { name: "AES-GCM", length: 256 },
            true,
            ["encrypt", "decrypt"]
        );

        // 2. Encrypt File Data with Transaction Key
        const iv = window.crypto.getRandomValues(new Uint8Array(12));
        const fileBuffer = await file.arrayBuffer(); // Read into memory (Careful with large files)

        // Progress simulation (since SubtleCrypto is all-or-nothing for a single call)
        // For real progress on large files, we'd need Chunking.
        // Here we just notify start.
        if (onProgress) onProgress(10);

        const encryptedContent = await window.crypto.subtle.encrypt(
            { name: "AES-GCM", iv: iv },
            uniqueKey,
            fileBuffer
        );

        if (onProgress) onProgress(90);

        // 3. Encrypt Transaction Key with Recipient's Public Key
        const recipientKey = await cryptoLib.importPublicKey(recipientPublicKeyBase64);
        const rawUniqueKey = await window.crypto.subtle.exportKey("raw", uniqueKey);

        const encryptedUniqueKey = await window.crypto.subtle.encrypt(
            { name: "RSA-OAEP" },
            recipientKey,
            rawUniqueKey
        );

        if (onProgress) onProgress(100);

        return {
            fileName: file.name,
            fileType: file.type,
            iv: cryptoLib.arrayBufferToBase64(iv),
            encryptedKey: cryptoLib.arrayBufferToBase64(encryptedUniqueKey),
            fileData: cryptoLib.arrayBufferToBase64(encryptedContent) // This is huge. Blob usually better but handled in BG/Storage?
        };
    },

    decryptFile: async (packageData, privateKey) => {
        // 1. Decrypt Transaction Key
        const encryptedKey = cryptoLib.base64ToArrayBuffer(packageData.encryptedKey);
        const rawUniqueKey = await window.crypto.subtle.decrypt(
            { name: "RSA-OAEP" },
            privateKey,
            encryptedKey
        );

        const uniqueKey = await window.crypto.subtle.importKey(
            "raw",
            rawUniqueKey,
            { name: "AES-GCM", length: 256 },
            false,
            ["decrypt"]
        );

        // 2. Decrypt Content
        const iv = cryptoLib.base64ToArrayBuffer(packageData.iv);
        const encryptedContent = cryptoLib.base64ToArrayBuffer(packageData.fileData);

        const decryptedBuffer = await window.crypto.subtle.decrypt(
            { name: "AES-GCM", iv: iv },
            uniqueKey,
            encryptedContent
        );

        return new Blob([decryptedBuffer], { type: packageData.fileType });
    }
};
