import socket
import threading
import tkinter as tk
from tkinter import ttk
import os
import sys

# Add the server directory to python path if running as an executable
if getattr(sys, 'frozen', False):
    application_path = sys._MEIPASS
else:
    application_path = os.path.dirname(os.path.abspath(__file__))

if application_path not in sys.path:
    sys.path.append(application_path)

from app import app

def get_local_ip():
    """Detect the local IP address on the current network interface."""
    try:
        # Create a dummy socket connection to determine the local routing IP
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        # Fallback to localhost if no network is detected
        return "127.0.0.1"

def run_flask():
    """Run the Flask app in a background thread."""
    # use_reloader=False is mandatory when running Flask in a secondary thread or PyInstaller
    app.run(host='0.0.0.0', port=5000, use_reloader=False, threaded=True)

def main():
    ip_address = get_local_ip()
    url = f"http://{ip_address}:5000"

    # Start the Flask backend API in a daemon thread so it shuts down when the GUI closes
    server_thread = threading.Thread(target=run_flask, daemon=True)
    server_thread.start()

    # --- Setup Tkinter GUI ---
    root = tk.Tk()
    root.title("VajraShare Intranet Server")
    root.geometry("450x250")
    root.configure(bg="#0a0a0a")
    root.resizable(False, False)

    # Styling configuration
    style = ttk.Style()
    style.theme_use('default')
    style.configure("TLabel", background="#0a0a0a", foreground="#e0e0e0")
    style.configure("Header.TLabel", font=("Arial", 16, "bold"), foreground="#00ff41")
    style.configure("Info.TLabel", font=("Arial", 11))

    # UI Content
    ttk.Label(root, text="VajraShare Server Running", style="Header.TLabel").pack(pady=(20, 10))
    
    ttk.Label(
        root, 
        text="To connect your Chrome Extension, enter this exact URL\nin the 'Self-Hosting / Intranet' settings tab:", 
        style="Info.TLabel", 
        justify="center"
    ).pack(pady=10)

    # Highlighted URL Box
    url_frame = tk.Frame(root, bg="#111111", padx=10, pady=10, highlightbackground="#00ff41", highlightthickness=1)
    url_frame.pack(pady=5)
    
    # Selectable Text for URL
    url_text = tk.Text(url_frame, height=1, width=len(url)+2, font=("Courier", 14, "bold"), bg="#111111", fg="#00ff41", bd=0, highlightthickness=0)
    url_text.insert(tk.END, url)
    url_text.configure(state="disabled") # Make it read-only but selectable
    url_text.pack()

    ttk.Label(root, text="Keep this window open to keep the server online.", style="Info.TLabel", foreground="#888888").pack(pady=(15, 0))

    # Center the window on screen
    root.update_idletasks()
    x = (root.winfo_screenwidth() // 2) - (450 // 2)
    y = (root.winfo_screenheight() // 2) - (250 // 2)
    root.geometry(f"450x250+{x}+{y}")

    root.mainloop()

if __name__ == "__main__":
    main()
