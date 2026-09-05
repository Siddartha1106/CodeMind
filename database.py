import sqlite3
from pathlib import Path
from datetime import datetime, timezone

DB_PATH = Path(__file__).with_name("code_assistant.db")


def connect():
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys = ON;")
    return con


def now():
    return datetime.now(timezone.utc).isoformat()


def init_db():
    with connect() as con:
        # Users Table
        con.execute("""
        CREATE TABLE IF NOT EXISTS users(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            avatar_url TEXT,
            provider TEXT NOT NULL,
            provider_id TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
        """)

        # Default Guest User for local testing / bypass mode
        con.execute("""
        INSERT OR IGNORE INTO users(id, email, name, avatar_url, provider, provider_id, created_at)
        VALUES(1, 'guest@codeforge.ai', 'Guest Developer', '', 'guest', 'guest_1', ?)
        """, (now(),))

        # Conversations Table
        con.execute("""
        CREATE TABLE IF NOT EXISTS conversations(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL DEFAULT 1,
            title TEXT NOT NULL DEFAULT 'New chat',
            model TEXT DEFAULT 'qwen/qwen-2.5-coder-32b-instruct',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        )
        """)

        # Migration helper for older DB versions missing user_id or model column
        try:
            columns = [row["name"] for row in con.execute("PRAGMA table_info(conversations)").fetchall()]
            if "user_id" not in columns:
                con.execute("ALTER TABLE conversations ADD COLUMN user_id INTEGER NOT NULL DEFAULT 1")
            if "model" not in columns:
                con.execute("ALTER TABLE conversations ADD COLUMN model TEXT DEFAULT 'qwen/qwen-2.5-coder-32b-instruct'")
        except Exception:
            pass

        # Messages Table
        con.execute("""
        CREATE TABLE IF NOT EXISTS messages(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            conversation_id INTEGER NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('user','assistant')),
            content TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
        )
        """)
        con.commit()


def get_or_create_user(email: str, name: str, avatar_url: str, provider: str, provider_id: str) -> dict:
    t = now()
    with connect() as con:
        user = con.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
        if user:
            # Update user profile info if changed
            con.execute(
                "UPDATE users SET name=?, avatar_url=?, provider=?, provider_id=? WHERE id=?",
                (name, avatar_url, provider, provider_id, user["id"])
            )
            con.commit()
            return dict(con.execute("SELECT * FROM users WHERE id = ?", (user["id"],)).fetchone())
        else:
            cur = con.execute(
                "INSERT INTO users(email, name, avatar_url, provider, provider_id, created_at) VALUES(?,?,?,?,?,?)",
                (email, name, avatar_url, provider, provider_id, t)
            )
            con.commit()
            return dict(con.execute("SELECT * FROM users WHERE id = ?", (cur.lastrowid,)).fetchone())


def get_user_by_id(user_id: int) -> dict | None:
    with connect() as con:
        user = con.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        return dict(user) if user else None


def create_conversation(user_id: int, title: str = "New chat", model: str = "qwen/qwen-2.5-coder-32b-instruct") -> int:
    t = now()
    with connect() as con:
        cur = con.execute(
            "INSERT INTO conversations(user_id, title, model, created_at, updated_at) VALUES(?,?,?,?,?)",
            (user_id, title, model, t, t)
        )
        con.commit()
        return cur.lastrowid


def list_conversations(user_id: int) -> list:
    with connect() as con:
        rows = con.execute(
            "SELECT * FROM conversations WHERE user_id = ? ORDER BY updated_at DESC",
            (user_id,)
        ).fetchall()
        return [dict(r) for r in rows]


def get_conversation(user_id: int, cid: int) -> dict | None:
    with connect() as con:
        conv = con.execute("SELECT * FROM conversations WHERE id=? AND user_id=?", (cid, user_id)).fetchone()
        if not conv:
            return None
        msgs = con.execute(
            "SELECT id, role, content, created_at FROM messages WHERE conversation_id=? ORDER BY id",
            (cid,)
        ).fetchall()
        data = dict(conv)
        data["messages"] = [dict(m) for m in msgs]
        return data


def add_message(cid: int, role: str, content: str):
    t = now()
    with connect() as con:
        con.execute(
            "INSERT INTO messages(conversation_id, role, content, created_at) VALUES(?,?,?,?)",
            (cid, role, content, t)
        )
        con.execute("UPDATE conversations SET updated_at=? WHERE id=?", (t, cid))
        con.commit()


def rename_conversation(user_id: int, cid: int, title: str):
    with connect() as con:
        con.execute(
            "UPDATE conversations SET title=?, updated_at=? WHERE id=? AND user_id=?",
            (title, now(), cid, user_id)
        )
        con.commit()


def update_conversation_model(user_id: int, cid: int, model: str):
    with connect() as con:
        con.execute(
            "UPDATE conversations SET model=?, updated_at=? WHERE id=? AND user_id=?",
            (model, now(), cid, user_id)
        )
        con.commit()


def delete_conversation(user_id: int, cid: int):
    with connect() as con:
        con.execute("DELETE FROM messages WHERE conversation_id=?", (cid,))
        con.execute("DELETE FROM conversations WHERE id=? AND user_id=?", (cid, user_id))
        con.commit()
