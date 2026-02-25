export const storage = {
    get: async (keys) => {
        if (typeof chrome !== 'undefined' && chrome.storage) {
            return await chrome.storage.local.get(keys);
        }
        const res = {};
        for (const key of keys) {
            const val = localStorage.getItem(key);
            res[key] = val ? JSON.parse(val) : undefined;
        }
        return res;
    },
    set: async (data) => {
        if (typeof chrome !== 'undefined' && chrome.storage) {
            return await chrome.storage.local.set(data);
        }
        for (const [key, val] of Object.entries(data)) {
            localStorage.setItem(key, JSON.stringify(val));
        }
    },
    remove: async (key) => {
        if (typeof chrome !== 'undefined' && chrome.storage) {
            return await chrome.storage.local.remove(key);
        }
        localStorage.removeItem(key);
    }
};
