/**
 * Artio — Chat Widget IA flottant
 * À inclure sur toutes les pages après supabase-js
 * Conversation persistante via localStorage
 */

(function () {
  // ── CONFIG ────────────────────────────────────────────
  const SUPABASE_URL = "https://mwmexkoeqeyueqgdkkni.supabase.co";
  const SUPABASE_KEY = "sb_publishable_dbf0DrGQr377jyftcE-rYw_SK5nzZJw";
  const STORAGE_KEY   = "artio_chat_history";
  const MODEL         = "claude-sonnet-4-20250514";
  const MAX_TOKENS    = 512;

  const SYSTEM_PROMPT = `Tu es l'assistant IA d'Artio, une application SaaS pour les professionnels indépendants français (freelancers, artisans, coaches, photographes, etc.).

Artio permet de :
- Générer des devis et factures par dictée vocale (IA)
- Gérer les dossiers clients
- Suivre les finances (tableau de bord, KPIs)
- Gérer le calendrier et les rendez-vous
- Signer électroniquement les documents
- Gérer les paramètres de l'entreprise

Tu aides les utilisateurs à naviguer dans l'application, comprendre ses fonctionnalités et résoudre leurs problèmes. Réponds en français, de façon concise (3-4 phrases max), bienveillante et pratique.

RÈGLE IMPORTANTE : Quand tu sens que la question de l'utilisateur est résolue (tu as donné une réponse complète et satisfaisante), termine NATURELLEMENT ta réponse en ajoutant "Y a-t-il autre chose que je puisse faire pour vous ?" ou "Est-ce que cela répond à votre question ?" — mais seulement si la réponse est vraiment complète. Ne le fais pas si l'utilisateur est encore en train d'expliquer son problème ou si la conversation est en cours. Si l'utilisateur dit "non merci", "c'est bon", "merci", "parfait", "ok merci" ou similaire, réponds chaleureusement et termine par [CONVERSATION_CLOSE].`;

  // ── STATE ─────────────────────────────────────────────
  let apiKey        = null;
  let isOpen        = false;
  let isLoading     = false;
  let history       = loadHistory();
  let inactivityTimer = null;
  const INACTIVITY_MS = 10 * 60 * 1000; // 10 minutes

  // ── INIT SUPABASE & CLÉ API ───────────────────────────
  async function initApiKey() {
    try {
      const sbClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
      const { data: { session } } = await sbClient.auth.getSession();
      if (!session) return;
      const { data: profil } = await sbClient
        .from("profils")
        .select("api_key")
        .eq("user_id", session.user.id)
        .single();
      if (profil?.api_key) apiKey = profil.api_key;
    } catch (e) {
      console.warn("Chat widget: impossible de charger la clé API", e.message);
    }
  }

  // ── INACTIVITÉ ────────────────────────────────────────
  function resetInactivityTimer() {
    if (inactivityTimer) clearTimeout(inactivityTimer);
    if (history.length === 0) return;
    inactivityTimer = setTimeout(() => {
      // Clôture automatique après 10 min d'inactivité
      history.push({ role: "assistant", content: "Cette conversation a été fermée automatiquement après 10 minutes d'inactivité. N'hésitez pas à revenir si vous avez d'autres questions ! 👋" });
      saveHistory();
      renderMessages();
      setTimeout(() => {
        clearHistory();
        renderMessages();
      }, 4000);
    }, INACTIVITY_MS);
  }

  // ── DÉTECTION CLÔTURE NATURELLE ───────────────────────
  function checkAndClose(reply) {
    if (reply.includes("[CONVERSATION_CLOSE]")) {
      const cleanReply = reply.replace("[CONVERSATION_CLOSE]", "").trim();
      history[history.length - 1].content = cleanReply;
      saveHistory();
      renderMessages();
      // Fermer après 3 secondes
      setTimeout(() => {
        clearHistory();
        renderMessages();
        if (inactivityTimer) clearTimeout(inactivityTimer);
      }, 3000);
      return true;
    }
    return false;
  }

  // ── PERSISTENCE ───────────────────────────────────────
  function loadHistory() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch { return []; }
  }

  function saveHistory() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch {}
  }

  function clearHistory() {
    history = [];
    localStorage.removeItem(STORAGE_KEY);
  }

  // ── HTML DU WIDGET ────────────────────────────────────
  function buildWidget() {
    const style = document.createElement("style");
    style.textContent = `
      #artio-chat-bubble {
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 9999;
        font-family: 'Plus Jakarta Sans', 'Space Grotesk', sans-serif;
      }

      #artio-chat-btn {
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background: #f5a742;
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 20px rgba(245,167,66,0.4);
        transition: transform .2s, box-shadow .2s;
        position: relative;
      }
      #artio-chat-btn:hover {
        transform: scale(1.08);
        box-shadow: 0 6px 24px rgba(245,167,66,0.5);
      }
      #artio-chat-btn svg { color: #080b14; }

      #artio-chat-badge {
        position: absolute;
        top: -2px;
        right: -2px;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: #3ecfcf;
        border: 2px solid #080b14;
        display: none;
      }

      #artio-chat-panel {
        position: absolute;
        bottom: 68px;
        right: 0;
        width: 340px;
        max-height: 520px;
        background: #0e1220;
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 16px;
        box-shadow: 0 16px 48px rgba(0,0,0,0.5);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        opacity: 0;
        transform: translateY(12px) scale(0.97);
        pointer-events: none;
        transition: opacity .2s, transform .2s;
      }
      #artio-chat-panel.open {
        opacity: 1;
        transform: translateY(0) scale(1);
        pointer-events: all;
      }

      #artio-chat-header {
        padding: 14px 16px;
        background: #141829;
        border-bottom: 1px solid rgba(255,255,255,0.07);
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      #artio-chat-header-left {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .artio-avatar {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: linear-gradient(135deg, #f5a742, #3ecfcf);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        font-weight: 700;
        color: #080b14;
      }
      #artio-chat-header-title {
        font-family: 'Space Grotesk', sans-serif;
        font-size: 14px;
        font-weight: 600;
        color: #e2e5f1;
      }
      #artio-chat-header-sub {
        font-size: 11px;
        color: #6b7494;
        margin-top: 1px;
      }
      #artio-chat-close {
        background: none;
        border: none;
        color: #6b7494;
        cursor: pointer;
        padding: 4px;
        border-radius: 6px;
        display: flex;
        align-items: center;
        transition: color .2s;
      }
      #artio-chat-close:hover { color: #e2e5f1; }

      #artio-chat-messages {
        flex: 1;
        overflow-y: auto;
        padding: 14px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        scroll-behavior: smooth;
      }
      #artio-chat-messages::-webkit-scrollbar { width: 4px; }
      #artio-chat-messages::-webkit-scrollbar-thumb {
        background: rgba(255,255,255,0.1);
        border-radius: 2px;
      }

      .artio-msg {
        max-width: 85%;
        padding: 9px 12px;
        border-radius: 12px;
        font-size: 13px;
        line-height: 1.5;
        word-break: break-word;
      }
      .artio-msg.user {
        background: rgba(245,167,66,0.15);
        color: #e2e5f1;
        border: 1px solid rgba(245,167,66,0.25);
        align-self: flex-end;
        border-bottom-right-radius: 4px;
      }
      .artio-msg.bot {
        background: #1a2035;
        color: #e2e5f1;
        border: 1px solid rgba(255,255,255,0.07);
        align-self: flex-start;
        border-bottom-left-radius: 4px;
      }
      .artio-msg.typing {
        background: #1a2035;
        border: 1px solid rgba(255,255,255,0.07);
        align-self: flex-start;
        padding: 12px 16px;
      }
      .artio-dots {
        display: flex;
        gap: 4px;
        align-items: center;
      }
      .artio-dots span {
        width: 6px;
        height: 6px;
        background: #6b7494;
        border-radius: 50%;
        animation: artio-bounce 1.2s infinite;
      }
      .artio-dots span:nth-child(2) { animation-delay: .2s; }
      .artio-dots span:nth-child(3) { animation-delay: .4s; }
      @keyframes artio-bounce {
        0%, 60%, 100% { transform: translateY(0); }
        30% { transform: translateY(-5px); }
      }

      #artio-chat-resolved {
        margin: 0 14px 10px;
        padding: 10px 12px;
        background: rgba(62,207,207,0.08);
        border: 1px solid rgba(62,207,207,0.2);
        border-radius: 10px;
        font-size: 12px;
        color: #e2e5f1;
        text-align: center;
        display: none;
      }
      #artio-chat-resolved p { margin-bottom: 8px; color: #a0a8c0; }
      #artio-resolved-btns {
        display: flex;
        gap: 8px;
        justify-content: center;
      }
      .artio-resolved-btn {
        padding: 5px 12px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        border: none;
        transition: opacity .2s;
      }
      .artio-resolved-btn.yes {
        background: #3ecfcf;
        color: #080b14;
      }
      .artio-resolved-btn.no {
        background: rgba(255,255,255,0.08);
        color: #e2e5f1;
        border: 1px solid rgba(255,255,255,0.12);
      }
      .artio-resolved-btn:hover { opacity: 0.85; }

      #artio-chat-footer {
        padding: 10px 12px;
        border-top: 1px solid rgba(255,255,255,0.07);
        display: flex;
        gap: 8px;
        align-items: center;
        background: #0e1220;
      }
      #artio-chat-input {
        flex: 1;
        background: #1a2035;
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 10px;
        padding: 8px 12px;
        font-size: 13px;
        color: #e2e5f1;
        font-family: inherit;
        outline: none;
        resize: none;
        max-height: 80px;
        transition: border-color .2s;
      }
      #artio-chat-input:focus { border-color: rgba(245,167,66,0.4); }
      #artio-chat-input::placeholder { color: #6b7494; }
      #artio-chat-send {
        width: 36px;
        height: 36px;
        border-radius: 10px;
        background: #f5a742;
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        transition: opacity .2s, transform .1s;
      }
      #artio-chat-send:hover { opacity: 0.85; transform: scale(1.05); }
      #artio-chat-send:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }

      .artio-chat-empty {
        text-align: center;
        color: #6b7494;
        font-size: 12px;
        margin: auto;
        padding: 20px;
        line-height: 1.7;
      }
      .artio-chat-empty strong {
        display: block;
        color: #e2e5f1;
        font-size: 13px;
        margin-bottom: 6px;
      }

      @media (max-width: 400px) {
        #artio-chat-panel { width: calc(100vw - 32px); right: 0; }
      }
    `;
    document.head.appendChild(style);

    const wrapper = document.createElement("div");
    wrapper.id = "artio-chat-bubble";
    wrapper.innerHTML = `
      <!-- Panel -->
      <div id="artio-chat-panel">
        <!-- Header -->
        <div id="artio-chat-header">
          <div id="artio-chat-header-left">
            <div class="artio-avatar">A</div>
            <div>
              <div id="artio-chat-header-title">Assistant Artio</div>
              <div id="artio-chat-header-sub">Disponible pour vous aider</div>
            </div>
          </div>
          <button id="artio-chat-close" title="Fermer">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <!-- Messages -->
        <div id="artio-chat-messages"></div>

        <!-- Résolu ? -->
        <div id="artio-chat-resolved">
          <p>Avons-nous répondu à vos questions ?</p>
          <div id="artio-resolved-btns">
            <button class="artio-resolved-btn yes" id="artio-btn-yes">✓ Oui, merci !</button>
            <button class="artio-resolved-btn no" id="artio-btn-no">Non, continuer</button>
          </div>
        </div>

        <!-- Footer input -->
        <div id="artio-chat-footer">
          <textarea
            id="artio-chat-input"
            placeholder="Posez votre question…"
            rows="1"
          ></textarea>
          <button id="artio-chat-send" title="Envoyer">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#080b14" stroke-width="2.5" stroke-linecap="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </div>
      </div>

      <!-- Bouton bulle -->
      <button id="artio-chat-btn" title="Aide IA Artio">
        <div id="artio-chat-badge"></div>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
      </button>
    `;
    document.body.appendChild(wrapper);
  }

  // ── RENDER MESSAGES ───────────────────────────────────
  function renderMessages() {
    const container = document.getElementById("artio-chat-messages");
    if (!container) return;
    container.innerHTML = "";

    if (history.length === 0) {
      container.innerHTML = `
        <div class="artio-chat-empty">
          <strong>Bonjour ! 👋</strong>
          Posez-moi vos questions sur Artio — devis, factures, clients, paramètres…
          Je suis là pour vous aider.
        </div>
      `;
      return;
    }

    history.forEach(msg => {
      const div = document.createElement("div");
      div.className = `artio-msg ${msg.role === "user" ? "user" : "bot"}`;
      div.textContent = msg.content;
      container.appendChild(div);
    });

    container.scrollTop = container.scrollHeight;
  }

  function showTyping() {
    const container = document.getElementById("artio-chat-messages");
    if (!container) return;
    const div = document.createElement("div");
    div.className = "artio-msg typing";
    div.id = "artio-typing";
    div.innerHTML = `<div class="artio-dots"><span></span><span></span><span></span></div>`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  function removeTyping() {
    const el = document.getElementById("artio-typing");
    if (el) el.remove();
  }

  // ── ENVOYER MESSAGE ───────────────────────────────────
  async function sendMessage() {
    const input = document.getElementById("artio-chat-input");
    const sendBtn = document.getElementById("artio-chat-send");
    if (!input || isLoading) return;

    const text = input.value.trim();
    if (!text) return;

    input.value = "";
    input.style.height = "auto";
    isLoading = true;
    if (sendBtn) sendBtn.disabled = true;
    resetInactivityTimer();

    // Ajouter message utilisateur
    history.push({ role: "user", content: text });
    saveHistory();
    renderMessages();
    showTyping();

    let reply;

    if (apiKey) {
      try {
        // Construire les messages pour Claude (max 20 derniers)
        const messages = history.slice(-20).map(m => ({
          role: m.role,
          content: m.content
        }));

        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "anthropic-dangerous-direct-browser-access": "true"
          },
          body: JSON.stringify({
            model: MODEL,
            max_tokens: MAX_TOKENS,
            system: SYSTEM_PROMPT,
            messages: messages
          })
        });

        if (res.ok) {
          const data = await res.json();
          reply = data.content?.[0]?.text || fallback(text);
        } else {
          reply = fallback(text);
        }
      } catch (e) {
        reply = fallback(text);
      }
    } else {
      reply = fallback(text);
    }

    removeTyping();

    // Vérifier si clôture naturelle détectée
    const closed = checkAndClose(reply);
    if (!closed) {
      history.push({ role: "assistant", content: reply });
      saveHistory();
      renderMessages();
    }

    resetInactivityTimer();

    isLoading = false;
    if (sendBtn) sendBtn.disabled = false;
    if (input) input.focus();
  }

  function fallback(text) {
    const q = text.toLowerCase();
    if (q.includes("devis")) return "Pour créer un devis, allez dans l'onglet Application et utilisez la dictée vocale. L'IA génère automatiquement votre devis.";
    if (q.includes("facture")) return "Les factures se créent depuis l'Application en sélectionnant le type 'Facture'. Vous pouvez aussi convertir un devis accepté.";
    if (q.includes("client")) return "La gestion des clients est disponible dans l'onglet Clients. Vous pouvez y créer, modifier et archiver vos dossiers clients.";
    if (q.includes("signature")) return "La signature électronique est disponible depuis un dossier client. Cliquez sur 'Envoyer pour signature' et votre client recevra un lien.";
    return "Je ne suis pas sûr de pouvoir répondre à cette question sans connexion. Consultez notre formulaire de contact pour une assistance personnalisée.";
  }

  // ── CLÔTURER LA CONVERSATION ──────────────────────────
  function closeConversation() {
    clearHistory();
    renderMessages();
    const resolvedEl = document.getElementById("artio-chat-resolved");
    if (resolvedEl) resolvedEl.style.display = "none";

    // Message de clôture
    history.push({ role: "assistant", content: "Merci d'avoir utilisé l'assistant Artio ! N'hésitez pas à revenir si vous avez d'autres questions. 👋" });
    saveHistory();
    renderMessages();

    // Fermer le panel après 2s
    setTimeout(() => {
      clearHistory();
      isOpen = false;
      const panel = document.getElementById("artio-chat-panel");
      if (panel) panel.classList.remove("open");
    }, 2000);
  }

  // ── TOGGLE PANEL ──────────────────────────────────────
  function togglePanel() {
    isOpen = !isOpen;
    const panel = document.getElementById("artio-chat-panel");
    const badge = document.getElementById("artio-chat-badge");
    if (!panel) return;
    if (isOpen) {
      panel.classList.add("open");
      if (badge) badge.style.display = "none";
      renderMessages();
      setTimeout(() => {
        const input = document.getElementById("artio-chat-input");
        if (input) input.focus();
      }, 200);
    } else {
      panel.classList.remove("open");
    }
  }

  // ── EVENTS ────────────────────────────────────────────
  function bindEvents() {
    document.getElementById("artio-chat-btn")?.addEventListener("click", togglePanel);
    document.getElementById("artio-chat-close")?.addEventListener("click", togglePanel);

    document.getElementById("artio-chat-send")?.addEventListener("click", sendMessage);

    const input = document.getElementById("artio-chat-input");
    if (input) {
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          sendMessage();
        }
      });
      // Auto-resize textarea
      input.addEventListener("input", () => {
        input.style.height = "auto";
        input.style.height = Math.min(input.scrollHeight, 80) + "px";
      });
    }

    document.getElementById("artio-btn-yes")?.addEventListener("click", closeConversation);
    document.getElementById("artio-btn-no")?.addEventListener("click", () => {
      const resolvedEl = document.getElementById("artio-chat-resolved");
      if (resolvedEl) resolvedEl.style.display = "none";
    });
  }

  // ── DÉMARRAGE ─────────────────────────────────────────
  async function init() {
    buildWidget();
    bindEvents();
    await initApiKey();

    // Montrer badge si historique existant
    if (history.length > 0) {
      const badge = document.getElementById("artio-chat-badge");
      if (badge) badge.style.display = "block";
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
