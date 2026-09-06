let currentId = null;
let currentUser = null;
let isThinkMode = false;
let isRecording = false;
let attachedFiles = [];
let recognition = null;

// Functional Plugin States
let pluginsState = {
  codeInterpreter: true,
  webSearch: true,
  autoFormatter: true
};

const historyEl = document.getElementById("history");
const messagesEl = document.getElementById("messages");
const welcomeEl = document.getElementById("welcome");
const footerComposer = document.getElementById("footerComposer");
const promptEl = document.getElementById("prompt");
const promptChatEl = document.getElementById("promptChat");
const sidebar = document.querySelector(".sidebar");
const modelSelect = document.getElementById("modelSelect");

// Modal Elements
const modalBackdrop = document.getElementById("modalBackdrop");
const modalTitle = document.getElementById("modalTitle");
const modalBody = document.getElementById("modalBody");
const modalClose = document.getElementById("modalClose");

// File Attachment Elements
const fileInput = document.getElementById("fileInput");
const attachBtn = document.getElementById("attachBtn");
const attachBtnChat = document.getElementById("attachBtnChat");
const attachmentContainer = document.getElementById("attachmentContainer");
const attachmentContainerChat = document.getElementById("attachmentContainerChat");

// Think & Mic Elements
const thinkBtn = document.getElementById("thinkBtn");
const thinkBtnChat = document.getElementById("thinkBtnChat");
const micBtn = document.getElementById("micBtn");
const micBtnChat = document.getElementById("micBtnChat");

function escapeHtml(s) {
  return (s || "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]));
}

function parseMarkdown(text) {
  const blocks = [];
  let html = text.replace(/```([\w#+.-]*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    const id = blocks.length;
    const langClass = lang ? `language-${escapeHtml(lang)}` : '';
    const displayLang = lang ? escapeHtml(lang) : 'code';
    blocks.push(`
      <pre>
        <div class="code-header">
          <span>${displayLang}</span>
          <button class="copy-code-btn" onclick="copyCode(this)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            Copy code
          </button>
        </div>
        <code class="${langClass}">${escapeHtml(code.trim())}</code>
      </pre>
    `);
    return `@@CODE_BLOCK_${id}@@`;
  });

  html = escapeHtml(html).replace(/\n/g, "<br>");
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

  blocks.forEach((b, i) => {
    html = html.replace(`@@CODE_BLOCK_${i}@@`, b);
  });
  return html;
}

window.copyCode = async btn => {
  const code = btn.parentElement.parentElement.querySelector("code").innerText;
  await navigator.clipboard.writeText(code);
  btn.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
    Copied!
  `;
  setTimeout(() => {
    btn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
      </svg>
      Copy code
    `;
  }, 1600);
};

async function api(url, opts = {}) {
  const r = await fetch(url, { headers: { "Content-Type": "application/json" }, ...opts });
  if (r.status === 401) {
    window.location.href = "/login";
    return;
  }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.detail || "Request failed");
  return data;
}

async function initUser() {
  try {
    currentUser = await api("/api/me");
    if (currentUser) {
      document.getElementById("userName").textContent = currentUser.name;
      const firstName = currentUser.name.split(" ")[0] || "Developer";
      document.getElementById("heroGreeting").textContent = `Hey, ${firstName}. Ready to dive in?`;
      
      const avatarEl = document.getElementById("userAvatar");
      if (currentUser.avatar_url) {
        avatarEl.src = currentUser.avatar_url;
      } else {
        avatarEl.style.display = "none";
      }
    }
  } catch (e) {
    window.location.href = "/login";
  }
}

async function initModels() {
  try {
    const data = await api("/api/models");
    modelSelect.innerHTML = "";
    data.models.forEach(m => {
      const opt = document.createElement("option");
      opt.value = m.id;
      opt.textContent = m.name;
      if (m.id === data.default) opt.selected = true;
      modelSelect.appendChild(opt);
    });
  } catch (e) {
    console.error("Failed to load models", e);
  }
}

async function refreshHistory() {
  const rows = await api("/api/conversations");
  if (!rows) return;
  historyEl.innerHTML = "";
  rows.forEach(c => {
    const wrap = document.createElement("div");
    wrap.className = `history-item ${c.id === currentId ? 'active' : ''}`;
    const b = document.createElement("button");
    b.className = "title";
    b.textContent = c.title;
    b.onclick = () => loadConversation(c.id);
    wrap.appendChild(b);
    historyEl.appendChild(wrap);
  });
}

function renderConversation(c) {
  currentId = c?.id || null;
  messagesEl.innerHTML = "";
  const msgs = c?.messages || [];
  
  if (msgs.length) {
    welcomeEl.style.display = "none";
    footerComposer.style.display = "flex";
  } else {
    welcomeEl.style.display = "flex";
    footerComposer.style.display = "none";
  }

  msgs.forEach(m => {
    appendMessageUI(m.role, m.content);
  });

  if (window.hljs) hljs.highlightAll();
  const chatSec = document.getElementById("chat");
  chatSec.scrollTop = chatSec.scrollHeight;
  refreshHistory();
}

function appendMessageUI(role, contentText) {
  const div = document.createElement("div");
  div.className = `message ${role}`;
  const isUser = role === "user";
  
  const userAvatarHtml = currentUser?.avatar_url 
    ? `<img src="${currentUser.avatar_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
    : (currentUser?.name?.[0] || "U");

  const avatarContent = isUser 
    ? userAvatarHtml 
    : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
  
  div.innerHTML = `
    <div class="message-inner">
      <div class="avatar">${avatarContent}</div>
      <div class="bubble">
        <div class="content">${parseMarkdown(contentText)}</div>
      </div>
    </div>
  `;
  messagesEl.appendChild(div);
  return div;
}

async function loadConversation(id) {
  const c = await api(`/api/conversations/${id}`);
  renderConversation(c);
  sidebar.classList.remove("open");
}

/* 1. FILE ATTACHMENT FUNCTIONALITY */
[attachBtn, attachBtnChat].forEach(btn => {
  if (btn) btn.onclick = () => fileInput.click();
});

fileInput.onchange = (e) => {
  const files = Array.from(e.target.files);
  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = (event) => {
      attachedFiles.push({ name: file.name, content: event.target.result });
      renderAttachments();
    };
    reader.readAsText(file);
  });
  fileInput.value = "";
};

function renderAttachments() {
  [attachmentContainer, attachmentContainerChat].forEach(container => {
    if (!container) return;
    container.innerHTML = "";
    attachedFiles.forEach((f, idx) => {
      const badge = document.createElement("div");
      badge.className = "attachment-badge";
      badge.innerHTML = `📄 ${escapeHtml(f.name)} <span class="remove-btn" onclick="removeAttachment(${idx})">✕</span>`;
      container.appendChild(badge);
    });
  });
}

window.removeAttachment = (idx) => {
  attachedFiles.splice(idx, 1);
  renderAttachments();
};

/* 2. THINK REASONING MODE TOGGLE */
function toggleThinkMode() {
  isThinkMode = !isThinkMode;
  [thinkBtn, thinkBtnChat].forEach(btn => {
    if (!btn) return;
    if (isThinkMode) {
      btn.classList.add("active");
      btn.querySelector("span").textContent = "Think ✓";
    } else {
      btn.classList.remove("active");
      btn.querySelector("span").textContent = "Think";
    }
  });
}

if (thinkBtn) thinkBtn.onclick = toggleThinkMode;
if (thinkBtnChat) thinkBtnChat.onclick = toggleThinkMode;

/* 3. VOICE DICTATION (SPEECH RECOGNITION) */
function toggleVoiceInput() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    alert("Speech recognition is not supported in this browser. Please use Chrome or Edge.");
    return;
  }

  if (isRecording) {
    recognition?.stop();
    return;
  }

  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onstart = () => {
    isRecording = true;
    [micBtn, micBtnChat].forEach(b => b?.classList.add("recording"));
  };

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    const activeEl = welcomeEl.style.display !== "none" ? promptEl : promptChatEl;
    activeEl.value += (activeEl.value ? " " : "") + transcript;
    resizePrompt(activeEl);
  };

  recognition.onend = () => {
    isRecording = false;
    [micBtn, micBtnChat].forEach(b => b?.classList.remove("recording"));
  };

  recognition.start();
}

if (micBtn) micBtn.onclick = toggleVoiceInput;
if (micBtnChat) micBtnChat.onclick = toggleVoiceInput;

/* 4. MODAL UTILITIES & SIDEBAR NAVIGATION FUNCTIONS */
function openModal(title, htmlContent) {
  modalTitle.textContent = title;
  modalBody.innerHTML = htmlContent;
  modalBackdrop.style.display = "flex";
}

function closeModal() {
  modalBackdrop.style.display = "none";
}

modalClose.onclick = closeModal;
modalBackdrop.onclick = (e) => {
  if (e.target === modalBackdrop) closeModal();
};

document.getElementById("navLibrary").onclick = async () => {
  const rows = await api("/api/conversations");
  let contentHtml = `
    <p style="color:var(--text-muted);">All your saved coding conversations and project histories:</p>
    <div style="display:flex;flex-direction:column;gap:0.5rem;max-height:350px;overflow-y:auto;">
  `;
  rows.forEach(c => {
    contentHtml += `
      <div style="background:#212121;padding:0.75rem 1rem;border-radius:8px;display:flex;justify-content:space-between;align-items:center;">
        <div>
          <strong style="color:var(--text-primary);">${escapeHtml(c.title)}</strong>
          <div style="font-size:0.75rem;color:var(--text-muted);">${c.created_at.split("T")[0]}</div>
        </div>
        <button onclick="closeModal();loadConversation(${c.id});" style="background:var(--accent-green);border:none;color:#fff;padding:0.35rem 0.75rem;border-radius:6px;cursor:pointer;font-size:0.8rem;">Open</button>
      </div>
    `;
  });
  contentHtml += `</div>`;
  openModal("Conversations Library", contentHtml);
};

/* =========================================================
   PROJECTS
   ========================================================= */

let projects = JSON.parse(localStorage.getItem("codemind_projects") || "[]");

function saveProjects() {
  localStorage.setItem("codemind_projects", JSON.stringify(projects));
}

function renderProjectsPage() {
  openModal("Projects", `
    <div class="projects-page">
      <div class="projects-toolbar">
        <div class="project-search">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="7"></circle>
            <line x1="16.5" y1="16.5" x2="21" y2="21"></line>
          </svg>
          <input id="projectSearch" type="text" placeholder="Search projects" autocomplete="off">
        </div>
        <button id="newProjectBtn" class="project-new-btn">New</button>
      </div>
      <div class="project-tabs">
        <button class="project-tab active" data-tab="all">All</button>
        <button class="project-tab" data-tab="created">Created by you</button>
        <button class="project-tab" data-tab="shared">Shared with you</button>
      </div>
      <div id="projectsGrid" class="projects-grid"></div>
    </div>
  `);

  renderProjectCards();

  document.getElementById("newProjectBtn").onclick = openCreateProject;
  document.getElementById("projectSearch").oninput = e => renderProjectCards(e.target.value);

  document.querySelectorAll(".project-tab").forEach(tab => {
    tab.onclick = () => {
      document.querySelectorAll(".project-tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      renderProjectCards(document.getElementById("projectSearch").value);
    };
  });
}

function renderProjectCards(search = "") {
  const grid = document.getElementById("projectsGrid");
  if (!grid) return;

  const query = search.toLowerCase().trim();
  const filtered = projects.filter(p => p.name.toLowerCase().includes(query));

  if (!filtered.length) {
    grid.innerHTML = `
      <div class="projects-empty">
        <div class="projects-empty-icon">✦</div>
        <h3>No projects yet</h3>
        <p>Create a project to keep related chats, files and instructions together.</p>
        <button id="emptyNewProject" class="project-new-btn">New project</button>
      </div>`;
    document.getElementById("emptyNewProject").onclick = openCreateProject;
    return;
  }

  grid.innerHTML = filtered.map(project => `
    <div class="project-card" data-project-id="${project.id}">
      <div class="project-card-top">
        <div class="project-icon">${project.icon || "✦"}</div>
        <button class="project-menu" data-menu-id="${project.id}" aria-label="Project options">•••</button>
      </div>
      <div class="project-card-name">${escapeHtml(project.name)}</div>
      <div class="project-card-description">${escapeHtml(project.description || "No description")}</div>
      <div class="project-card-date">Created ${escapeHtml(project.createdAt)}</div>
    </div>`).join("");

  grid.querySelectorAll(".project-card").forEach(card => {
    card.onclick = () => {
      const project = projects.find(p => String(p.id) === String(card.dataset.projectId));
      if (project) openProject(project);
    };
  });

  grid.querySelectorAll(".project-menu").forEach(btn => {
    btn.onclick = e => {
      e.stopPropagation();
      openProjectMenu(btn.dataset.menuId);
    };
  });
}

function openCreateProject() {
  openModal("Create project", `
    <div class="create-project-form">
      <label>Project name</label>
      <input id="projectNameInput" class="project-name-input" type="text" placeholder="Copenhagen Trip" autofocus>
      <div class="project-info-box">
        <div class="project-info-icon">♧</div>
        <div>
          <strong>Projects keep chats, files, and custom instructions in one place.</strong>
          <p>Use them for ongoing work, or just to keep things tidy.</p>
        </div>
      </div>
      <div class="project-memory-row">
        <button id="memoryBtn" class="memory-btn">Default memory <span>⌄</span></button>
        <div id="memoryOptions" class="memory-options" style="display:none;">
          <button>Default memory</button>
          <button>Project-only memory</button>
        </div>
      </div>
      <div class="create-project-actions">
        <button id="cancelProjectBtn" class="project-cancel-btn">Cancel</button>
        <button id="createProjectBtn" class="project-create-btn">Create project</button>
      </div>
    </div>`);

  const input = document.getElementById("projectNameInput");
  input.focus();

  document.getElementById("createProjectBtn").onclick = () => {
    const name = input.value.trim();
    if (!name) { input.focus(); return; }

    projects.unshift({
      id: Date.now(),
      name,
      description: "New CodeMind project",
      icon: "✦",
      memory: "default",
      createdAt: new Date().toLocaleDateString()
    });

    saveProjects();
    renderProjectsPage();
  };

  document.getElementById("cancelProjectBtn").onclick = renderProjectsPage;

  const memoryBtn = document.getElementById("memoryBtn");
  const memoryOptions = document.getElementById("memoryOptions");

  memoryBtn.onclick = () => {
    memoryOptions.style.display = memoryOptions.style.display === "none" ? "flex" : "none";
  };

  memoryOptions.querySelectorAll("button").forEach(button => {
    button.onclick = () => {
      memoryBtn.innerHTML = `${button.textContent} <span>⌄</span>`;
      memoryOptions.style.display = "none";
    };
  });
}

function openProject(project) {
  openModal(project.name, `
    <div class="project-open-view">
      <div class="project-open-icon">${project.icon || "✦"}</div>
      <h2>${escapeHtml(project.name)}</h2>
      <p>${escapeHtml(project.description || "Your project workspace")}</p>
      <div class="project-open-actions">
        <button id="startProjectChat" class="project-new-btn">Start new chat</button>
        <button id="projectSettingsBtn" class="project-secondary-btn">Project settings</button>
      </div>
    </div>`);

  document.getElementById("startProjectChat").onclick = () => {
    closeModal();
    const btn = document.getElementById("newChat");
    if (btn) btn.click();
  };

  document.getElementById("projectSettingsBtn").onclick = () => editProject(project.id);
}

function openProjectMenu(id) {
  const project = projects.find(p => String(p.id) === String(id));
  if (!project) return;

  openModal("Project options", `
    <div class="project-options">
      <button id="renameProjectOption">Rename project</button>
      <button id="deleteProjectOption" class="danger-option">Delete project</button>
    </div>`);

  document.getElementById("renameProjectOption").onclick = () => editProject(project.id);
  document.getElementById("deleteProjectOption").onclick = () => deleteProject(project.id);
}

function editProject(id) {
  const project = projects.find(p => String(p.id) === String(id));
  if (!project) return;

  openModal("Project settings", `
    <div class="create-project-form">
      <label>Project name</label>
      <input id="editProjectName" class="project-name-input" value="${escapeHtml(project.name)}">
      <div class="create-project-actions">
        <button id="editCancelBtn" class="project-cancel-btn">Cancel</button>
        <button id="editSaveBtn" class="project-create-btn">Save</button>
      </div>
    </div>`);

  document.getElementById("editCancelBtn").onclick = renderProjectsPage;
  document.getElementById("editSaveBtn").onclick = () => {
    const input = document.getElementById("editProjectName");
    if (!input.value.trim()) return;
    project.name = input.value.trim();
    saveProjects();
    renderProjectsPage();
  };
}

function deleteProject(id) {
  const project = projects.find(p => String(p.id) === String(id));
  if (!project) return;
  if (!confirm(`Delete "${project.name}"?`)) return;

  projects = projects.filter(p => String(p.id) !== String(id));
  saveProjects();
  renderProjectsPage();
}

const projectsNavButton = document.getElementById("navProjects");
if (projectsNavButton) projectsNavButton.onclick = renderProjectsPage;


document.getElementById("navScheduled").onclick = () => {
  openModal("Scheduled Reminders & Code Health", `
    <p style="color:var(--text-muted);">Schedule automated AI code reviews or project reminders:</p>
    <div style="background:#212121;padding:1rem;border-radius:10px;display:flex;flex-direction:column;gap:0.75rem;">
      <div>
        <label style="font-size:0.8rem;color:var(--text-secondary);">Task Title:</label>
        <input type="text" value="Weekly Code Refactoring Check" style="width:100%;background:#171717;border:1px solid var(--border-subtle);color:#fff;padding:0.5rem;border-radius:6px;margin-top:0.25rem;">
      </div>
      <div>
        <label style="font-size:0.8rem;color:var(--text-secondary);">Frequency:</label>
        <select style="width:100%;background:#171717;border:1px solid var(--border-subtle);color:#fff;padding:0.5rem;border-radius:6px;margin-top:0.25rem;">
          <option>Every Monday at 9:00 AM</option>
          <option>Daily Code Health Check</option>
        </select>
      </div>
      <button onclick="alert('Scheduled task created!');closeModal();" style="background:var(--accent-green);border:none;color:#fff;padding:0.5rem;border-radius:6px;cursor:pointer;">Set Schedule</button>
    </div>
  `);
};

/* SEND CHAT MESSAGE WITH ATTACHMENTS & THINK MODE */
async function send(inputSource) {
  const inputEl = inputSource || (welcomeEl.style.display !== "none" ? promptEl : promptChatEl);
  let rawMessage = inputEl.value.trim();
  if (!rawMessage && attachedFiles.length === 0) return;

  // Append File Attachments Content
  let finalPrompt = rawMessage;
  if (attachedFiles.length > 0) {
    let fileText = "\n\n--- ATTACHED CODE / FILES ---\n";
    attachedFiles.forEach(f => {
      fileText += `File: ${f.name}\n\`\`\`\n${f.content}\n\`\`\`\n`;
    });
    finalPrompt += fileText;
    attachedFiles = [];
    renderAttachments();
  }

  // Prepend Deep Reasoning instruction if Think Mode is Active
  if (isThinkMode) {
    finalPrompt = "[THINK REASONING MODE: Please analyze the problem step-by-step with deep reasoning before providing the final implementation.]\n" + finalPrompt;
  }

  inputEl.value = "";
  resizePrompt(inputEl);

  welcomeEl.style.display = "none";
  footerComposer.style.display = "flex";

  // Render User Message
  appendMessageUI("user", rawMessage || "Attached files for review.");

  // Render Assistant Loading Bubble
  const loadDiv = document.createElement("div");
  loadDiv.className = "message assistant";
  loadDiv.innerHTML = `
    <div class="message-inner">
      <div class="avatar">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
      </div>
      <div class="bubble">
        <div class="content"><span class="streaming-cursor"></span></div>
      </div>
    </div>
  `;
  messagesEl.appendChild(loadDiv);
  const contentEl = loadDiv.querySelector(".content");

  const chatSec = document.getElementById("chat");
  chatSec.scrollTop = chatSec.scrollHeight;

  const selectedModel = isThinkMode ? "openai/gpt-oss-120b" : modelSelect.value;
  let responseText = "";

  try {
    const response = await fetch("/api/chat/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversation_id: currentId,
        message: finalPrompt,
        model: selectedModel
      })
    });

    if (response.status === 401) {
      window.location.href = "/login";
      return;
    }

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.detail || "Error connecting to AI stream");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const jsonStr = line.replace("data: ", "").trim();
          try {
            const parsed = JSON.parse(jsonStr);
            if (parsed.type === "init") {
              currentId = parsed.conversation_id;
            } else if (parsed.type === "token") {
              responseText += parsed.token;
              contentEl.innerHTML = parseMarkdown(responseText) + '<span class="streaming-cursor"></span>';
              chatSec.scrollTop = chatSec.scrollHeight;
            } else if (parsed.type === "done") {
              contentEl.innerHTML = parseMarkdown(responseText);
              if (window.hljs) hljs.highlightAll();
              refreshHistory();
            }
          } catch (e) {
            console.error("SSE parse error", e);
          }
        }
      }
    }
  } catch (e) {
    contentEl.innerHTML = `<span style="color:#ef4444;">Error: ${escapeHtml(e.message)}</span>`;
  }
}

function resizePrompt(el) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 180) + "px";
}

[promptEl, promptChatEl].forEach(el => {
  if (!el) return;
  el.addEventListener("input", () => resizePrompt(el));
  el.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(el);
    }
  });
});

document.getElementById("sendBtn").onclick = () => send(promptEl);
const sendBtnChat = document.getElementById("sendBtnChat");
if (sendBtnChat) sendBtnChat.onclick = () => send(promptChatEl);

document.getElementById("newChat").onclick = () => renderConversation(null);
document.getElementById("themeBtn").onclick = () => document.body.classList.toggle("light");
document.getElementById("mobileMenu").onclick = () => {
  sidebar.classList.toggle("sidebar-hidden");
};

document.querySelectorAll("[data-prompt]").forEach(b => {
  b.onclick = () => {
    const activeEl = welcomeEl.style.display !== "none" ? promptEl : promptChatEl;
    activeEl.value = b.dataset.prompt;
    activeEl.focus();
    resizePrompt(activeEl);
  };
});

document.getElementById("deleteBtn").onclick = async () => {
  if (!currentId) return;
  if (confirm("Are you sure you want to delete this conversation?")) {
    await api(`/api/conversations/${currentId}`, { method: "DELETE" });
    renderConversation(null);
    await refreshHistory();
  }
};

document.getElementById("exportBtn").onclick = async () => {
  if (!currentId) return alert("Open a conversation first.");
  const c = await api(`/api/conversations/${currentId}`);
  const text = c.messages.map(m => `${m.role.toUpperCase()}:\n${m.content}\n`).join("\n---\n\n");
  const blob = new Blob([text], { type: "text/plain" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${c.title.replace(/[^\w-]+/g, "_")}.txt`;
  a.click();
  URL.revokeObjectURL(a.href);
};

// Initialize Application
(async () => {
  await initUser();
  await initModels();
  await refreshHistory();
})();


/* =========================================================
   HEADER CONTROLS
   ========================================================= */

const shareBtn = document.getElementById("shareBtn");
if (shareBtn) {
  shareBtn.onclick = async () => {
    if (!currentId) {
      alert("Start a conversation before sharing.");
      return;
    }

    const shareUrl = `${window.location.origin}/?conversation=${currentId}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: "CodeMind conversation",
          text: "Check out this CodeMind conversation.",
          url: shareUrl
        });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
        alert("Conversation link copied to clipboard.");
      } else {
        prompt("Copy this conversation link:", shareUrl);
      }
    } catch (error) {
      console.log("Share cancelled.");
    }
  };
}

const moreBtn = document.getElementById("moreBtn");
if (moreBtn) {
  moreBtn.onclick = () => {
    openModal("More options", `
      <div class="more-menu">
        <button id="moreNewChat">New chat</button>
        <button id="moreExport">Export conversation</button>
        <button id="moreDelete" class="danger-option">Delete conversation</button>
      </div>`);

    document.getElementById("moreNewChat").onclick = () => {
      closeModal();
      const btn = document.getElementById("newChat");
      if (btn) btn.click();
    };

    document.getElementById("moreExport").onclick = () => {
      closeModal();
      const btn = document.getElementById("exportBtn");
      if (btn) btn.click();
    };

    document.getElementById("moreDelete").onclick = () => {
      closeModal();
      const btn = document.getElementById("deleteBtn");
      if (btn) btn.click();
    };
  };
}
