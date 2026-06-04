
#@title Jalankan llama-server GGUF (GPU CUDA + Auto-Split Fix & Pinggy Tunnel - Background)
#@markdown Masukkan konfigurasi model pada kolom formulir di bawah ini lalu klik tombol "Play".

HF_REPO = "HauhauCS/Qwen3.5-9B-Uncensored-HauhauCS-Aggressive" #@param {type:"string"}
HF_FILE = "Qwen3.5-9B-Uncensored-HauhauCS-Aggressive-Q4_K_M.gguf" #@param {type:"string"}
PORT = 9999 #@param {type:"integer"}
CONTEXT_SIZE = 0 #@param {type:"integer"}
GPU_LAYERS = 99 #@param {type:"integer"}

import os
import re
import sys
import time
import shutil
import requests
import subprocess
import getpass

# Jalur direktori penyimpanan biner
binary_dir = "/content/llama_bin"
version_file = "/content/llama_version.txt"

# ==========================================
# LANGAH 1: PEMERIKSAAN & UNDUH BINER GPU INSTAN (CUDA EDITION)
# ==========================================
print("=== [1/5] Memeriksa Dependensi & Mengunduh Biner GPU ===")

# Cek paket Python 'huggingface_hub'
try:
    from huggingface_hub import hf_hub_download
    print("[OK] Library pendukung sudah terinstal.")
except ImportError:
    print("[INFO] Library belum lengkap. Memulai instalasi...")
    !pip install -q huggingface_hub

from huggingface_hub import hf_hub_download
from gradio import networking

# Ambil rilis GPU terbaru dari ai-dock/llama.cpp-cuda
try:
    latest_release = requests.get("https://api.github.com/repos/ai-dock/llama.cpp-cuda/releases/latest").json()
    latest_tag = latest_release["tag_name"]
    print(f"[INFO] Menemukan rilis GPU terbaru: {latest_tag}")
except Exception:
    latest_tag = "b9305"  # Fallback rilis stabil
    print(f"[INFO] Gagal menghubungi API GitHub, menggunakan rilis fallback: {latest_tag}")

# Logika upgrade otomatis jika versi lokal usang atau mendeteksi perpindahan tipe biner (dari CPU ke GPU)
should_download_bin = True
if os.path.exists(binary_dir) and os.path.exists(version_file):
    with open(version_file, "r") as vf:
        installed_version = vf.read().strip()
    if installed_version == latest_tag + "_GPU":
        should_download_bin = False
        print(f"[OK] Versi biner GPU lokal ({latest_tag}) sudah sesuai.")
    else:
        print(f"[INFO] Versi lokal berbeda atau tipe biner berubah. Mengunduh biner GPU ({latest_tag}).")

if should_download_bin:
    print(f"[INFO] Mengunduh biner GPU prebuilt ({latest_tag}) secara instan...")
    if os.path.exists(binary_dir):
        shutil.rmtree(binary_dir)

    # Format biner GPU dari ai-dock (CUDA 12.8 yang kompatibel penuh dengan driver Colab)
    archive_name = f"llama.cpp-{latest_tag}-cuda-12.8-amd64.tar.gz"
    download_url = f"https://github.com/ai-dock/llama.cpp-cuda/releases/download/{latest_tag}/{archive_name}"

    !wget -q {download_url}
    !mkdir -p {binary_dir}
    !tar -xzf {archive_name} -C {binary_dir}
    !rm {archive_name}

    !chmod +x {binary_dir}/bin/* 2>/dev/null || chmod +x {binary_dir}/* 2>/dev/null

    # Tandai versi dengan akhiran _GPU agar tidak bentrok dengan sisa biner CPU lama
    with open(version_file, "w") as vf:
        vf.write(latest_tag + "_GPU")
    print(f"[OK] Sukses memasang biner GPU terbaru ({latest_tag})!")

# Cari letak biner eksekusi
binary_path = None
run_dir = None
for root, dirs, files in os.walk(binary_dir):
    if "llama-server" in files:
        binary_path = os.path.join(root, "llama-server")
        run_dir = root
        break

if not binary_path:
    print("[ERROR] File llama-server tidak dapat ditemukan setelah ekstraksi.")
    sys.exit()


# ==========================================
# LANGKAH 2: PENANGANAN AUTO-SPLIT & UNDUH/LEWATI MODEL (PROGRESS REAL-TIME)
# ==========================================
print("\n=== [2/5] Memeriksa Struktur File GGUF & Unduhan Lokal ===")

# Deteksi apakah file berformat split seperti -00003-of-00003.gguf
match = re.search(r"-(\d{5})-of-(\d{5})\.gguf$", HF_FILE)
files_to_download = [HF_FILE]

if match:
    part_num = int(match.group(1))
    total_parts = int(match.group(2))
    base_name = re.sub(r"-\d{5}-of-(\d{5})\.gguf$", "", HF_FILE)

    files_to_download = [
        f"{base_name}-{str(idx).zfill(5)}-of-{str(total_parts).zfill(5)}.gguf"
        for idx in range(1, total_parts + 1)
    ]
    print(f"[INFO] Mendeteksi model split ({total_parts} bagian).")

# Pengelompokan folder berdasarkan nama repositori agar tidak terjadi tabrakan file
repo_folder = HF_REPO.replace("/", "_")
local_dir = os.path.join("/content/models", repo_folder)
downloaded_paths = []

for file_to_download in files_to_download:
    local_path = os.path.join(local_dir, file_to_download)

    # Cek apakah file sudah terunduh di folder lokal repositori terkait
    if os.path.exists(local_path):
        print(f"[OK] File '{file_to_download}' sudah ada di lokal. Melewati unduhan.")
        downloaded_paths.append(local_path)
    else:
        print(f"\n[INFO] Mengunduh: {file_to_download}")
        local_path = hf_hub_download(
            repo_id=HF_REPO,
            filename=file_to_download,
            local_dir=local_dir,
            local_dir_use_symlinks=False
        )
        downloaded_paths.append(local_path)

# Mengarahkan muatan model pertama ke index 0
local_model_path = downloaded_paths[0]
print(f"\n[OK] Model dimuat dari berkas lokal: {local_model_path}")


# ==========================================
# LANGKAH 3: MENJALANKAN SERVER DENGAN GPU (CUDA)
# ==========================================
print("\n=== [3/5] Memulai llama-server di Background ===")

cmd = [
    "./llama-server",
    "-m", local_model_path,
    "--port", str(PORT),
    "--host", "127.0.0.1",                    # Mengunci binding lokal pada localhost
    "-ngl", str(GPU_LAYERS),                  # PENTING: Memindahkan semua layer model ke GPU
    "-c", str(CONTEXT_SIZE),                  # Menggunakan panjang konteks yang ditentukan
    "--jinja"                                 # Mengaktifkan Jinja untuk fungsi Agen / Tool Calling
]

env = os.environ.copy()
env["LD_LIBRARY_PATH"] = run_dir + ":" + env.get("LD_LIBRARY_PATH", "")

log_file_path = "/content/llama_server.log"
with open(log_file_path, "w") as log_file:
    # Mengaktifkan library .so GPU bawaan dengan menetapkan directory tempat file .so berada
    server_process = subprocess.Popen(cmd, cwd=run_dir, env=env, stdout=log_file, stderr=subprocess.STDOUT)


# ==========================================
# LANGKAH 4: VERIFIKASI INISIALISASI SERVER
# ==========================================
print("\n=== [4/5] Memeriksa Inisialisasi Server ===")
print("Harap tunggu, model sedang dimuat ke VRAM GPU...")
print("-" * 60)

while not os.path.exists(log_file_path):
    time.sleep(0.5)

local_url = f"http://127.0.0.1:{PORT}/v1/models"
ready = False
last_poll_time = 0
poll_interval = 5

with open(log_file_path, "r") as f:
    while not ready:
        line = f.readline()
        if line:
            print(line, end="")
        else:
            time.sleep(0.1)

        current_time = time.time()
        if current_time - last_poll_time > poll_interval:
            last_poll_time = current_time
            try:
                response = requests.get(local_url)
                if response.status_code == 200:
                    ready = True
                    break
            except requests.exceptions.ConnectionError:
                pass

            if server_process.poll() is not None:
                print("\n\n[ERROR] Proses llama-server terhenti secara mendadak. Silakan periksa log di atas.")
                break


# ==========================================
# LANGKAH 5: JALANKAN DIRECT PINGGY TUNNEL (BACKGROUND MODE)
# ==========================================
print("-" * 60)
if ready:
    print("\n=== [5/5] MENYALAKAN PINGGY PORT TUNNEL ===")

    # Jalankan SSH tunnel ke Pinggy di background
    cmd_ssh = [
        "ssh", "-p", "443",
        "-o", "StrictHostKeyChecking=no",
        "-o", "ServerAliveInterval=30",
        f"-R0:localhost:{PORT}",
        "free@a.pinggy.io"
    ]

    try:
        # Meluncurkan proses SSH tunnel di background
        pinggy_process = subprocess.Popen(cmd_ssh, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)

        print("[INFO] Menghubungkan terowongan Pinggy...")
        public_url = None

        for _ in range(40):
            line = pinggy_process.stdout.readline()
            if not line:
                time.sleep(0.2)
                continue

            clean_line = line.strip()
            if clean_line:
                print(f"       {clean_line}")

            # Regex dikunci hanya pada akhiran .link agar mengabaikan dashboard.pinggy.io
            match = re.search(r"https://[a-zA-Z0-9\-\.]+\.link", clean_line)
            if match:
                public_url = match.group(0)
                break  # Langsung keluar setelah mendeteksi URL terowongan asli

            time.sleep(0.1)

    except Exception as e:
        print(f"[ERROR] Gagal membuka tunnel Pinggy: {e}")
        sys.exit()

    if public_url:
        if not public_url.endswith("/"):
            public_url += "/"
        api_base_url = f"{public_url}v1"

        print("\n" + "=" * 60)
        print(" SERVER GPU BERHASIL DIHUBUNGKAN LANGSUNG KE PINGGY TUNNEL!")
        print(f" API Base URL: {api_base_url}")
        print("=" * 60)

        print("\nContoh pengujian dengan cURL:")
        clean_model_name = os.path.basename(local_model_path).replace('.gguf', '')
        print(f"""
curl -X POST {api_base_url}/chat/completions \\
  -H "Content-Type: application/json" \\
  -d '{{
    "model": "{clean_model_name}",
    "messages": [
      {{"role": "user", "content": "Halo, siapa kamu?"}}
    ],
    "temperature": 0.7
  }}'
        """)
        print("\n[INFO] Proses tunnel dan server kini berjalan sepenuhnya di background.")
        print("       Anda dapat lanjut menjalankan sel lainnya tanpa menutup koneksi ini.")
        print("       Catatan: Versi gratis Pinggy memiliki batas waktu 60 menit per sesi.")
    else:
        print("\n[ERROR] Gagal memperoleh URL publik dari Pinggy. Silakan jalankan ulang sel ini.")
