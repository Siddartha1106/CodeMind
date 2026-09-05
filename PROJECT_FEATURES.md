# 🚀 CodeMind Studio - Complete Project Features & Technical Documentation

**CodeMind Studio** is a full-stack, multi-tenant AI developer workspace built with **FastAPI**, **SQLite**, **OAuth2**, **Open-Source LLMs**, **SSE Real-Time Streaming**, and **ChatGPT Dark Theme Visual Aesthetics**.

---

## 📋 Table of Contents
1. [Overview & Tech Stack](#-overview--tech-stack)
2. [Complete Features List](#-complete-features-list)
3. [Authentication & User Management](#-authentication--user-management)
4. [Multi-Model AI Engine & Streaming](#-multi-model-ai-engine--streaming)
5. [Database Architecture & Isolation](#-database-architecture--isolation)
6. [Interactive UI & ChatGPT Aesthetic System](#-interactive-ui--chatgpt-aesthetic-system)
7. [API Endpoint Documentation](#-api-endpoint-documentation)
8. [Environment Setup & Variables](#-environment-setup--variables)
9. [Deployment Options (100% Free)](#-deployment-options-100-free)

---

## 🛠️ Overview & Tech Stack

- **Backend**: Python 3.11, FastAPI, Uvicorn ASGI, HTTPX Async HTTP Client, Starlette Sessions, PyJWT, Authlib.
- **Frontend**: HTML5, Vanilla CSS (Custom Design System matching ChatGPT dark theme), JavaScript ES6+, Highlight.js (Tokyo Night theme).
- **Database**: SQLite3 with foreign key cascading deletes and migration helpers.
- **AI Integrations**: Groq LPU API, OpenRouter Multi-Model API, OpenAI API, Google Gemini REST API, Local Ollama fallback.
- **Streaming**: Server-Sent Events (SSE) via FastAPI `StreamingResponse`.

---

## 🌟 Complete Features List

### 1. 🔐 Multi-Provider OAuth2 Authentication
- **Google OAuth2 Login**: Redirects to Google consent screen, exchanges authorization code for access token, retrieves user email, name, and profile picture.
- **GitHub OAuth2 Login**: Connects via GitHub Developer App, retrieves primary verified email, handle name, and GitHub avatar.
- **Developer Guest Access**: Instant 1-click bypass login (`guest@codeforge.ai`) for local testing without needing OAuth keys configured.
- **Encrypted Session Cookie**: Uses HTTP-Only signed cookie sessions (`SessionMiddleware`) for 30-day persistent sessions.

### 2. 🤖 Multi-Model AI Engine & Dynamic Switcher
- **Groq LPU Acceleration**: Sub-0.5s response latency running at 500+ tokens/second.
- **OpenRouter Free Tier Models**: Access to top open-source models with zero costs.
- **Supported Models**:
  - `⚡ Llama 3.3 70B (Groq - Super Fast <0.5s)`
  - `⚡ Qwen 2.5 Coder 32B (Groq - Fast)`
  - `⚡ Gemini 2.0 Flash (OpenRouter Free)`
  - `Llama 3.3 70B (OpenRouter Free)`
  - `Qwen 2.5 Coder 32B (OpenRouter Free)`
  - `🧠 DeepSeek R1 Reasoning (OpenRouter Free)`
- **Dynamic Header Switcher**: Users can change AI models on the fly during any conversation.

### 3. ⚡ Real-Time SSE Token Streaming
- **Live Typing Effect**: Word-by-word streaming tokens rendered into the chat view in real-time.
- **Blinking Block Cursor**: Animated block cursor indicating active AI reasoning.
- **Syntax Highlighting**: Automatic code block formatting via Highlight.js upon stream completion.

### 4. 📄 Interactive File & Code Attachment System (`+` Button)
- **File Picker**: Upload multiple code/text files simultaneously (`.py`, `.js`, `.html`, `.css`, `.json`, `.md`, `.txt`, `.pdf`, `.csv`).
- **Attachment Badges**: Displays interactive file badges (`📄 main.py ✕`) with individual removal capability.
- **AI File Inspection**: Reads raw text and source code contents from uploaded files and automatically appends them to the prompt context.

### 5. 🧠 "Think" Deep Reasoning Mode
- **Tag Toggle**: Clickable `Think` capsule button toggles **Deep Reasoning Mode** on and off (`Think ✓`).
- **Chain-of-Thought System Prompting**: Automatically routes prompt queries to **DeepSeek R1 / Reasoning models** and instructs the AI to perform step-by-step logic analysis before outputting code solutions.

### 6. 🎙️ Voice Dictation (Speech-to-Text)
- **Web Speech API**: Microphones button triggers real-time speech dictation.
- **Pulsing Animation**: Mic glows red while listening and transcribes voice directly into the input capsule text area.

### 7. 📚 Conversations Library Modal
- **Archive Search**: Interactive modal listing all user chat histories sorted by last updated date.
- **1-Click Load & Export**: Open any archived conversation or export complete message logs to `.txt` files.

### 8. 📁 Projects Workspace Manager
- **Category Workspaces**: Organize coding sessions into dedicated categories:
  - 🌐 Web Applications (FastAPI, React, HTML/CSS)
  - 🐍 Python Scripts (Data processing & algorithms)
  - 🛡️ Cybersecurity (Security audits & debugging)
  - ⚙️ API Integrations (REST APIs & OAuth)

### 9. 🔌 Plugins & Developer Tools Modal
- **Toggle Controls**:
  - 🧪 **Code Interpreter / Executor**: Runs and evaluates Python code output.
  - 🌐 **Web Search & Doc Finder**: Searches documentation and current web specifications.
  - 🛠️ **Code Formatter & Linter**: Enforces PEP8 / Prettier code block standards.

### 10. ⏰ Scheduled Tasks & Code Health Reminders
- **Timer Manager**: Set up recurring code review checks or project reminders.

---

## 🎨 Interactive UI & ChatGPT Aesthetic System

- **Pitch Black Workspace**: `#000000` background for main chat container.
- **Dark Charcoal Sidebar**: `#171717` background with navigation links, recents list, user profile card, and theme mode toggle.
- **Personalized Hero Greeting**: Automatically formats `"Hey, {User First Name}. Ready to dive in?"`.
- **Floating Input Capsule**: Central rounded input pill (`#212121`) containing attachment `+` icon, `Ask anything` input, `Think` reasoning button, mic icon, and circular send button.
- **Code Header Banner**: Code blocks feature top language headers with Copy Code buttons.

---

## 💾 Database Architecture & Isolation

**Database File**: `code_assistant.db` (SQLite3)

### Database Schemas:
1. `users` Table:
   - `id` (INTEGER PRIMARY KEY AUTOINCREMENT)
   - `email` (TEXT UNIQUE NOT NULL)
   - `name` (TEXT NOT NULL)
   - `avatar_url` (TEXT)
   - `provider` (TEXT NOT NULL - 'google', 'github', 'guest')
   - `provider_id` (TEXT NOT NULL)
   - `created_at` (TEXT NOT NULL)

2. `conversations` Table:
   - `id` (INTEGER PRIMARY KEY AUTOINCREMENT)
   - `user_id` (INTEGER NOT NULL, FK -> `users(id)`)
   - `title` (TEXT NOT NULL DEFAULT 'New chat')
   - `model` (TEXT DEFAULT 'llama-3.3-70b-versatile')
   - `created_at` (TEXT NOT NULL)
   - `updated_at` (TEXT NOT NULL)

3. `messages` Table:
   - `id` (INTEGER PRIMARY KEY AUTOINCREMENT)
   - `conversation_id` (INTEGER NOT NULL, FK -> `conversations(id)`)
   - `role` (TEXT NOT NULL CHECK(role IN ('user', 'assistant')))
   - `content` (TEXT NOT NULL)
   - `created_at` (TEXT NOT NULL)

---

## 📡 API Endpoint Documentation

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/` | Renders main application workspace (`index.html`) |
| `GET` | `/login` | Renders OAuth login page (`login.html`) |
| `GET` | `/auth/login/google` | Initiates Google OAuth consent flow |
| `GET` | `/auth/callback/google` | Handles Google authorization code exchange |
| `GET` | `/auth/login/github` | Initiates GitHub OAuth consent flow |
| `GET` | `/auth/callback/github` | Handles GitHub authorization code exchange |
| `GET` | `/auth/login/guest` | Instant developer guest mode login |
| `GET` | `/auth/logout` | Clears user session cookie |
| `GET` | `/api/me` | Returns current authenticated user profile |
| `GET` | `/api/models` | Returns available open-source AI models |
| `GET` | `/api/conversations` | Lists user's saved conversations |
| `POST` | `/api/conversations` | Spawns a new empty conversation |
| `GET` | `/api/conversations/{cid}` | Retrieves messages for conversation `{cid}` |
| `PATCH` | `/api/conversations/{cid}` | Renames conversation title or changes model |
| `DELETE` | `/api/conversations/{cid}` | Deletes conversation and messages |
| `POST` | `/api/chat/stream` | Server-Sent Events (SSE) live streaming completion |

---

## ⚙️ Environment Setup & Variables

In your [.env](file:///c:/Users/DELL/Downloads/CodeMind_Studio_Project/.env) file:

```env
# Secret Key for session signing
SECRET_KEY=codeforge_super_secret_session_key_2026_dev

# Application Base URL
APP_URL=http://localhost:8000

# 100% Free API Provider Options (Choose Groq, OpenRouter, or OpenAI)
LLM_PROVIDER=groq
GROQ_API_KEY=gsk_your_free_groq_key_here
OPENROUTER_API_KEY=sk-or-v1-your_free_openrouter_key_here
OPENAI_API_KEY=

# Default Model Selection
DEFAULT_MODEL=llama-3.3-70b-versatile

# OAuth Provider Credentials
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here

GITHUB_CLIENT_ID=your_github_client_id_here
GITHUB_CLIENT_SECRET=your_github_client_secret_here

# Enable Developer Guest Mode (Instant login without OAuth setup)
ALLOW_GUEST_LOGIN=true
```

---

## ☁️ Deployment Options (100% Free)

### 1. Render.com (Web Service - Card-Free)
- Repository includes [render.yaml](file:///c:/Users/DELL/Downloads/CodeMind_Studio_Project/render.yaml).
- Deploy as **Web Service** on Render's **Free Tier ($0/month)**.

### 2. Hugging Face Spaces (Docker - Card-Free)
- Create a new Space -> SDK **Docker**. Push repository code.

### 3. Docker Container
```bash
docker build -t codemind-studio .
docker run -p 8000:8000 --env-file .env codemind-studio
```
