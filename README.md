# AI Code Assistant

A code-focused conversational AI application with:
- Chat-style interface
- Persistent conversation history using SQLite
- Multiple chats
- Code generation
- Debugging and error solving
- Code explanation
- Refactoring and optimization
- Test generation
- Documentation help
- Copyable code blocks
- Dark/light theme
- Export/delete conversations
- OpenAI-compatible backend structure

## Setup on Windows

1. Open PowerShell in this folder.
2. Create a virtual environment:
   python -m venv venv
3. Activate:
   .\venv\Scripts\Activate.ps1
4. Install:
   pip install -r requirements.txt
5. Copy `.env.example` to `.env` and place your API key in it.
6. Run:
   uvicorn app:app --reload
7. Open:
   http://127.0.0.1:8000

Do not commit `.env` to GitHub.

## Project structure

- app.py: FastAPI server and API endpoints
- database.py: SQLite persistence
- llm.py: LLM integration and code-specialist system prompt
- templates/index.html: main UI
- static/app.js: chat behavior
- static/style.css: UI design
