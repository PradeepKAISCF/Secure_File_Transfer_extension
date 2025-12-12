const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Storage Setup
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath);
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        // Use the original name or a UUID to prevent collisions if needed
        // For security, we might want to rename, but for this project keeping the .enc extension is fine.
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

const DB_FILE = path.join(__dirname, 'db.json');

// Helper to read/write DB
function getDB() {
    if (!fs.existsSync(DB_FILE)) return { users: [], files: [] };
    return JSON.parse(fs.readFileSync(DB_FILE));
}

function saveDB(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// --- Routes ---

// 1. Register User (Save Public Key)
app.post('/register', (req, res) => {
    const { username, publicKey } = req.body;
    if (!username || !publicKey) return res.status(400).send('Missing username or publicKey');

    const db = getDB();
    if (db.users.find(u => u.username === username)) {
        return res.status(400).send('Username already exists');
    }

    db.users.push({ username, publicKey });
    saveDB(db);
    console.log(`User registered: ${username}`);
    res.json({ success: true });
});

// 2. Get All Users (for dropdown)
app.get('/users', (req, res) => {
    const db = getDB();
    // Return only usernames and public keys
    res.json(db.users.map(u => ({ username: u.username, publicKey: u.publicKey })));
});

// 3. Upload File (for a specific user)
app.post('/upload', upload.single('encryptedFile'), (req, res) => {
    const { recipient } = req.body;
    const file = req.file;

    if (!file || !recipient) return res.status(400).send('Missing file or recipient');

    const db = getDB();
    // Check if recipient exists
    if (!db.users.find(u => u.username === recipient)) {
        // Clean up file if user doesn't exist
        fs.unlinkSync(file.path);
        return res.status(404).send('Recipient not found');
    }

    const fileMeta = {
        id: uuidv4(),
        filename: file.originalname, // e.g. "secret.pdf.enc"
        path: file.path,
        sender: 'Anonymous', // We could add sender auth later
        recipient: recipient,
        timestamp: Date.now()
    };

    db.files.push(fileMeta);
    saveDB(db);
    console.log(`File uploaded for ${recipient}: ${file.originalname}`);
    res.json({ success: true, fileId: fileMeta.id });
});

// 4. Get My Files
app.get('/files/:username', (req, res) => {
    const { username } = req.params;
    const db = getDB();
    const myFiles = db.files.filter(f => f.recipient === username);
    res.json(myFiles);
});

// 5. Download File
app.get('/download/:fileId', (req, res) => {
    const { fileId } = req.params;
    const db = getDB();
    const fileMeta = db.files.find(f => f.id === fileId);

    if (!fileMeta) return res.status(404).send('File not found');
    if (!fs.existsSync(fileMeta.path)) return res.status(404).send('File on disk missing');

    res.download(fileMeta.path, fileMeta.filename);
});

// Start Server
app.listen(PORT, () => {
    console.log(`SecureShare Relay Server running on http://localhost:${PORT}`);
    // Initialize DB if missing
    if (!fs.existsSync(DB_FILE)) saveDB({ users: [], files: [] });
});
