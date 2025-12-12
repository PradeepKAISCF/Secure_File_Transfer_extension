const API_URL = "http://localhost:3000";

document.addEventListener('DOMContentLoaded', async () => {
    // UI Elements
    const elements = {
        tabs: document.querySelectorAll('.tab-btn'),
        contents: document.querySelectorAll('.tab-content'),
        status: document.getElementById('status'),
        registerView: document.getElementById('register-view'),
        profileView: document.getElementById('profile-view'),
        usernameInput: document.getElementById('username-input'),
        btnRegister: document.getElementById('btn-register'),
        displayUsername: document.getElementById('display-username'),
        displayPubkey: document.getElementById('display-pubkey'),
        recipientSelect: document.getElementById('recipient-select'),
        btnRefreshUsers: document.getElementById('btn-refresh-users'),
        fileInput: document.getElementById('file-input'),
        btnEncryptSend: document.getElementById('btn-encrypt-send'),
        sendLog: document.getElementById('send-log'),
        fileList: document.getElementById('file-list'),
        btnRefreshInbox: document.getElementById('btn-refresh-inbox')
    };

    // --- State ---
    let myKeys = null; // { publicKey, privateKey }
    let myUsername = null;

    // --- init ---
    await loadIdentity();
    checkServerStatus();

    // Tab Switching
    elements.tabs.forEach(btn => {
        btn.addEventListener('click', () => {
            elements.tabs.forEach(b => b.classList.remove('active'));
            elements.contents.forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.tab).classList.add('active');
        });
    });

    // --- Identity Logic ---
    async function loadIdentity() {
        const stored = await chrome.storage.local.get(['username', 'privateKey', 'publicKey']);
        if (stored.username && stored.privateKey && stored.publicKey) {
            myUsername = stored.username;
            // Import keys back to objects
            const privateKey = await CryptoUtils.importKey(stored.privateKey, 'pkcs8', 'decrypt');
            const publicKey = await CryptoUtils.importKey(stored.publicKey, 'spki', 'encrypt');
            myKeys = { privateKey, publicKey };

            showProfile(myUsername, stored.publicKey);
        } else {
            elements.registerView.classList.remove('hidden');
            elements.profileView.classList.add('hidden');
        }
    }

    elements.btnRegister.addEventListener('click', async () => {
        const username = elements.usernameInput.value.trim();
        if (!username) return alert("Enter a username");

        elements.btnRegister.innerText = "Generating...";

        try {
            // 1. Generate Keys
            const keyPair = await CryptoUtils.generateKeyPair();
            const exportedPub = await CryptoUtils.exportKey(keyPair.publicKey, 'spki');
            const exportedPriv = await CryptoUtils.exportKey(keyPair.privateKey, 'pkcs8');

            // 2. Register on Server
            const res = await fetch(`${API_URL}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, publicKey: exportedPub })
            });

            if (!res.ok) throw new Error(await res.text());

            // 3. Save Locally
            await chrome.storage.local.set({
                username: username,
                publicKey: exportedPub,
                privateKey: exportedPriv
            });

            await loadIdentity();
            alert("Registration Successful!");
        } catch (err) {
            alert("Error: " + err.message);
        } finally {
            elements.btnRegister.innerText = "Generate Keys & Register";
        }
    });

    function showProfile(username, pubKeyStr) {
        elements.registerView.classList.add('hidden');
        elements.profileView.classList.remove('hidden');
        elements.displayUsername.innerText = username;
        elements.displayPubkey.innerText = pubKeyStr.substring(0, 30) + "...";

        loadUsers(); // Refresh users list
    }

    // --- Send Logic ---
    async function loadUsers() {
        try {
            const res = await fetch(`${API_URL}/users`);
            const users = await res.json();
            elements.recipientSelect.innerHTML = '<option value="">Select User...</option>';
            users.forEach(u => {
                if (u.username === myUsername) return; // Don't send to self
                const opt = document.createElement('option');
                opt.value = u.publicKey; // Store key in value
                opt.innerText = u.username;
                elements.recipientSelect.appendChild(opt);
            });
        } catch (e) {
            console.error("Failed to load users", e);
        }
    }

    elements.btnRefreshUsers.addEventListener('click', loadUsers);

    elements.btnEncryptSend.addEventListener('click', async () => {
        const file = elements.fileInput.files[0];
        const recipientPubKeyStr = elements.recipientSelect.value;
        const recipientName = elements.recipientSelect.options[elements.recipientSelect.selectedIndex]?.text;

        if (!file || !recipientPubKeyStr) return alert("Select a file and recipient");

        try {
            log("Reading file...");
            const buffer = await file.arrayBuffer();

            log("Importing recipient key...");
            const recipientKey = await CryptoUtils.importKey(recipientPubKeyStr, 'spki', 'encrypt');

            log("Encrypting...");
            const encryptedBuffer = await CryptoUtils.encryptFile(buffer, recipientKey);

            log("Uploading...");
            const blob = new Blob([encryptedBuffer]);
            const formData = new FormData();
            formData.append('encryptedFile', blob, file.name + ".enc"); // Send as .enc
            formData.append('recipient', recipientName);

            const res = await fetch(`${API_URL}/upload`, {
                method: 'POST',
                body: formData
            });

            if (!res.ok) throw new Error("Upload failed");

            log("Sent Successfully!");
            setTimeout(() => elements.sendLog.innerText = "", 3000);
            elements.fileInput.value = "";
        } catch (err) {
            log("Error: " + err.message);
        }
    });

    function log(msg) {
        elements.sendLog.innerText = msg;
    }

    // --- Inbox Logic ---
    elements.btnRefreshInbox.addEventListener('click', loadInbox);
    // Auto load if logged in
    document.querySelector('[data-tab="inbox"]').addEventListener('click', loadInbox);

    async function loadInbox() {
        if (!myUsername) return;
        try {
            const res = await fetch(`${API_URL}/files/${myUsername}`);
            const files = await res.json();
            renderFiles(files);
        } catch (e) {
            console.error(e);
        }
    }

    function renderFiles(files) {
        elements.fileList.innerHTML = "";
        if (files.length === 0) {
            elements.fileList.innerHTML = '<p class="empty-msg">No files found.</p>';
            return;
        }

        files.forEach(file => {
            const div = document.createElement('div');
            div.className = 'file-item';
            div.innerHTML = `
                <div class="file-info">
                    <strong>${file.filename}</strong><br>
                    <small>${new Date(file.timestamp).toLocaleString()}</small>
                </div>
                <button class="secondary-btn">Decrypt</button>
            `;

            div.querySelector('button').addEventListener('click', () => downloadAndDecrypt(file));
            elements.fileList.appendChild(div);
        });
    }

    async function downloadAndDecrypt(fileMeta) {
        try {
            // 1. Download
            const res = await fetch(`${API_URL}/download/${fileMeta.id}`);
            if (!res.ok) throw new Error("Download failed");
            const encryptedBlob = await res.blob();
            const encryptedBuffer = await encryptedBlob.arrayBuffer();

            // 2. Decrypt
            if (!myKeys) throw new Error("Keys not loaded");
            const decryptedBuffer = await CryptoUtils.decryptFile(encryptedBuffer, myKeys.privateKey);

            // 3. Save to Disk
            // Remove .enc from filename if present
            let originalName = fileMeta.filename.replace(/\.enc$/, '');
            saveFile(decryptedBuffer, originalName);

        } catch (err) {
            alert("Decryption Failed: " + err.message);
        }
    }

    function saveFile(buffer, filename) {
        const blob = new Blob([buffer]);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // --- Helpers ---
    async function checkServerStatus() {
        try {
            await fetch(API_URL + '/users');
            elements.status.innerText = "● Online";
            elements.status.className = "status-online";
        } catch {
            elements.status.innerText = "● Offline";
            elements.status.className = "status-offline";
        }
    }
});
