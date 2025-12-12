const CryptoUtils = {
    // 1. Generate RSA-OAEP Key Pair for Key Exchange
    generateKeyPair: async () => {
        return await window.crypto.subtle.generateKey(
            {
                name: "RSA-OAEP",
                modulusLength: 2048,
                publicExponent: new Uint8Array([1, 0, 1]),
                hash: "SHA-256"
            },
            true,
            ["encrypt", "decrypt"]
        );
    },

    // 2. Export Key to format suitable for storage/transfer (SPKI/PKCS8)
    exportKey: async (key, type = 'spki') => {
        const exported = await window.crypto.subtle.exportKey(type, key);
        return CryptoUtils.arrayBufferToBase64(exported);
    },

    // 3. Import Key from storage
    importKey: async (base64Key, type, userKeyType) => {
        const binaryDer = CryptoUtils.base64ToArrayBuffer(base64Key);
        return await window.crypto.subtle.importKey(
            type,
            binaryDer,
            {
                name: "RSA-OAEP",
                hash: "SHA-256"
            },
            true,
            [userKeyType] // 'encrypt' for public, 'decrypt' for private
        );
    },

    // 4. Encrypt File (Hybrid: AES-GCM + RSA-OAEP)
    encryptFile: async (fileArrayBuffer, recipientPublicKey) => {
        // A. Generate ephemeral AES Key
        const aesKey = await window.crypto.subtle.generateKey(
            { name: "AES-GCM", length: 256 },
            true,
            ["encrypt", "decrypt"]
        );

        // B. Encrypt the file content with AES
        const iv = window.crypto.getRandomValues(new Uint8Array(12));
        const encryptedContent = await window.crypto.subtle.encrypt(
            { name: "AES-GCM", iv: iv },
            aesKey,
            fileArrayBuffer
        );

        // C. Encrypt the AES Key with Recipient's RSA Public Key
        const exportedAesKey = await window.crypto.subtle.exportKey("raw", aesKey);
        const encryptedAesKey = await window.crypto.subtle.encrypt(
            { name: "RSA-OAEP" },
            recipientPublicKey,
            exportedAesKey
        );

        // D. Pack: [KeyLen(4)] + [EncKey] + [IV(12)] + [EncContent]
        const keyLen = encryptedAesKey.byteLength;
        const totalLen = 4 + keyLen + 12 + encryptedContent.byteLength;
        const resultBuffer = new Uint8Array(totalLen);

        const view = new DataView(resultBuffer.buffer);
        view.setUint32(0, keyLen, true); // Little Endian

        resultBuffer.set(new Uint8Array(encryptedAesKey), 4);
        resultBuffer.set(iv, 4 + keyLen);
        resultBuffer.set(new Uint8Array(encryptedContent), 4 + keyLen + 12);

        return resultBuffer.buffer;
    },

    // 5. Decrypt File
    decryptFile: async (packedBuffer, privateKey) => {
        const view = new DataView(packedBuffer);
        const keyLen = view.getUint32(0, true);

        // Extract parts
        const encryptedAesKey = packedBuffer.slice(4, 4 + keyLen);
        const iv = new Uint8Array(packedBuffer.slice(4 + keyLen, 4 + keyLen + 12));
        const encryptedContent = packedBuffer.slice(4 + keyLen + 12);

        // A. Decrypt AES Key using RSA Private Key
        const aesKeyRaw = await window.crypto.subtle.decrypt(
            { name: "RSA-OAEP" },
            privateKey,
            encryptedAesKey
        );

        // B. Import the AES Key
        const aesKey = await window.crypto.subtle.importKey(
            "raw",
            aesKeyRaw,
            { name: "AES-GCM" },
            true,
            ["decrypt"]
        );

        // C. Decrypt Content
        const decryptedContent = await window.crypto.subtle.decrypt(
            { name: "AES-GCM", iv: iv },
            aesKey,
            encryptedContent
        );

        return decryptedContent;
    },

    // Helpers
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
    }
};
