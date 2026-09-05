import os
import httpx
from fastapi import FastAPI, Request, HTTPException, Depends, status
from fastapi.responses import HTMLResponse, RedirectResponse, StreamingResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from starlette.middleware.sessions import SessionMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

from database import (
    init_db,
    get_or_create_user,
    get_user_by_id,
    create_conversation,
    list_conversations,
    get_conversation,
    add_message,
    rename_conversation,
    update_conversation_model,
    delete_conversation
)

from llm import generate, generate_stream, AVAILABLE_MODELS, DEFAULT_MODEL

SECRET_KEY = os.getenv("SECRET_KEY", "codeforge_super_secret_session_key_2026_dev")
APP_URL = os.getenv("APP_URL", "http://localhost:8000").rstrip("/")
ALLOW_GUEST_LOGIN = os.getenv("ALLOW_GUEST_LOGIN", "true").lower() == "true"

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")

GITHUB_CLIENT_ID = os.getenv("GITHUB_CLIENT_ID", "")
GITHUB_CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET", "")


app = FastAPI(title="CodeForge AI - ChatGPT Clone")

# Session Middleware for cookie sessions
app.add_middleware(SessionMiddleware, secret_key=SECRET_KEY, session_cookie="codeforge_session", max_age=86400 * 30)

app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")


class ChatRequest(BaseModel):
    conversation_id: int | None = None
    message: str
    model: str | None = None


class RenameRequest(BaseModel):
    title: str | None = None
    model: str | None = None


@app.on_event("startup")
def startup():
    init_db()


def get_current_user(request: Request) -> dict:
    user_id = request.session.get("user_id")
    if not user_id:
        if ALLOW_GUEST_LOGIN:
            # Auto fallback to guest user in dev if guest login is allowed
            request.session["user_id"] = 1
            user_id = 1
        else:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    
    user = get_user_by_id(user_id)
    if not user:
        request.session.clear()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User profile not found")
    return user


# --- ROUTE HANDLERS ---

@app.get("/", response_class=HTMLResponse)
def home(request: Request):
    user_id = request.session.get("user_id")
    if not user_id and not ALLOW_GUEST_LOGIN:
        return RedirectResponse(url="/login")
    return templates.TemplateResponse("index.html", {"request": request})


@app.get("/login", response_class=HTMLResponse)
def login_page(request: Request):
    user_id = request.session.get("user_id")
    if user_id:
        return RedirectResponse(url="/")
    return templates.TemplateResponse("login.html", {
        "request": request,
        "allow_guest": ALLOW_GUEST_LOGIN,
        "has_google": bool(GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET),
        "has_github": bool(GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET)
    })


# --- OAUTH AUTHENTICATION ROUTES ---

@app.get("/auth/login/guest")
def login_guest(request: Request):
    if not ALLOW_GUEST_LOGIN:
        raise HTTPException(status_code=400, detail="Guest login is disabled")
    user = get_or_create_user("guest@codeforge.ai", "Guest Developer", "", "guest", "guest_1")
    request.session["user_id"] = user["id"]
    return RedirectResponse(url="/")


@app.get("/auth/login/google")
def login_google():
    if not GOOGLE_CLIENT_ID:
        return RedirectResponse(url="/auth/login/guest") if ALLOW_GUEST_LOGIN else HTMLResponse("Google OAuth credentials missing in .env", status_code=400)
    redirect_uri = f"{APP_URL}/auth/callback/google"
    url = (
        f"https://accounts.google.com/o/oauth2/v2/auth?"
        f"response_type=code&client_id={GOOGLE_CLIENT_ID}&redirect_uri={redirect_uri}"
        f"&scope=openid%20email%20profile"
    )
    return RedirectResponse(url=url)


@app.get("/auth/callback/google")
async def callback_google(request: Request, code: str = None, error: str = None):
    if error or not code:
        return RedirectResponse(url="/login?error=google_auth_failed")
    
    redirect_uri = f"{APP_URL}/auth/callback/google"
    token_url = "https://oauth2.googleapis.com/token"
    
    async with httpx.AsyncClient() as client:
        res = await client.post(token_url, data={
            "code": code,
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "redirect_uri": redirect_uri,
            "grant_type": "authorization_code"
        })
        if res.status_code != 200:
            return RedirectResponse(url="/login?error=token_exchange_failed")
        
        tokens = res.json()
        access_token = tokens.get("access_token")
        
        user_info_res = await client.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {access_token}"}
        )
        if user_info_res.status_code != 200:
            return RedirectResponse(url="/login?error=user_info_failed")
        
        info = user_info_res.json()
        user = get_or_create_user(
            email=info.get("email"),
            name=info.get("name", "Google User"),
            avatar_url=info.get("picture", ""),
            provider="google",
            provider_id=info.get("sub", "")
        )
        request.session["user_id"] = user["id"]
        return RedirectResponse(url="/")


@app.get("/auth/login/github")
def login_github():
    if not GITHUB_CLIENT_ID:
        return RedirectResponse(url="/auth/login/guest") if ALLOW_GUEST_LOGIN else HTMLResponse("GitHub OAuth credentials missing in .env", status_code=400)
    redirect_uri = f"{APP_URL}/auth/callback/github"
    url = (
        f"https://github.com/login/oauth/authorize?"
        f"client_id={GITHUB_CLIENT_ID}&redirect_uri={redirect_uri}&scope=user:email"
    )
    return RedirectResponse(url=url)


@app.get("/auth/callback/github")
async def callback_github(request: Request, code: str = None, error: str = None):
    if error or not code:
        return RedirectResponse(url="/login?error=github_auth_failed")
    
    token_url = "https://github.com/login/oauth/access_token"
    async with httpx.AsyncClient() as client:
        res = await client.post(token_url, data={
            "client_id": GITHUB_CLIENT_ID,
            "client_secret": GITHUB_CLIENT_SECRET,
            "code": code
        }, headers={"Accept": "application/json"})
        
        if res.status_code != 200:
            return RedirectResponse(url="/login?error=token_exchange_failed")
        
        tokens = res.json()
        access_token = tokens.get("access_token")
        
        user_res = await client.get(
            "https://api.github.com/user",
            headers={"Authorization": f"Bearer {access_token}", "Accept": "application/json"}
        )
        if user_res.status_code != 200:
            return RedirectResponse(url="/login?error=user_info_failed")
        
        info = user_res.json()
        email = info.get("email")
        
        if not email:
            emails_res = await client.get(
                "https://api.github.com/user/emails",
                headers={"Authorization": f"Bearer {access_token}", "Accept": "application/json"}
            )
            if emails_res.status_code == 200:
                emails_list = emails_res.json()
                primary_email = next((e["email"] for e in emails_list if e.get("primary")), None)
                email = primary_email or (emails_list[0]["email"] if emails_list else f"{info['login']}@github.com")

        user = get_or_create_user(
            email=email,
            name=info.get("name") or info.get("login"),
            avatar_url=info.get("avatar_url", ""),
            provider="github",
            provider_id=str(info.get("id"))
        )
        request.session["user_id"] = user["id"]
        return RedirectResponse(url="/")


@app.get("/auth/logout")
def logout(request: Request):
    request.session.clear()
    return RedirectResponse(url="/login")


# --- PROTECTED API ENDPOINTS ---

@app.get("/api/me")
def api_me(user: dict = Depends(get_current_user)):
    return user


@app.get("/api/models")
def api_models():
    return {"models": AVAILABLE_MODELS, "default": DEFAULT_MODEL}


@app.get("/api/conversations")
def conversations(user: dict = Depends(get_current_user)):
    return list_conversations(user["id"])


@app.post("/api/conversations")
def new_conversation(user: dict = Depends(get_current_user)):
    cid = create_conversation(user["id"], title="New chat", model=DEFAULT_MODEL)
    return get_conversation(user["id"], cid)


@app.get("/api/conversations/{cid}")
def conversation(cid: int, user: dict = Depends(get_current_user)):
    data = get_conversation(user["id"], cid)
    if not data:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return data


@app.patch("/api/conversations/{cid}")
def rename(cid: int, body: RenameRequest, user: dict = Depends(get_current_user)):
    if body.title is not None:
        title = body.title.strip()[:80] or "New chat"
        rename_conversation(user["id"], cid, title)
    if body.model is not None:
        update_conversation_model(user["id"], cid, body.model)
    return get_conversation(user["id"], cid)


@app.delete("/api/conversations/{cid}")
def remove(cid: int, user: dict = Depends(get_current_user)):
    delete_conversation(user["id"], cid)
    return {"ok": True}


@app.post("/api/chat/stream")
async def chat_stream(body: ChatRequest, user: dict = Depends(get_current_user)):
    text = body.message.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    
    model = body.model or DEFAULT_MODEL
    cid = body.conversation_id
    
    if cid is None:
        title = text[:45] + ("…" if len(text) > 45 else "")
        cid = create_conversation(user["id"], title=title, model=model)
    
    conv = get_conversation(user["id"], cid)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    # Save user message
    add_message(cid, "user", text)
    conv = get_conversation(user["id"], cid)
    
    async def sse_event_generator():
        yield f"data: {json.dumps({'type': 'init', 'conversation_id': cid, 'title': conv['title']})}\n\n"
        
        full_response = ""
        async for chunk in generate_stream(conv["messages"], model=model):
            full_response += chunk
            yield f"data: {json.dumps({'type': 'token', 'token': chunk})}\n\n"
        
        # Save complete assistant message once streaming finishes
        add_message(cid, "assistant", full_response)
        yield f"data: {json.dumps({'type': 'done', 'conversation_id': cid})}\n\n"
        
    return StreamingResponse(sse_event_generator(), media_type="text/event-stream")


@app.post("/api/chat")
def chat(body: ChatRequest, user: dict = Depends(get_current_user)):
    text = body.message.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    
    model = body.model or DEFAULT_MODEL
    cid = body.conversation_id
    
    if cid is None:
        title = text[:45] + ("…" if len(text) > 45 else "")
        cid = create_conversation(user["id"], title=title, model=model)
        
    conv = get_conversation(user["id"], cid)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
        
    add_message(cid, "user", text)
    conv = get_conversation(user["id"], cid)
    
    answer = generate(conv["messages"], model=model)
    add_message(cid, "assistant", answer)
    
    return get_conversation(user["id"], cid)