// Configuration
const DEFAULT_SERVER_URL = "https://pradeepkaiscf.pythonanywhere.com";

// Helper to get active URL
const getUrl = async () => {
    const data = await chrome.storage.local.get(['customServerUrl']);
    let url = data.customServerUrl || DEFAULT_SERVER_URL;
    // Remove trailing slash if present
    return url.replace(/\/$/, "");
};

export const mockServer = {
    // INTERNAL CLIENT

    registerUser: async (handle, publicKey, privateKeyEncrypted) => {
        const SERVER_URL = await getUrl();
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
        const SERVER_URL = await getUrl();
        try {
            const res = await fetch(`${SERVER_URL}/key/${handle}`);
            if (res.status === 404) return null;
            const data = await res.json();
            return data.publicKey;
        } catch (e) {
            console.warn("Key fetch failed:", e);
            return null;
        }
    },

    fetchEncryptedPrivateKey: async (handle) => {
        const SERVER_URL = await getUrl();
        try {
            const res = await fetch(`${SERVER_URL}/login/${handle}`);
            if (!res.ok) return null;
            return await res.json();
        } catch (e) {
            return null;
        }
    },

    uploadFile: async (filePackage, senderHandle, recipientHandle) => {
        const SERVER_URL = await getUrl();
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
        return data.id;
    },

    fetchFiles: async (recipientHandle) => {
        const SERVER_URL = await getUrl();
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
        const SERVER_URL = await getUrl();
        const res = await fetch(`${SERVER_URL}/file/${fileId}`);
        if (!res.ok) throw new Error("File Missing");
        return await res.json();
    }
};
