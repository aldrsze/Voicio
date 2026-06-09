# Voicio 🐱🎙️

Voicio is a fast, minimalist, and highly modular Text-to-Speech (TTS) application that operates on a hybrid architecture. It combines lightweight browser storage with stateless backend endpoints, providing high-quality multi-language speech generation with zero configuration.

The user interface follows a **Brutalist Monochrome** design system, delivering instant responses, clean structures, and direct user feedback.

---

## 🎥 Video Presentation
<!-- Replace the line below with your video embed or link -->
[![Voicio Presentation Placeholder](https://img.shields.io/badge/Voicio-Video_Presentation_Placeholder-black?style=for-the-badge&logo=youtube)](https://www.youtube.com/)

---

## 🛠️ Technologies

### Frontend
- **Framework**: React 19 + TypeScript 6
- **Build System**: Vite 8
- **Styling**: Tailwind CSS v4 (Monochrome Brutalist styling)
- **State/Routing**: React Router v7
- **Database**: IndexedDB (via browser storage API) for local client-side model caching

### Backend
- **Framework**: FastAPI (Python 3.12)
- **Audio Processing**: ffmpeg (for online stream transcoding) and standard Python `wave` libraries
- **Deployment**: Docker & Docker Compose
- **Web Server**: Nginx (serving static assets and proxying API endpoints)
- **TTS Engines**:
  - **Piper TTS**: Local, fast, neural TTS running statelessly via client-uploaded model bytes.
  - **Microsoft Edge TTS**: Cloud-based neural API providing 300+ voices across dozens of languages.
  - **MMS-TTS**: Hugging Face Multilingual Multispeaker TTS integration.

---

## ✨ Features

- **Hybrid Model Architecture**:
  - Download Piper ONNX models directly into your browser's IndexedDB.
  - Once cached, generate audio via a stateless backend connection by uploading the model bytes on-demand (`POST /api/tts-with-model`), keeping the server lightweight.
- **Edge TTS Integration**: Instantly stream 300+ high-quality online Microsoft voices without having to download or manage any local model files.
- **Waveform Visualization**: Interactive canvas visualizer showing audio activity during generation and playback.
- **History Log**: Keeps track of your last 20 audio generations. Replay, redownload, or track generation parameters (speed, voice) locally.
- **Speed Controller**: Adjust vocal delivery speed dynamically from `0.5x` to `2.0x`.
- **Theme-Persistent Layout**: Seamlessly toggle between Light and Dark modes instantly. The layout stays intact, preserving text input and selector states without remounting or page resets.
- **Keyboard Shortcuts**: Generate speech instantly by pressing `Ctrl + Enter` (or `Cmd + Enter`).

---

## 🏗️ How I Built It (The Process)

1. **Requirements & Scope definition**: Designed the hybrid architecture, defining a system where the client carries the model weight (IndexedDB) and the server operates as a stateless executor.
2. **Scaffolding**: Initialized React 19 + Vite + Tailwind CSS v4 on the frontend, and FastAPI on the backend.
3. **Database & Storage layer**: Built the IndexedDB wrapper `modelStorage.ts` to read, write, and list user-imported or catalog-downloaded `.onnx` and `.onnx.json` model files.
4. **Stateless API Routes**: Implemented `POST /api/tts-with-model` which accepts multipart form uploads containing text, speed, and raw model bytes. The backend writes these to temporary paths, executes the `piper` binary, streams the output, and immediately cleans up the temporary files.
5. **Edge TTS Proxy**: Integrated `edge-tts` with `ffmpeg` subprocess pipelines to transcode raw MP3 cloud streams to 16-bit mono PCM WAV files.
6. **Polishing User Experience**: Built the Brutalist UI with instant transitions, responsive tabs, collapsible panels, and character badges. Optimized the React Router hierarchy to ensure that state is preserved during theme switches.

---

## 💡 What I Learned

- **Stateless Server Architecture**: Storing multi-gigabyte models on the server is costly and limits scalability. By storing models in the client's IndexedDB and uploading them dynamically for processing, the backend can remain ultra-lightweight and run on inexpensive serverless hardware.
- **Tailwind v4 & React 19 Reconciliations**: Gained experience dealing with React Router tree structures and how re-renders from root context state changes (like themes) can destroy nested component state if the router is not initialized at the absolute root level.
- **Transcoding via Pipes**: Learned how to chain input and output streams directly to subprocesses in Python (using `ffmpeg` via standard `subprocess.run` pipes) without creating temporary storage overhead.

---

## 🚀 Future Enhancements

- **WASM Client Inference**: Run Piper TTS fully in the browser via WebAssembly (ONNX Runtime Web), bypassing backend execution entirely for an offline, serverless experience.
- **Word-Level Code-Switching**: Automatically split sentences at the word level when switching between English, Tagalog, and Spanish, sending appropriate fragments to different voice engines to stitch together a unified voice file.
- **Audio Output Formats**: Allow users to download audio in compressed formats like `.mp3` or `.opus` in addition to `.wav`.

---

## 🏃 How to Run the Project

### Prerequisites
- [Docker](https://www.docker.com/) and [Docker Compose](https://docs.docker.com/compose/) installed on your machine.

### One-Command Start (Recommended)
1. Clone the repository and navigate to the project directory:
   ```bash
   git clone <repo-url>
   cd Voicio
   ```
2. Build and start the containers:
   ```bash
   docker-compose up --build
   ```
3. Open your browser and navigate to:
   - **Website**: `http://localhost/` (or port `80`)
   - **Backend API Docs**: `http://localhost:8000/docs`

### Local Development (Without Docker)

#### Running the Backend
1. Ensure Python 3.12 and `ffmpeg` are installed on your system.
2. Go to the backend directory and set up a virtual environment:
   ```bash
   cd backend
   python3 -m venv venv
   source venv/bin/activate  # On Windows: .\venv\Scripts\activate
   pip install -r requirements.txt
   ```
3. Start the FastAPI development server:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```

#### Running the Frontend
1. Go to the frontend directory:
   ```bash
   cd frontend
   npm install
   ```
2. Start the Vite development server:
   ```bash
   npm run dev
   ```
3. Open `http://localhost:5173/` in your browser.
