from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import os, uuid, json, time

app = Flask(__name__)
CORS(app) # Enable CORS for Extension usage

DATA_DIR = "data"
FILES_DIR = os.path.join(DATA_DIR, "files")
KEYS_DIR = os.path.join(DATA_DIR, "keys")
META_DIR = os.path.join(DATA_DIR, "meta")

os.makedirs(FILES_DIR, exist_ok=True)
os.makedirs(KEYS_DIR, exist_ok=True)
os.makedirs(META_DIR, exist_ok=True)

@app.route("/register", methods=["POST"])
def register():
    # { "handle": "neo", "publicKey": "...", "privateKeyEncrypted": {...} }
    data = request.json
    handle = data.get("handle")
    pubKey = data.get("publicKey")
    privKeyEnc = data.get("privateKeyEncrypted")
    
    if not handle or not pubKey:
        return jsonify({"error": "Missing fields"}), 400
        
    key_path = os.path.join(KEYS_DIR, f"{handle}.key")
    if os.path.exists(key_path):
        return jsonify({"error": "Handle exists"}), 409
        
    # Save Public Key
    with open(key_path, "w") as f:
        f.write(pubKey)
        
    # Save Encrypted Private Key (if provided)
    if privKeyEnc:
        priv_path = os.path.join(KEYS_DIR, f"{handle}.priv")
        with open(priv_path, "w") as f:
            json.dump(privKeyEnc, f)
        
    return jsonify({"success": True})

@app.route("/key/<handle>", methods=["GET"])
def get_key(handle):
    key_path = os.path.join(KEYS_DIR, f"{handle}.key")
    if not os.path.exists(key_path):
        return jsonify({"error": "User not found"}), 404
        
    with open(key_path, "r") as f:
        return jsonify({"publicKey": f.read()})

@app.route("/login/<handle>", methods=["GET"])
def login_get_priv_key(handle):
    priv_path = os.path.join(KEYS_DIR, f"{handle}.priv")
    if not os.path.exists(priv_path):
        return jsonify({"error": "No backup found for this user"}), 404
        
    with open(priv_path, "r") as f:
        return jsonify(json.load(f))

@app.route("/upload", methods=["POST"])
def upload():
    # { "sender": "...", "recipient": "...", "encryptedKey": "...", "iv": "...", "fileData": "...", "fileName": "..." }
    data = request.json
    file_id = str(uuid.uuid4())
    
    # Save Content
    with open(os.path.join(FILES_DIR, file_id), "w") as f:
        json.dump(data, f)
        
    # Save Metadata for Indexing
    meta = {
        "id": file_id,
        "sender": data.get("sender"),
        "recipient": data.get("recipient"),
        "fileName": data.get("fileName"),
        "timestamp": time.time() * 1000
    }
    
    recipient_dir = os.path.join(META_DIR, data.get("recipient"))
    os.makedirs(recipient_dir, exist_ok=True)
    
    with open(os.path.join(recipient_dir, file_id + ".meta"), "w") as f:
        json.dump(meta, f)
        
    return jsonify({"id": file_id})

@app.route("/inbox/<handle>", methods=["GET"])
def inbox(handle):
    recipient_dir = os.path.join(META_DIR, handle)
    if not os.path.exists(recipient_dir):
        return jsonify([])
        
    files = []
    for fname in os.listdir(recipient_dir):
        with open(os.path.join(recipient_dir, fname), "r") as f:
            files.append(json.load(f))
            
    return jsonify(files)

@app.route("/file/<file_id>", methods=["GET"])
def download(file_id):
    file_path = os.path.join(FILES_DIR, file_id)
    if not os.path.exists(file_path):
        return jsonify({"error": "File not found"}), 404
        
    with open(file_path, "r") as f:
        return jsonify(json.load(f))

if __name__ == "__main__":
    host = os.environ.get('HOST', '0.0.0.0')
    port = int(os.environ.get('PORT', 5000))
    print(f"VajraShare Server Running on {host}:{port}")
    app.run(host=host, port=port)
