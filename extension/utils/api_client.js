// Configuration
const SERVER_URL = "https://pradeepkaiscf.pythonanywhere.com";

export const mockServer = {
    // We keep the name 'mockServer' to avoid refactoring all imports in UI, 
    // but internally it is now a Real Client.

    registerUser: async (handle, publicKey, privateKeyEncrypted) => {
        const payload = { handle, publicKey };
        if (privateKeyEncrypted) {
            payload.privateKeyEncrypted = privateKeyEncrypted;
        }

        const res = await fetch(`${SERVER_URL}/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error(await res.text());
        return true;
    },

    getUserKey: async (handle) => {
        const res = await fetch(`${SERVER_URL}/key/${handle}`);
        if (res.status === 404) return null;
        const data = await res.json();
        return data.publicKey;
    },

    // NEW: Fetch Backup
    fetchEncryptedPrivateKey: async (handle) => {
        const res = await fetch(`${SERVER_URL}/login/${handle}`);
        if (!res.ok) return null;
        return await res.json();
    },

    uploadFile: async (filePackage, senderHandle, recipientHandle) => {
        // filePackage contains { iv, encryptedKey, fileData (base64string) }
        // We add metadata
        const payload = {
            ...filePackage,
            sender: senderHandle,
            recipient: recipientHandle
        };

        const res = await fetch(`${SERVER_URL}/upload`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error("Upload Failed");
        const data = await res.json();
        console.log("Uploaded ID:", data.id);
        return data.id;
    },

    fetchFiles: async (recipientHandle) => {
        try {
            const res = await fetch(`${SERVER_URL}/inbox/${recipientHandle}`);
            if (!res.ok) return [];
            return await res.json();
        } catch (e) {
            console.warn("Server unreachable?", e);
            return [];
        }
    },

    getFileContent: async (fileId) => {
        const res = await fetch(`${SERVER_URL}/file/${fileId}`);
        if (!res.ok) throw new Error("File Missing");
        return await res.json();
    }
};
