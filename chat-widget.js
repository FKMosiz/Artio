/**
 * Artio — Chat Widget IA flottant
 * À inclure sur toutes les pages après supabase-js
 * Conversation persistante via localStorage
 */

(function () {
  // ── CONFIG ────────────────────────────────────────────
  const SUPABASE_URL  = "https://mwmexkoeqeyueqgdkkni.supabase.co";
  const SUPABASE_KEY  = "sb_publishable_dbf0DrGQr377jyftcE-rYw_SK5nzZJw";
  const FUNCTIONS_URL = "https://mwmexkoeqeyueqgdkkni.supabase.co/functions/v1";
  const STORAGE_KEY   = "artio_chat_history";
  const MODEL         = "claude-sonnet-4-20250514";
  const MAX_TOKENS    = 512;
  const INACTIVITY_MS = 10 * 60 * 1000; // 10 minutes

  const SYSTEM_PROMPT_BASE = `Tu es l'assistant IA d'Artio, une application SaaS pour les professionnels indépendants français (freelancers, artisans, coaches, photographes, etc.).

Artio permet de :
- Générer des devis et factures par dictée vocale (IA)
- Gérer les dossiers clients
- Suivre les finances (tableau de bord, KPIs)
- Gérer le calendrier et les rendez-vous
- Signer électroniquement les documents
- Gérer les paramètres de l'entreprise

Tu aides les utilisateurs à naviguer dans l'application, comprendre ses fonctionnalités et résoudre leurs problèmes. Réponds en français, de façon concise (3-4 phrases max), bienveillante et pratique.

RÈGLE IMPORTANTE : Quand tu sens que la question de l'utilisateur est résolue (tu as donné une réponse complète), termine NATURELLEMENT ta réponse en ajoutant "Y a-t-il autre chose que je puisse faire pour vous ?" ou "Est-ce que cela répond à votre question ?" — seulement si la réponse est vraiment complète. Ne le fais pas si l'utilisateur est encore en train d'expliquer. Si l'utilisateur dit "non merci", "c'est bon", "merci", "parfait", "ok merci" ou similaire, réponds chaleureusement en le remerciant de ta part, puis termine par [CONVERSATION_CLOSE].`;

  function getSystemPrompt() {
    if (!contexteIA) return SYSTEM_PROMPT_BASE;
    return SYSTEM_PROMPT_BASE + `\n\nINFORMATIONS SUR L'ENTREPRISE DE L'UTILISATEUR :\n${contexteIA}\n\nUtilise ces informations pour répondre de façon personnalisée aux questions sur l'activité, les offres, les tarifs ou les services de cet utilisateur.`;
  }

  // ── STATE ─────────────────────────────────────────────
  let apiKey          = null;
  let contexteIA      = null; // contexte métier de l'utilisateur
  let userId          = null; // pour le logging des tokens
  let userEmail       = null;
  let isOpen          = false;
  let isLoading       = false;
  let history         = loadHistory();
  let inactivityTimer = null;

  // ── SUPABASE ──────────────────────────────────────────
  async function initUser() {
    try {
      const sbClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
      const { data: { session } } = await sbClient.auth.getSession();
      if (!session) return;
      userEmail = session.user.email;
      userId    = session.user.id;
      accessToken = session.access_token;
      const { data: profil } = await sbClient
        .from("profils").select("contexte_ia")
        .eq("user_id", session.user.id).single();
      if (profil?.contexte_ia) contexteIA = profil.contexte_ia;
    } catch (e) { console.warn("Chat widget:", e.message); }
  }

  // ── PERSISTENCE ───────────────────────────────────────
  function loadHistory() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
    catch { return []; }
  }
  function saveHistory() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(history)); }
    catch {}
  }
  function clearHistory() {
    history = [];
    localStorage.removeItem(STORAGE_KEY);
  }

  // ── LOG TOKENS (silencieux) ───────────────────────────
  async function logTokens(usage) {
    try {
      if (!usage || !userId) return;
      const sbClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
      const input  = usage.input_tokens  || 0;
      const output = usage.output_tokens || 0;
      const cout   = (input * 0.000003) + (output * 0.000015);
      await sbClient.from("token_logs").insert({
        user_id:       userId,
        feature:       "chatbot",
        input_tokens:  input,
        output_tokens: output,
        total_tokens:  input + output,
        cout_estime:   cout
      });
    } catch(e) { console.debug("widget logTokens:", e.message); }
  }

  // ── EMAIL RÉCAP ───────────────────────────────────────
  async function sendRecapEmail(conv) {
    if (!userEmail || conv.length === 0) return;
    try {
      const lines = conv.map(m =>
        `<tr style="border-bottom:1px solid rgba(255,255,255,0.05)">
          <td style="padding:8px 12px;width:70px;color:${m.role === 'user' ? '#f5a742' : '#3ecfcf'};font-weight:600;font-size:12px;vertical-align:top;white-space:nowrap">
            ${m.role === 'user' ? 'Vous' : 'Artio'}
          </td>
          <td style="padding:8px 12px;font-size:13px;color:#e2e5f1;line-height:1.6">
            ${m.content.replace(/\n/g, '<br>')}
          </td>
        </tr>`
      ).join("");

      const html = `
        <div style="background:#080b14;padding:32px;font-family:sans-serif">
          <div style="max-width:560px;margin:0 auto">
            <div style="margin-bottom:20px">
              <span style="font-size:22px;font-weight:700;color:#f5a742">Artio</span>
              <span style="font-size:13px;color:#6b7494;margin-left:10px">Récap de votre conversation</span>
            </div>
            <div style="background:#0e1220;border:1px solid rgba(255,255,255,0.08);border-radius:12px;overflow:hidden">
              <table style="width:100%;border-collapse:collapse">${lines}</table>
            </div>
            <p style="font-size:12px;color:#6b7494;margin-top:20px;text-align:center">
              Besoin d'aide ? <a href="mailto:support@monartio.fr" style="color:#f5a742">support@monartio.fr</a>
            </p>
          </div>
        </div>`;

      const textLines = conv.map(m => `${m.role === 'user' ? 'Vous' : 'Artio'} : ${m.content}`).join("\n\n");

      await fetch(`${SUPABASE_URL}/functions/v1/send-contact-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SUPABASE_KEY}` },
        body: JSON.stringify({
          nom: "Récap conversation",
          email: userEmail,
          sujet: "Récap de votre conversation Artio",
          message: textLines,
          to_override: userEmail,
          html_override: html
        })
      });
    } catch (e) { console.warn("Récap email:", e.message); }
  }

  // ── INACTIVITÉ ────────────────────────────────────────
  function resetInactivityTimer() {
    if (inactivityTimer) clearTimeout(inactivityTimer);
    if (history.length === 0) return;
    inactivityTimer = setTimeout(async () => {
      const conv = [...history];
      history.push({ role: "assistant", content: "Cette conversation a été fermée après 10 minutes d'inactivité. Un récap vous a été envoyé par email. N'hésitez pas à revenir ! 👋" });
      saveHistory();
      renderMessages();
      await sendRecapEmail(conv);
      setTimeout(() => { clearHistory(); renderMessages(); }, 6000);
    }, INACTIVITY_MS);
  }

  // ── CLÔTURE NATURELLE ─────────────────────────────────
  async function handleClose(cleanReply) {
    history.push({ role: "assistant", content: cleanReply });
    saveHistory();
    renderMessages();
    const conv = [...history];
    await sendRecapEmail(conv);
    // 8 secondes pour lire, puis réduire
    setTimeout(() => {
      clearHistory();
      if (inactivityTimer) clearTimeout(inactivityTimer);
      renderMessages();
      isOpen = false;
      document.getElementById("artio-chat-panel")?.classList.remove("open");
    }, 8000);
  }

  // ── RENDER ────────────────────────────────────────────
  function renderMessages() {
    const container = document.getElementById("artio-chat-messages");
    if (!container) return;
    container.innerHTML = "";

    if (history.length === 0) {
      container.innerHTML = `
        <div class="artio-chat-empty">
          <strong>Bonjour ! 👋</strong>
          Je suis votre assistant Artio. Comment puis-je vous aider ?
          <div class="artio-suggestions">
            <button class="artio-chip" onclick="artioAsk(this)">Comment créer un devis ?</button>
            <button class="artio-chip" onclick="artioAsk(this)">Comment ajouter un client ?</button>
            <button class="artio-chip" onclick="artioAsk(this)">Comment fonctionne la signature ?</button>
          </div>
        </div>`;
      return;
    }

    history.forEach(msg => {
      const div = document.createElement("div");
      div.className = `artio-msg ${msg.role === "user" ? "user" : "bot"}`;
      div.textContent = msg.content;
      container.appendChild(div);
    });
    container.scrollTop = container.scrollHeight;

    const badge = document.getElementById("artio-chat-badge");
    if (badge) badge.style.display = (!isOpen && history.length > 0) ? "block" : "none";
  }

  // Suggestion chip handler (global)
  window.artioAsk = function(btn) {
    const input = document.getElementById("artio-chat-input");
    if (input) { input.value = btn.textContent; sendMessage(); }
  };

  function showTyping() {
    const c = document.getElementById("artio-chat-messages");
    if (!c) return;
    const d = document.createElement("div");
    d.className = "artio-msg typing"; d.id = "artio-typing";
    d.innerHTML = `<div class="artio-dots"><span></span><span></span><span></span></div>`;
    c.appendChild(d); c.scrollTop = c.scrollHeight;
  }
  function removeTyping() {
    document.getElementById("artio-typing")?.remove();
  }

  // ── SEND ──────────────────────────────────────────────
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

    history.push({ role: "user", content: text });
    saveHistory();
    renderMessages();
    showTyping();

    let reply;

    if (accessToken) {
      try {
        const messages = history.slice(-20).map(m => ({
          role: m.role === "assistant" ? "assistant" : "user",
          content: m.content
        }));
        const res = await fetch(FUNCTIONS_URL + "/claude-proxy", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + accessToken
          },
          body: JSON.stringify({ model: MODEL, max_tokens: MAX_TOKENS, system: getSystemPrompt(), messages, feature: "chat-widget" })
        });
        if (res.ok) {
          const d = await res.json();
          reply = d.content?.[0]?.text || fallback(text);
        } else {
          reply = fallback(text);
        }
      } catch { reply = fallback(text); }
    } else {
      reply = fallback(text);
    }

    removeTyping();

    if (reply.includes("[CONVERSATION_CLOSE]")) {
      await handleClose(reply.replace("[CONVERSATION_CLOSE]", "").trim());
    } else {
      history.push({ role: "assistant", content: reply });
      saveHistory();
      renderMessages();
      resetInactivityTimer();
    }

    isLoading = false;
    if (sendBtn) sendBtn.disabled = false;
    if (!reply.includes("[CONVERSATION_CLOSE]")) input?.focus();
  }

  function fallback(text) {
    const q = text.toLowerCase();
    if (q.includes("devis")) return "Pour créer un devis, allez dans l'onglet Application et utilisez la dictée vocale. L'IA génère automatiquement votre devis. Y a-t-il autre chose que je puisse faire pour vous ?";
    if (q.includes("facture")) return "Les factures se créent depuis l'Application. Vous pouvez aussi convertir un devis accepté en facture. Y a-t-il autre chose que je puisse faire pour vous ?";
    if (q.includes("client")) return "La gestion des clients est disponible dans l'onglet Clients. Y a-t-il autre chose que je puisse faire pour vous ?";
    if (q.includes("signature")) return "La signature électronique est disponible depuis un dossier client. Y a-t-il autre chose que je puisse faire pour vous ?";
    return "Je ne suis pas sûr de pouvoir répondre sans connexion. Consultez notre formulaire de contact pour une assistance personnalisée.";
  }

  // ── TOGGLE ────────────────────────────────────────────
  function togglePanel() {
    isOpen = !isOpen;
    const panel = document.getElementById("artio-chat-panel");
    const badge = document.getElementById("artio-chat-badge");
    if (!panel) return;
    if (isOpen) {
      panel.classList.add("open");
      if (badge) badge.style.display = "none";
      renderMessages();
      setTimeout(() => document.getElementById("artio-chat-input")?.focus(), 200);
    } else {
      panel.classList.remove("open");
      if (badge && history.length > 0) badge.style.display = "block";
    }
  }

  // ── BUILD ─────────────────────────────────────────────
  function buildWidget() {
    const style = document.createElement("style");
    style.textContent = `
      #artio-chat-bubble{position:fixed;bottom:24px;right:24px;z-index:9999;font-family:'Plus Jakarta Sans','Space Grotesk',sans-serif}
      #artio-chat-btn{width:56px;height:56px;border-radius:50%;background:#f5a742;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 20px rgba(245,167,66,.4);transition:transform .2s,box-shadow .2s;position:relative}
      #artio-chat-btn:hover{transform:scale(1.08);box-shadow:0 6px 24px rgba(245,167,66,.5)}
      #artio-chat-btn svg{color:#080b14}
      #artio-chat-badge{position:absolute;top:-2px;right:-2px;width:12px;height:12px;border-radius:50%;background:#3ecfcf;border:2px solid #080b14;display:none}
      #artio-chat-panel{position:absolute;bottom:68px;right:0;width:360px;height:600px;background:#0e1220;border:1px solid rgba(255,255,255,.1);border-radius:16px;box-shadow:0 16px 48px rgba(0,0,0,.5);display:flex;flex-direction:column;overflow:hidden;opacity:0;transform:translateY(12px) scale(.97);pointer-events:none;transition:opacity .25s,transform .25s}
      #artio-chat-panel.open{opacity:1;transform:translateY(0) scale(1);pointer-events:all}
      #artio-chat-header{padding:14px 16px;background:#141829;border-bottom:1px solid rgba(255,255,255,.07);display:flex;align-items:center;justify-content:space-between;flex-shrink:0}
      #artio-chat-header-left{display:flex;align-items:center;gap:10px}
      .artio-avatar{width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#f5a742,#3ecfcf);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:#080b14;flex-shrink:0}
      #artio-chat-header-title{font-family:'Space Grotesk',sans-serif;font-size:14px;font-weight:600;color:#e2e5f1}
      #artio-chat-header-sub{font-size:11px;color:#6b7494;margin-top:1px}
      .artio-hbtn{background:none;border:none;color:#6b7494;cursor:pointer;padding:5px;border-radius:6px;display:flex;align-items:center;transition:color .2s,background .2s}
      .artio-hbtn:hover{color:#e2e5f1;background:rgba(255,255,255,.06)}
      #artio-chat-messages{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px;scroll-behavior:smooth}
      #artio-chat-messages::-webkit-scrollbar{width:4px}
      #artio-chat-messages::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1);border-radius:2px}
      .artio-msg{max-width:85%;padding:9px 12px;border-radius:12px;font-size:13px;line-height:1.5;word-break:break-word}
      .artio-msg.user{background:rgba(245,167,66,.15);color:#e2e5f1;border:1px solid rgba(245,167,66,.25);align-self:flex-end;border-bottom-right-radius:4px}
      .artio-msg.bot{background:#1a2035;color:#e2e5f1;border:1px solid rgba(255,255,255,.07);align-self:flex-start;border-bottom-left-radius:4px}
      .artio-msg.typing{background:#1a2035;border:1px solid rgba(255,255,255,.07);align-self:flex-start;padding:12px 16px}
      .artio-dots{display:flex;gap:4px;align-items:center}
      .artio-dots span{width:6px;height:6px;background:#6b7494;border-radius:50%;animation:artio-bounce 1.2s infinite}
      .artio-dots span:nth-child(2){animation-delay:.2s}
      .artio-dots span:nth-child(3){animation-delay:.4s}
      @keyframes artio-bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-5px)}}
      #artio-chat-footer{padding:10px 12px;border-top:1px solid rgba(255,255,255,.07);display:flex;gap:8px;align-items:flex-end;background:#0e1220;flex-shrink:0}
      #artio-chat-input{flex:1;background:#1a2035;border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:8px 12px;font-size:13px;color:#e2e5f1;font-family:inherit;outline:none;resize:none;max-height:100px;min-height:36px;transition:border-color .2s;line-height:1.5}
      #artio-chat-input:focus{border-color:rgba(245,167,66,.4)}
      #artio-chat-input::placeholder{color:#6b7494}
      #artio-chat-send{width:36px;height:36px;border-radius:10px;background:#f5a742;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:opacity .2s,transform .1s}
      #artio-chat-send:hover{opacity:.85;transform:scale(1.05)}
      #artio-chat-send:disabled{opacity:.4;cursor:not-allowed;transform:none}
      .artio-chat-empty{text-align:center;color:#6b7494;font-size:13px;margin:auto;padding:24px 20px;line-height:1.7}
      .artio-chat-empty strong{display:block;color:#e2e5f1;font-size:15px;margin-bottom:8px}
      .artio-suggestions{margin-top:16px;display:flex;flex-direction:column;gap:6px}
      .artio-chip{background:#1a2035;border:1px solid rgba(255,255,255,.08);border-radius:8px;padding:8px 12px;font-size:12px;color:#a0a8c0;cursor:pointer;text-align:left;transition:background .2s,color .2s;font-family:inherit}
      .artio-chip:hover{background:rgba(245,167,66,.1);color:#e2e5f1;border-color:rgba(245,167,66,.2)}
      @media(max-width:420px){#artio-chat-panel{width:calc(100vw - 32px);height:70vh;right:0}}
    `;
    document.head.appendChild(style);

    const wrapper = document.createElement("div");
    wrapper.id = "artio-chat-bubble";
    wrapper.innerHTML = `
      <div id="artio-chat-panel">
        <div id="artio-chat-header">
          <div id="artio-chat-header-left">
            <div class="artio-avatar">A</div>
            <div>
              <div id="artio-chat-header-title">Assistant Artio</div>
              <div id="artio-chat-header-sub">Disponible pour vous aider</div>
            </div>
          </div>
          <button class="artio-hbtn" id="artio-chat-minimize" title="Réduire">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
        </div>
        <div id="artio-chat-messages"></div>
        <div id="artio-chat-footer">
          <textarea id="artio-chat-input" placeholder="Posez votre question…" rows="1"></textarea>
          <button id="artio-chat-send" title="Envoyer">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#080b14" stroke-width="2.5" stroke-linecap="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </div>
      </div>
      <button id="artio-chat-btn" title="Aide IA Artio">
        <div id="artio-chat-badge"></div>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
      </button>
    `;
    document.body.appendChild(wrapper);
  }

  // ── EVENTS ────────────────────────────────────────────
  function bindEvents() {
    document.getElementById("artio-chat-btn")?.addEventListener("click", togglePanel);
    document.getElementById("artio-chat-minimize")?.addEventListener("click", togglePanel);
    document.getElementById("artio-chat-send")?.addEventListener("click", sendMessage);
    const input = document.getElementById("artio-chat-input");
    if (input) {
      input.addEventListener("keydown", e => {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
      });
      input.addEventListener("input", () => {
        input.style.height = "auto";
        input.style.height = Math.min(input.scrollHeight, 100) + "px";
      });
    }
  }

  // ── INIT ──────────────────────────────────────────────
  async function init() {
    buildWidget();
    bindEvents();
    await initUser();
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
