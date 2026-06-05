/* ──────────────────────────────────────────────────────────────
   tour.js — Tutoriel interactif Artio (multi-pages)
   Source unique de vérité : étapes + moteur + persistance.
   À inclure sur toutes les pages via : <script src="tour.js?v=1"></script>
   ────────────────────────────────────────────────────────────── */
(function(){
  'use strict';

  // ═══════════════════════════════════════════════════════════
  // HELPERS — Sidebar ouverte/fermée pour les étapes "menu"
  // ═══════════════════════════════════════════════════════════
  function _openSidebar(){
    const sb = document.querySelector('.sidebar');
    const ov = document.querySelector('.sidebar-overlay');
    if(sb) sb.classList.add('open');
    if(ov) ov.classList.add('open');
  }
  function _closeSidebar(){
    const sb = document.querySelector('.sidebar');
    const ov = document.querySelector('.sidebar-overlay');
    if(sb) sb.classList.remove('open');
    if(ov) ov.classList.remove('open');
  }

  // ═══════════════════════════════════════════════════════════
  // CONFIGURATION — Les étapes du tour
  // ═══════════════════════════════════════════════════════════
  const TOUR_STEPS = [
    {
      page:"home",
      title:"👋 Bienvenue sur Artio !",
      desc:"En 2 minutes, découvre tout ce qu'Artio fait pour toi — création vocale de devis et factures, rédaction d'emails par IA, suivi de tes dossiers, signature électronique, et plus encore.<br><br>Tu peux quitter le tutoriel à tout moment.",
      target:null, pos:"center"
    },
    {
      page:"home",
      title:"🧭 Le menu — tout commence ici",
      desc:"Voici le menu latéral, ouvert pour toi.<br><br>Tu y trouveras toutes les sections d'Artio : Créer, Dossiers, Rédiger, Clients, Tableau de bord, Calendrier, Paramètres…<br><br>Il s'ouvre depuis n'importe quelle page via l'icône <strong>☰</strong> en haut à gauche.",
      target:".sidebar", pos:"right",
      onEnter: _openSidebar,
      onLeave: _closeSidebar
    },
    {
      page:"home",
      title:"🏠 Ta page d'accueil",
      desc:"C'est ton point de départ. Tu y vois en un coup d'œil :<br>• Ton <strong>CA du mois</strong> et de l'année<br>• Ton <strong>taux de conversion</strong> devis → facture<br>• Tes raccourcis vers la création et tes dossiers<br><br>Reviens-y dès que tu te connectes.",
      target:null, pos:"center"
    },
    {
      page:"app",
      title:"🎙 Créer un document",
      desc:"Deux façons de remplir un devis ou une facture :<br><br>• 🎙 <strong>À la voix</strong> — clique sur l'orbe et dicte :<br><span class=\"tour-example\">« Devis pour M. Martin, coaching sportif mardi 14h, 3 heures, matériel 30 € »</span>• 📝 <strong>Manuellement</strong> — clique sur le bouton « ou remplir manuellement → » sous l'orbe.<br><br>Pour explorer un exemple complet, tu peux aussi utiliser le bouton ci-dessous.",
      target:[".create-orb-wrap", ".create-manual"],
      pos:"right",
      onEnter:"_tourShowOrb",
      forceClick:".create-manual",
      forceClickHint:"👉 Clique sur « ou remplir manuellement → » pour continuer",
      action:{label:"📝 Pré-remplir un exemple", fn:"_tourDemoFill"}
    },
    {
      page:"app",
      title:"👥 Annuaire & autocomplétion",
      desc:"Tape les premières lettres d'un client enregistré : il apparaît dans une liste. Un clic remplit nom, email, téléphone et adresse.<br><br>Tu peux aussi basculer entre <strong>Devis</strong> et <strong>Facture</strong> en haut du formulaire.",
      target:"input[data-fid=\"client_nom\"]", pos:"bottom",
      onEnter:"_tourEnsureManualForm"
    },
    {
      page:"app",
      title:"⚡ Générer le document",
      desc:"Ce bouton produit ton PDF. Une fois les champs remplis :<br>• L'IA rédige la description finale<br>• Les totaux HT/TVA/TTC sont calculés<br>• La numérotation est automatique (DEV-2026-XXX)<br>• Le dossier est créé dans <strong>Dossiers</strong>",
      target:".cf-btn-primary", pos:"top",
      onEnter:"_tourEnsureManualForm"
    },
    {
      page:"rediger",
      title:"✉️ Rédiger un email client",
      desc:"Page dédiée à la rédaction d'emails professionnels.<br><br>Tu colles le message reçu, tu choisis le ton (vouvoiement, cordial, ferme…) et l'IA rédige la réponse pour toi.<br><br>Si Gmail est connecté, ta boîte de réception s'affiche aussi ici via l'onglet <strong>Messagerie</strong> — tu peux répondre directement depuis Artio.",
      target:null, pos:"center"
    },
    {
      page:"dossiers",
      title:"📁 Tes dossiers",
      desc:"Tous tes devis et factures, groupés par client. Statuts mis à jour en temps réel :<br>• 🟡 Devis envoyé<br>• ✅ Signé<br>• 🧾 Facturé<br>• 💶 Payé<br><br>Tu peux télécharger les PDF, relancer un client, marquer comme payé.",
      target:null, pos:"center"
    },
    {
      page:"clients",
      title:"👥 Annuaire clients",
      desc:"Tous tes clients en un seul endroit. Ajoute-les manuellement, ou ils se créent automatiquement quand tu génères un devis.<br><br>Particuliers ou professionnels — pour les pros, ajoute le SIRET et Artio adapte les mentions légales sur tes PDF.",
      target:null, pos:"center"
    },
    {
      page:"dashboard",
      title:"📊 Tableau de bord",
      desc:"Tes indicateurs clés en un coup d'œil : CA mensuel et annuel, nombre de devis envoyés et signés, taux de conversion, top clients.<br><br>Idéal pour faire le point en fin de mois.",
      target:null, pos:"center"
    },
    {
      page:"calendar",
      title:"📅 Calendrier",
      desc:"Visualise tes rendez-vous et prestations.<br><br>Connecte <strong>Google Calendar</strong> (offre Pro) pour synchroniser dans les deux sens : un événement créé dans Artio apparaît dans Google, et inversement.",
      target:null, pos:"center"
    },
    {
      page:"settings",
      title:"⚙️ Paramètres",
      desc:"Configure tout ce qui personnalise ton expérience :<br>• Profil entreprise (SIRET, TVA, IBAN)<br>• Connexion Gmail & Google Calendar<br>• Contexte IA — pour des emails plus pertinents<br>• Abonnement et facturation",
      target:null, pos:"center"
    },
    {
      page:"home",
      title:"🎉 Tu es prêt !",
      desc:"Bravo, tu as fait le tour complet d'Artio.<br><br>Retrouve ce tutoriel à tout moment depuis la page <strong style=\"color:var(--amber)\">Aide</strong>.<br><br><small style=\"color:var(--muted)\">La création de documents et l'IA nécessitent un abonnement Solo ou Pro.</small>",
      target:null, pos:"center"
    }
  ];

  // ═══════════════════════════════════════════════════════════
  // STATE & PERSISTANCE
  // ═══════════════════════════════════════════════════════════
  const LS_STEP   = 'artio_tour_step';
  const LS_ACTIVE = 'artio_tour_active';
  const LS_DONE   = 'artio_tour_done';

  const state = { active:false, step:0 };

  // ═══════════════════════════════════════════════════════════
  // DÉTECTION DE PAGE
  // ═══════════════════════════════════════════════════════════
  function _currentPage(){
    const file = (location.pathname.split('/').pop() || '').replace('.html','');
    // Page d'accueil par défaut si racine
    if(!file || file === 'index') return 'home';
    return file;
  }

  // ═══════════════════════════════════════════════════════════
  // INJECTION CSS (une seule fois par page)
  // ═══════════════════════════════════════════════════════════
  function _injectCSS(){
    if(document.getElementById('artio-tour-css')) return;
    const style = document.createElement('style');
    style.id = 'artio-tour-css';
    style.textContent = `
      #artio-tour-overlay{position:fixed;inset:0;z-index:99999;pointer-events:none;}
      #artio-tour-backdrop{position:fixed;inset:0;background:rgba(0,0,0,0);transition:background .4s;pointer-events:none;z-index:99996;}
      #artio-tour-backdrop.active{background:rgba(8,11,20,.78);pointer-events:all;}
      /* Spotlight = "trou" dans le voile : la zone surlignée reste claire, le reste est sombre */
      #artio-tour-spotlight{position:fixed;border-radius:14px;pointer-events:none;z-index:99997;box-shadow:0 0 0 9999px rgba(8,11,20,.78);transition:top .35s ease,left .35s ease,width .35s ease,height .35s ease;display:none;}
      #artio-tour-spotlight.active{display:block;}
      .tour-card{position:fixed;z-index:100001;background:var(--surface,#0e1220);border:1px solid rgba(245,167,66,.35);border-radius:16px;padding:22px 24px 18px;width:340px;max-width:calc(100vw - 24px);max-height:calc(100vh - 32px);overflow-y:auto;box-shadow:0 16px 48px rgba(0,0,0,.6);pointer-events:all;transition:opacity .25s ease;opacity:0;}
      .tour-card-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;}
      .tour-card-title{font-family:var(--fh,'Space Grotesk',sans-serif);font-size:15px;font-weight:700;color:var(--text,#e2e5f1);}
      .tour-card-step{font-size:11px;color:var(--muted,#6b7494);font-weight:500;}
      .tour-card-desc{font-size:13px;color:var(--muted,#9aa3c2);line-height:1.6;margin-bottom:16px;}
      .tour-card-pro{display:inline-flex;align-items:center;gap:5px;background:rgba(245,167,66,.12);border:1px solid rgba(245,167,66,.3);border-radius:20px;padding:3px 10px;font-size:11px;color:var(--amber,#f5a742);font-weight:600;margin-bottom:12px;}
      .tour-progress{display:flex;gap:5px;margin-bottom:14px;flex-wrap:wrap;}
      .tour-dot{width:6px;height:6px;border-radius:50%;background:rgba(120,120,140,.25);transition:all .3s;}
      .tour-dot.active{background:var(--amber,#f5a742);width:18px;border-radius:3px;}
      .tour-dot.done{background:rgba(245,167,66,.45);}
      .tour-actions{display:flex;gap:8px;align-items:center;}
      .tour-btn-next{flex:1;padding:9px;background:var(--amber,#f5a742);color:#080b14;border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;font-family:var(--fh,'Space Grotesk',sans-serif);}
      .tour-btn-prev{padding:9px 12px;background:var(--surface-3,rgba(255,255,255,.04));color:var(--muted,#6b7494);border:1px solid var(--border,rgba(255,255,255,.07));border-radius:10px;font-size:13px;cursor:pointer;}
      .tour-btn-skip{padding:8px 0;background:none;color:var(--muted,#6b7494);border:none;font-size:11px;cursor:pointer;text-align:center;width:100%;margin-top:8px;text-decoration:underline;text-decoration-color:rgba(120,120,140,.25);transition:color .2s;}
      .tour-btn-skip:hover{color:var(--text,#e2e5f1);text-decoration-color:rgba(120,120,140,.6);}
      .tour-example{display:block;color:var(--amber,#f5a742);padding:10px 12px;background:rgba(245,167,66,.08);border-left:3px solid var(--amber,#f5a742);border-radius:6px;margin:10px 0;font-size:12.5px;font-style:italic;line-height:1.5;}
      .tour-warn{display:block;font-size:11.5px;color:#f5a742;padding:8px 10px;background:rgba(245,167,66,.06);border-radius:6px;margin-top:8px;line-height:1.5;}
      .tour-action-btn{display:block;width:100%;padding:9px;margin:10px 0 0;background:rgba(245,167,66,.12);color:var(--amber,#f5a742);border:1px solid rgba(245,167,66,.3);border-radius:9px;font-size:12.5px;font-weight:600;cursor:pointer;font-family:var(--fb,'Plus Jakarta Sans',sans-serif);transition:all .15s;}
      .tour-action-btn:hover{background:rgba(245,167,66,.2);border-color:rgba(245,167,66,.5);}
      .tour-forceclick-hint{display:flex;align-items:center;gap:8px;padding:12px 14px;background:rgba(245,167,66,.12);border:1px dashed rgba(245,167,66,.45);border-radius:10px;font-size:12.5px;color:var(--amber,#f5a742);font-weight:600;line-height:1.45;margin-bottom:8px;}
      .tour-forceclick-hint .tour-fc-arrow{font-size:18px;animation:tour-fc-arrow 1s ease-in-out infinite;}
      @keyframes tour-fc-arrow{0%,100%{transform:translateX(0);}50%{transform:translateX(4px);}}
      /* La cible n'a plus besoin d'outline blanc puisque le spotlight la dégrise déjà.
         On garde juste un halo ambré et un pulse léger pour l'effet "lumière". */
      .tour-highlight{position:relative;z-index:100000;border-radius:10px;box-shadow:0 0 0 4px rgba(245,167,66,.45),0 0 40px 10px rgba(245,167,66,.55)!important;animation:tour-pulse 1.8s ease-in-out infinite;}
      @keyframes tour-pulse{
        0%,100%{box-shadow:0 0 0 4px rgba(245,167,66,.45),0 0 32px 8px rgba(245,167,66,.5);}
        50%{box-shadow:0 0 0 7px rgba(245,167,66,.6),0 0 56px 16px rgba(245,167,66,.85);}
      }
    `;
    document.head.appendChild(style);
  }

  // ═══════════════════════════════════════════════════════════
  // MOTEUR — Mount / Render / Position
  // ═══════════════════════════════════════════════════════════
  function _mount(){
    if(!document.getElementById('artio-tour-backdrop')){
      const bd = document.createElement('div');
      bd.id = 'artio-tour-backdrop';
      document.body.appendChild(bd);
      setTimeout(function(){ bd.classList.add('active'); }, 30);
    }
    if(!document.getElementById('artio-tour-spotlight')){
      const sp = document.createElement('div');
      sp.id = 'artio-tour-spotlight';
      document.body.appendChild(sp);
    }
    if(!document.getElementById('artio-tour-overlay')){
      const ov = document.createElement('div');
      ov.id = 'artio-tour-overlay';
      document.body.appendChild(ov);
    }
  }

  // Affiche un voile plat (pas de cible visible) — utilisé pour pos:"center"
  function _showFlatBackdrop(){
    const bd = document.getElementById('artio-tour-backdrop');
    if(bd) bd.classList.add('active');
    const sp = document.getElementById('artio-tour-spotlight');
    if(sp) sp.classList.remove('active');
  }

  // Affiche un spotlight avec un "trou" à la position de la cible (ou de l'union des cibles)
  function _showSpotlight(rect){
    if(!rect){ _showFlatBackdrop(); return; }
    const bd = document.getElementById('artio-tour-backdrop');
    if(bd) bd.classList.remove('active');
    let sp = document.getElementById('artio-tour-spotlight');
    if(!sp){
      sp = document.createElement('div');
      sp.id = 'artio-tour-spotlight';
      document.body.appendChild(sp);
    }
    const pad = 10;
    sp.style.top = (rect.top - pad) + 'px';
    sp.style.left = (rect.left - pad) + 'px';
    sp.style.width = (rect.width + pad * 2) + 'px';
    sp.style.height = (rect.height + pad * 2) + 'px';
    sp.classList.add('active');
  }

  function _removeHighlight(){
    document.querySelectorAll('.tour-highlight').forEach(function(el){
      el.classList.remove('tour-highlight');
    });
  }

  // ── ForceClick : capture le clic sur la cible pour avancer le tour ──
  let _forceClickEl = null;
  let _forceClickHandler = null;
  function _detachForceClick(){
    if(_forceClickEl && _forceClickHandler){
      _forceClickEl.removeEventListener('click', _forceClickHandler, true);
    }
    _forceClickEl = null;
    _forceClickHandler = null;
  }
  function _attachForceClick(selector){
    _detachForceClick();
    if(!selector) return;
    let el = null;
    try { el = document.querySelector(selector); } catch(e){}
    if(!el) return;
    _forceClickEl = el;
    _forceClickHandler = function(){
      // Laisse le handler natif de la page s'exécuter, puis avance
      setTimeout(function(){ if(state.active) next(); }, 100);
    };
    // Capture phase = on est sûrs d'être notifiés même si onclick inline e.stopPropagation
    el.addEventListener('click', _forceClickHandler, true);
  }

  function _esc(s){ return String(s == null ? '' : s); }

  // ── Scroll INSTANTANÉ avec marge — la cible n'est pas collée au bord ──
  // Instant pour qu'on puisse positionner la card immédiatement avec la position finale
  function _scrollTargetIntoView(rect, pos){
    const vh = window.innerHeight;
    const margin = 90;
    let delta = 0;
    if(pos === 'bottom'){
      delta = rect.top - margin;
    } else if(pos === 'top'){
      delta = rect.bottom - (vh - margin);
    } else if(pos === 'right' || pos === 'left'){
      delta = rect.top + rect.height / 2 - vh / 2;
    } else {
      delta = rect.top + rect.height / 2 - vh / 2;
    }
    if(Math.abs(delta) > 4){
      window.scrollBy({ top: delta, behavior: 'auto' });
    }
  }

  function _unionRect(els){
    if(!els || els.length === 0) return null;
    let top = Infinity, left = Infinity, right = -Infinity, bottom = -Infinity;
    els.forEach(function(el){
      const r = el.getBoundingClientRect();
      if(r.top < top) top = r.top;
      if(r.left < left) left = r.left;
      if(r.right > right) right = r.right;
      if(r.bottom > bottom) bottom = r.bottom;
    });
    return { top: top, left: left, right: right, bottom: bottom, width: right - left, height: bottom - top };
  }

  function _position(card, primaryEl, pos, allTargets){
    if(!primaryEl || pos === 'center'){
      _showFlatBackdrop();
      card.style.top = '50%';
      card.style.left = '50%';
      card.style.transform = 'translate(-50%,-50%)';
      card.style.position = 'fixed';
      requestAnimationFrame(function(){ if(card) card.style.opacity = '1'; });
      return;
    }

    // Union des rects si plusieurs cibles
    const useUnion = (allTargets && allTargets.length > 1);
    let anchorRect = useUnion ? _unionRect(allTargets) : primaryEl.getBoundingClientRect();

    // Scroll instantané pour amener la cible dans la zone utile du viewport
    _scrollTargetIntoView(anchorRect, pos);

    // Re-mesure après scroll (scroll instant → rect immédiatement à jour)
    anchorRect = useUnion ? _unionRect(allTargets) : primaryEl.getBoundingClientRect();

    // Mets à jour le spotlight (trou dans le voile à la position de la cible)
    _showSpotlight(anchorRect);

    // Position de la card
    const rect = anchorRect;
    const vw = window.innerWidth, vh = window.innerHeight;
    const cw = 340;
    const ch = card.offsetHeight || 260;
    const gap = 24;
    card.style.transform = '';
    card.style.position = 'fixed';

    // Positionnement latéral (right/left)
    if(pos === 'right' || pos === 'left'){
      let leftVal;
      if(pos === 'right'){
        leftVal = rect.right + gap;
        if(leftVal + cw > vw - 12) leftVal = rect.left - cw - gap;
      } else {
        leftVal = rect.left - cw - gap;
        if(leftVal < 12) leftVal = rect.right + gap;
      }
      leftVal = Math.max(12, Math.min(leftVal, vw - cw - 12));
      let topVal = rect.top + rect.height / 2 - ch / 2;
      topVal = Math.max(12, Math.min(topVal, vh - ch - 12));
      card.style.left = leftVal + 'px';
      card.style.top = topVal + 'px';
      card.style.opacity = '1';
      return;
    }

    // Positionnement vertical (top/bottom) — défaut
    const spaceBelow = vh - rect.bottom - gap;
    const spaceAbove = rect.top - gap;
    const placeAbove = (pos === 'top') || (spaceBelow < ch + 8 && spaceAbove >= ch + 8);

    let topVal;
    if(placeAbove){
      topVal = rect.top - ch - gap;
    } else {
      topVal = rect.bottom + gap;
    }
    // CLAMP absolu : la card ne sort jamais du viewport
    topVal = Math.max(12, Math.min(topVal, vh - ch - 12));
    card.style.top = topVal + 'px';

    let leftVal = rect.left + rect.width / 2 - cw / 2;
    leftVal = Math.max(12, Math.min(leftVal, vw - cw - 12));
    card.style.left = leftVal + 'px';
    card.style.opacity = '1';
  }

  function _render(){
    if(!state.active) return;
    const step = TOUR_STEPS[state.step];
    if(!step) return;

    const overlay = document.getElementById('artio-tour-overlay');
    if(!overlay) return;

    _removeHighlight();
    _detachForceClick();

    // ── Cibles : string OU array de strings → highlight multiple ──
    const targetEls = [];
    if(step.target){
      const selectors = Array.isArray(step.target) ? step.target : [step.target];
      selectors.forEach(function(sel){
        let el = null;
        try { el = document.querySelector(sel); } catch(e){}
        if(el){
          el.classList.add('tour-highlight');
          targetEls.push(el);
        }
      });
    }
    // La 1ère cible sert d'ancre pour positionner la card
    const primaryEl = targetEls[0] || null;

    const dots = TOUR_STEPS.map(function(_, i){
      const cls = i === state.step ? 'active' : (i < state.step ? 'done' : '');
      return '<div class="tour-dot ' + cls + '"></div>';
    }).join('');

    const proBadge = step.pro ? '<div class="tour-card-pro">✨ Fonctionnalité Pro</div>' : '';

    let actionBtn = '';
    if(step.action && step.action.fn){
      actionBtn = '<button class="tour-action-btn" onclick="window.ArtioTour._runAction(\'' + step.action.fn + '\')">' + _esc(step.action.label) + '</button>';
    }

    const prevBtn = state.step > 0
      ? '<button class="tour-btn-prev" onclick="window.ArtioTour.prev()">←</button>'
      : '';

    // ── ForceClick : pas de bouton "Suivant", remplacé par un hint ──
    const isForceClick = !!step.forceClick;
    let nextBlock;
    if(isForceClick){
      const hintText = step.forceClickHint || '👉 Clique sur l\'élément encadré pour continuer';
      nextBlock =
        '<div class="tour-forceclick-hint">'
          + '<span class="tour-fc-arrow">👉</span>'
          + '<span>' + _esc(hintText.replace(/^👉\s*/, '')) + '</span>'
        + '</div>'
        + (prevBtn ? '<div class="tour-actions">' + prevBtn + '<div style="flex:1"></div></div>' : '');
    } else {
      const nextLabel = state.step === TOUR_STEPS.length - 1 ? 'Terminer 🎉' : 'Suivant →';
      const nextBtn = '<button class="tour-btn-next" onclick="window.ArtioTour.next()">' + nextLabel + '</button>';
      nextBlock = '<div class="tour-actions">' + prevBtn + nextBtn + '</div>';
    }

    const skipBtn = state.step < TOUR_STEPS.length - 1
      ? '<button class="tour-btn-skip" onclick="window.ArtioTour.end()">Quitter le tutoriel</button>'
      : '';

    overlay.innerHTML =
      '<div class="tour-card" id="tour-card" style="top:-9999px;left:-9999px;opacity:0;">'
        + '<div class="tour-card-header">'
          + '<span class="tour-card-title">' + _esc(step.title) + '</span>'
          + '<span class="tour-card-step">' + (state.step + 1) + ' / ' + TOUR_STEPS.length + '</span>'
        + '</div>'
        + '<div class="tour-progress">' + dots + '</div>'
        + proBadge
        + '<div class="tour-card-desc">' + step.desc + '</div>'
        + actionBtn
        + nextBlock
        + skipBtn
      + '</div>';

    const card = document.getElementById('tour-card');
    if(!card) return;
    _position(card, primaryEl, step.pos, targetEls);

    // Attache le forceClick listener APRÈS le render (cible peut avoir bougé)
    if(isForceClick) _attachForceClick(step.forceClick);
  }


  // ═══════════════════════════════════════════════════════════
  // CROSS-PAGE NAVIGATION
  // ═══════════════════════════════════════════════════════════
  function _redirectTo(step){
    localStorage.setItem(LS_STEP, String(state.step));
    localStorage.setItem(LS_ACTIVE, '1');
    location.href = step.page + '.html?tour=1';
  }

  // ═══════════════════════════════════════════════════════════
  // HOOKS — onEnter / onLeave (fonction directe ou nom window)
  // ═══════════════════════════════════════════════════════════
  function _callHook(hook){
    if(!hook) return;
    if(typeof hook === 'function'){
      try { hook(); } catch(e){ console.error('[ArtioTour] Hook function failed:', e); }
    } else if(typeof hook === 'string' && typeof window[hook] === 'function'){
      try { window[hook](); } catch(e){ console.error('[ArtioTour] Hook ' + hook + ' failed:', e); }
    }
  }

  // ═══════════════════════════════════════════════════════════
  // API PUBLIQUE
  // ═══════════════════════════════════════════════════════════
  function start(stepIndex){
    state.active = true;
    state.step = typeof stepIndex === 'number' && stepIndex >= 0 && stepIndex < TOUR_STEPS.length
      ? stepIndex : 0;

    const step = TOUR_STEPS[state.step];
    // Si l'étape de départ est sur une autre page, on redirige
    if(step && step.page !== _currentPage()){
      _redirectTo(step);
      return;
    }

    localStorage.setItem(LS_ACTIVE, '1');
    localStorage.setItem(LS_STEP, String(state.step));
    _injectCSS();
    _mount();
    _callHook(step && step.onEnter);
    _render();
  }

  function next(){
    if(state.step >= TOUR_STEPS.length - 1){ end(); return; }
    _removeHighlight();
    _detachForceClick();
    const curStep = TOUR_STEPS[state.step];
    _callHook(curStep && curStep.onLeave);

    const nextIdx = state.step + 1;
    const nextStep = TOUR_STEPS[nextIdx];
    state.step = nextIdx;

    if(nextStep.page !== _currentPage()){
      _redirectTo(nextStep);
      return;
    }

    localStorage.setItem(LS_STEP, String(state.step));
    _callHook(nextStep.onEnter);
    _render();
  }

  function prev(){
    if(state.step <= 0) return;
    _removeHighlight();
    _detachForceClick();
    const curStep = TOUR_STEPS[state.step];
    _callHook(curStep && curStep.onLeave);

    const prevIdx = state.step - 1;
    const prevStep = TOUR_STEPS[prevIdx];
    state.step = prevIdx;

    if(prevStep.page !== _currentPage()){
      _redirectTo(prevStep);
      return;
    }

    localStorage.setItem(LS_STEP, String(state.step));
    _callHook(prevStep.onEnter);
    _render();
  }

  function end(){
    _removeHighlight();
    _detachForceClick();
    // Appel du onLeave de l'étape courante (ex. fermer la sidebar si elle était ouverte)
    const curStep = TOUR_STEPS[state.step];
    _callHook(curStep && curStep.onLeave);
    state.active = false;
    state.step = 0;
    try {
      localStorage.setItem(LS_DONE, '1');
      localStorage.removeItem(LS_ACTIVE);
      localStorage.removeItem(LS_STEP);
    } catch(e){}
    const ov = document.getElementById('artio-tour-overlay');
    if(ov) ov.remove();
    const bd = document.getElementById('artio-tour-backdrop');
    if(bd) bd.remove();
    const sp = document.getElementById('artio-tour-spotlight');
    if(sp) sp.remove();
  }

  function _runAction(fnName){
    if(typeof window[fnName] === 'function'){
      try { window[fnName](); } catch(e){ console.error('[ArtioTour] Action failed:', e); }
    } else {
      console.warn('[ArtioTour] Action introuvable sur cette page :', fnName);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // AUTO-START — appelé par chaque page après initialisation
  // ═══════════════════════════════════════════════════════════
  // opts.firstTime : si true, démarre le tour pour les nouveaux utilisateurs
  //                  (seulement sur la page d'accueil par convention)
  function autoStart(opts){
    opts = opts || {};
    const qs = new URLSearchParams(location.search).get('tour');
    const isResume = localStorage.getItem(LS_ACTIVE) === '1';

    // ?tour=restart : reset complet et démarrage depuis le début
    if(qs === 'restart'){
      try {
        localStorage.removeItem(LS_DONE);
        localStorage.removeItem(LS_ACTIVE);
        localStorage.removeItem(LS_STEP);
      } catch(e){}
      try {
        const url = new URL(location.href);
        url.searchParams.delete('tour');
        const newSearch = url.searchParams.toString();
        history.replaceState(null, '', url.pathname + (newSearch ? '?' + newSearch : '') + url.hash);
      } catch(e){}
      setTimeout(function(){ start(0); }, 600);
      return true;
    }

    if(qs === '1' || isResume){
      // Nettoyer ?tour=1 de l'URL
      if(qs === '1'){
        try {
          const url = new URL(location.href);
          url.searchParams.delete('tour');
          const newSearch = url.searchParams.toString();
          history.replaceState(null, '', url.pathname + (newSearch ? '?' + newSearch : '') + url.hash);
        } catch(e){}
      }
      const savedStep = parseInt(localStorage.getItem(LS_STEP) || '0', 10);
      setTimeout(function(){ start(savedStep); }, 600);
      return true;
    }

    // Auto-démarrage pour les nouveaux utilisateurs (uniquement sur la page d'accueil)
    if(opts.firstTime && !localStorage.getItem(LS_DONE)){
      setTimeout(function(){ start(0); }, 800);
      return true;
    }

    return false;
  }

  // ═══════════════════════════════════════════════════════════
  // EXPOSE
  // ═══════════════════════════════════════════════════════════
  window.ArtioTour = {
    start: start,
    next: next,
    prev: prev,
    end: end,
    autoStart: autoStart,
    rerender: _render,
    _runAction: _runAction,
    isActive: function(){ return state.active; },
    reset: function(){
      try {
        localStorage.removeItem(LS_DONE);
        localStorage.removeItem(LS_ACTIVE);
        localStorage.removeItem(LS_STEP);
      } catch(e){}
    },
    steps: TOUR_STEPS  // exposé en lecture pour debug
  };
})();
