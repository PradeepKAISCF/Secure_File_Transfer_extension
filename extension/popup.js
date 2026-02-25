import { cryptoLib } from './utils/crypto_lib.js';
import { mockServer } from './utils/api_client.js';
import { storage } from './utils/storage_adapter.js';

// --- State ---
let user = null;
let recipientKey = null;
let selectedFile = null;

// --- DOM Elements ---
const views = {
    loading: document.getElementById('view-loading'),
    register: document.getElementById('view-register'),
    dashboard: document.getElementById('view-dashboard'),
    config: document.getElementById('view-config') // Added Config View
    dashboard: document.getElementById('view-dashboard'),
    config: document.getElementById('view-config') // Added Config View
};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    setupConfig(); // Init Config Logic
    setupConfig(); // Init Config Logic
    await checkLogin();
    setupTabs();
    setupRegister();
    setupSend();

    // Register Service Worker for PWA
    if ('serviceWorker' in navigator && !window.chrome?.extension) {
        navigator.serviceWorker.register('./service-worker.js').catch(err => {
            console.warn('PWA Service Worker registration failed:', err);
        });
    }
});

async function checkLogin() {
    const data = await storage.get(['currentUser']);
    views.loading.classList.add('hidden');

    if (data.currentUser) {
        user = data.currentUser;
        showView('dashboard');
        initDashboard();
    } else {
        showView('register');
    }
}

function showView(name) {
    // Hide all main views but keep config separate
    const mainViews = ['loading', 'register', 'dashboard'];
    mainViews.forEach(v => views[v].classList.add('hidden'));

    if (name === 'config') {
        views.config.classList.remove('hidden');
    } else {
        views.config.classList.add('hidden');
        views[name].classList.remove('hidden');
    }
}

// --- Configuration Logic (V1.0 Feature) ---
function setupConfig() {
    const btnOpenReg = document.getElementById('btnOpenConfigReg');
    const btnOpenDash = document.getElementById('btnOpenConfigDash');
    const btnClose = document.getElementById('btnCloseConfig');
    const btnSave = document.getElementById('btnSaveConfig');

    const inputMode = document.getElementById('serverMode');
    const inputUrl = document.getElementById('customUrl');
    const customBox = document.getElementById('customUrlBox');

    // Load Saved Settings
    storage.get(['customServerUrl']).then((result) => {
        if (result.customServerUrl) {
            inputMode.value = 'custom';
            inputUrl.value = result.customServerUrl;
            customBox.classList.remove('hidden');
        } else {
            inputMode.value = 'cloud';
            customBox.classList.add('hidden');
        }
    });

    // Toggle Visibility
    const openConfig = () => views.config.classList.remove('hidden');
    const closeConfig = () => views.config.classList.add('hidden');

    btnOpenReg.onclick = openConfig;
    btnOpenDash.onclick = openConfig;
    btnClose.onclick = closeConfig;

    // Mode Switch
    inputMode.onchange = () => {
        if (inputMode.value === 'custom') {
            customBox.classList.remove('hidden');
        } else {
            customBox.classList.add('hidden');
        }
    };

    // Save Action
    btnSave.onclick = async () => {
        if (inputMode.value === 'custom') {
            let url = inputUrl.value.trim();
            if (!url) return alert("Please enter a valid URL");
            if (!url.startsWith('http')) return alert("URL must start with http:// or https://");

            await storage.set({ customServerUrl: url });
        } else {
            await storage.remove('customServerUrl');
        }

        alert("Settings Saved!");
        closeConfig();
    };

}

// --- Dashboard Logic ---
function initDashboard() {
    document.getElementById('userHandleDisplay').textContent = user.handle;
    renderIdenticon(user.handle, document.getElementById('userIdenticon'));

    document.getElementById('btnLogout').onclick = async () => {
        await storage.remove('currentUser');
        location.reload();
    };
}

function setupTabs() {
    const tabSend = document.getElementById('tabSend');
    const tabReceive = document.getElementById('tabReceive');
    const contentSend = document.getElementById('content-send');
    const contentReceive = document.getElementById('content-receive');

    tabSend.onclick = () => {
        tabSend.classList.add('active');
        tabReceive.classList.remove('active');
        contentSend.classList.remove('hidden');
        contentReceive.classList.add('hidden');
    };

    tabReceive.onclick = () => {
        tabReceive.classList.add('active');
        tabSend.classList.remove('active');
        contentReceive.classList.remove('hidden');
        contentSend.classList.add('hidden');
        loadFiles();
    };
}

// --- Registration / Restore Logic ---
function setupRegister() {

    document.getElementById('btnRegister').onclick = async () => {
        const handle = document.getElementById('regHandle').value;
        const pass = document.getElementById('regPass').value;
        const btn = document.getElementById('btnRegister');

        if (!handle || !pass) return alert("Fill all fields");

        btn.disabled = true;
        btn.textContent = "Processing...";

        try {
            // Check Server for existing identity
            let backupKey = await mockServer.fetchEncryptedPrivateKey(handle);

            if (backupKey) {
                // --- RESTORE IDENTITY FLOW ---
                btn.textContent = "Restoring Identity...";
                console.log("Found backup for", handle, "Attempting decrypt...");

                try {
                    // Try to decrypt with entered password
                    // We just test if it throws error
                    await cryptoLib.decryptPrivateKey(backupKey, pass);

                    // If we are here, Password is Correct!
                    const userData = { handle, privateKeyEncrypted: backupKey };
                    await storage.set({ currentUser: userData });
                    alert("Identity Restored Successfully!");
                    location.reload();
                    return;

                } catch (e) {
                    throw new Error("Incorrect Password for existing user.");
                }
            } else {
                // --- NEW REGISTRATION FLOW ---
                btn.textContent = "Generating Keys...";

                // Double check if handle exists (but no backup)
                const existingPubKey = await mockServer.getUserKey(handle);
                if (existingPubKey) {
                    throw new Error("Handle taken (and no backup found). Choose another.");
                }

                const keyPair = await cryptoLib.generateKeyPair();
                const pubKey = await cryptoLib.exportPublicKey(keyPair.publicKey);
                const privKeyWrap = await cryptoLib.encryptPrivateKey(keyPair.privateKey, pass);

                await mockServer.registerUser(handle, pubKey, privKeyWrap);

                const userData = { handle, privateKeyEncrypted: privKeyWrap };
                await storage.set({ currentUser: userData });

                location.reload();
            }

        } catch (e) {
            alert("Error: " + e.message);
            btn.disabled = false;
            btn.textContent = "Initialize Identity";
        }
    };
}

// --- Send Feature ---
function setupSend() {
    // Search
    document.getElementById('btnSearch').onclick = async () => {
        const handle = document.getElementById('searchHandle').value;
        recipientKey = null;
        document.getElementById('recipientBox').classList.add('hidden');

        try {
            const key = await mockServer.getUserKey(handle);
            if (key) {
                recipientKey = key;
                document.getElementById('recipientBox').classList.remove('hidden');
                document.getElementById('dropZone').classList.remove('hidden'); // Fix: Unhide File Input
                document.getElementById('dropZone').classList.remove('hidden'); // Fix: Unhide File Input
                renderIdenticon(handle, document.getElementById('recipientIdenticon'));
            } else {
                alert("User not found");
            }
        } catch (e) {
            console.error(e);
        }
    };

    // File Drop & Click
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const fileInfo = document.getElementById('fileInfo');
    const btnSend = document.getElementById('btnSend');

    dropZone.onclick = () => fileInput.click();

    fileInput.onchange = () => {
        if (fileInput.files[0]) handleFileSelection(fileInput.files[0]);
    };

    dropZone.ondragover = (e) => { e.preventDefault(); dropZone.style.borderColor = '#00ff41'; };
    dropZone.ondragleave = () => { dropZone.style.borderColor = '#444'; };
    dropZone.ondrop = (e) => {
        e.preventDefault();
        dropZone.style.borderColor = '#444';
        if (e.dataTransfer.files[0]) handleFileSelection(e.dataTransfer.files[0]);
    };

    function handleFileSelection(file) {
        selectedFile = file;
        fileInfo.innerHTML = `<strong>${file.name}</strong><br><small>${(file.size / 1024).toFixed(1)} KB</small>`;
        btnSend.classList.remove('hidden');
    }

    // Send Action
    btnSend.onclick = async () => {
        if (!selectedFile || !recipientKey) return;
        const recipientHandle = document.getElementById('searchHandle').value;

        btnSend.disabled = true;
        btnSend.textContent = "Encrypting...";

        try {
            const packageData = await cryptoLib.encryptFile(selectedFile, recipientKey);
            await mockServer.uploadFile(packageData, user.handle, recipientHandle);

            alert("File Sent Securely!");
            // Reset
            selectedFile = null;
            fileInfo.textContent = "Click or Drop File Here";
            btnSend.classList.add('hidden');
            btnSend.disabled = false;
            btnSend.textContent = "Encrypt & Send";
        } catch (e) {
            alert("Failed: " + e.message);
            btnSend.disabled = false;
        }
    };
}

// --- Receive Feature ---
async function loadFiles() {
    const list = document.getElementById('fileList');
    list.innerHTML = "Loading...";

    try {
        const files = await mockServer.fetchFiles(user.handle);
        list.innerHTML = "";

        if (files.length === 0) list.innerHTML = "<div class='text-dim'>No message found.</div>";

        files.forEach(file => {
            const div = document.createElement('div');
            div.className = 'file-item';
            div.innerHTML = `
                <div>
                    <div style="display:flex;align-items:center;gap:5px">
                        <strong>${file.sender}</strong>
                    </div>
                    <div class="text-xs" style="margin-top:4px">${file.fileName}</div>
                </div>
                <button class="btn-sm">Decrypt</button>
            `;

            // Render Identicon for sender
            const iconContainer = document.createElement('div');
            renderIdenticon(file.sender, iconContainer, 16);
            div.querySelector('strong').prepend(iconContainer);

            // Decrypt Action
            div.querySelector('button').onclick = () => handleDecrypt(file);

            list.appendChild(div);
        });
    } catch (e) {
        list.textContent = "Error loading files.";
    }
}

async function handleDecrypt(fileMeta) {
    const pass = prompt("Enter Password to unlock Private Key:");
    if (!pass) return;

    try {
        // Fetch Content if needed
        let fileItem = fileMeta;
        if (!fileItem.fileData && fileItem.id) {
            const fullData = await mockServer.getFileContent(fileItem.id);
            fileItem = { ...fileMeta, ...fullData };
        }

        const privateKey = await cryptoLib.decryptPrivateKey(user.privateKeyEncrypted, pass);
        const blob = await cryptoLib.decryptFile(fileItem, privateKey);

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileItem.fileName || "decrypted";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    } catch (e) {
        alert("Decryption Failed: " + e.message);
    }
}

// --- Helper: Identicon (Canvas) ---
function renderIdenticon(text, container, size = 24) {
    let hash = 0;
    for (let i = 0; i < text.length; i++) hash = text.charCodeAt(i) + ((hash << 5) - hash);
    const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
    const color = "00000".substring(0, 6 - c.length) + c;

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = `#${color}`;
    ctx.fillRect(0, 0, size, size);

    // Simple Pattern
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    if (hash % 2 === 0) ctx.fillRect(0, 0, size / 2, size / 2);
    if (hash % 3 === 0) ctx.fillRect(size / 2, size / 2, size / 2, size / 2);

    container.innerHTML = "";
    container.appendChild(canvas);
}
