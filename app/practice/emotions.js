/* ============================================================
   practice/emotions.js
   "Gọi tên cảm xúc" (Emotion Labeling / Affect Labeling) exercise.
   Pattern mirrors practice/grounding.js: an intro → session →
   complete flow living inside #emotionsExercise.

   IMPORTANT: this file NEVER talks to OpenAI directly. It only
   calls our own backend route (POST /api/emotions/reflect), which
   holds the OpenAI API key server-side. See server.js.
   ============================================================ */
(function () {
  const EMO_MAX_ROUNDS = 4;
  const EMO_ENDPOINT = '/api/emotions/reflect';
  const EMO_MAX_CHARS = 2000;

  const emotionsSection = document.getElementById('emotionsExercise');
  if (!emotionsSection) return; // markup not present on this page

  const introEl = document.getElementById('emotionsIntro');
  const sessionEl = document.getElementById('emotionsSession');
  const completeEl = document.getElementById('emotionsComplete');

  const startBtn = document.getElementById('emotionsStart');
  const exitBtn = document.getElementById('emotionsExit');
  const restartBtn = document.getElementById('emotionsRestart');
  const finishBtn = document.getElementById('emotionsFinish');
  const openBtn = document.getElementById('openEmotions');

  const chatLog = document.getElementById('emotionsChatLog');
  const inputField = document.getElementById('emotionsInput');
  const sendBtn = document.getElementById('emotionsSend');

  const stepLabel = document.getElementById('emotionsStep');
  const progressBar = document.getElementById('emotionsProgressBar');
  const wordChipsEl = document.getElementById('emotionsWordChips');

  let autoReturnTimer = null;

  function lang() {
    return document.body.getAttribute('data-lang') || 'vi';
  }

  // Conversation state for this session only — nothing is persisted
  // client-side beyond the current page session, matching the site's
  // "no identity stored" promise.
  let history = [];       // [{role:'user', text} | {role:'assistant', vi, en}]
  let round = 0;
  let emotionWords = [];  // [{vi, en}]
  let busy = false;

  // ---------------- open / close / navigation ----------------

  function openEmotions() {
    resetState();
    emotionsSection.classList.remove('hidden');
    showIntro();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function closeEmotions() {
    clearTimeout(autoReturnTimer);
    emotionsSection.classList.add('hidden');
  }

  function resetState() {
    history = [];
    round = 0;
    emotionWords = [];
    busy = false;
    if (chatLog) chatLog.innerHTML = '';
    if (inputField) inputField.value = '';
    if (finishBtn) finishBtn.classList.add('hidden');
    updateProgress();
  }

  function showIntro() {
    introEl.classList.remove('hidden');
    sessionEl.classList.add('hidden');
    completeEl.classList.add('hidden');
  }

  function showSession() {
    introEl.classList.add('hidden');
    sessionEl.classList.remove('hidden');
    completeEl.classList.add('hidden');
    addAssistantBubble({
      vi: 'Chào bạn, mình là Mây. Bạn có thể kể cho mình nghe một chút về điều đang xảy ra với bạn hôm nay không? Không cần đúng thứ tự hay hoàn hảo — cứ viết những gì bạn đang nghĩ.',
      en: "Hi, I'm Mây. Could you tell me a little about what's going on for you today? There's no need to get it 'right' — just write whatever comes to mind."
    }, { typing: true });
    inputField.focus();
  }

  function showComplete() {
    sessionEl.classList.add('hidden');
    completeEl.classList.remove('hidden');
    renderWordChips();
    autoReturnTimer = setTimeout(() => {
      closeEmotions();
      showIntro();
    }, 6000);
  }

  // ---------------- progress ----------------

  function updateProgress() {
    const shown = Math.min(round + 1, EMO_MAX_ROUNDS);
    if (stepLabel) {
      stepLabel.textContent = lang() === 'vi'
        ? `Vòng ${shown} / ${EMO_MAX_ROUNDS}`
        : `Round ${shown} of ${EMO_MAX_ROUNDS}`;
    }
    if (progressBar) {
      progressBar.style.width = Math.min(100, Math.round((round / EMO_MAX_ROUNDS) * 100)) + '%';
    }
  }

  // ---------------- bubbles ----------------

  function addUserBubble(text) {
    const div = document.createElement('div');
    div.className = 'emo-bubble emo-bubble-user';
    div.textContent = text;
    chatLog.appendChild(div);
    chatLog.scrollTop = chatLog.scrollHeight;
  }

  function addAssistantBubble(msgPair, opts) {
    opts = opts || {};
    const wrap = document.createElement('div');
    wrap.className = 'emo-bubble emo-bubble-mau';
    wrap.dataset.vi = msgPair.vi || '';
    wrap.dataset.en = msgPair.en || '';

    const mascot = document.createElement('div');
    mascot.className = 'emo-mascot';
    mascot.innerHTML = '<span class="emo-mascot-cloud" aria-hidden="true"></span>';

    const bubble = document.createElement('div');
    bubble.className = 'emo-bubble-text';

    wrap.appendChild(mascot);
    wrap.appendChild(bubble);
    chatLog.appendChild(wrap);
    chatLog.scrollTop = chatLog.scrollHeight;

    const text = lang() === 'vi' ? (msgPair.vi || msgPair.en) : (msgPair.en || msgPair.vi);
    if (opts.typing && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      typeText(bubble, text);
    } else {
      bubble.textContent = text;
    }
  }

  function typeText(el, text) {
    el.textContent = '';
    let i = 0;
    const speed = 14;
    const timer = setInterval(() => {
      if (i < text.length) {
        el.textContent += text.charAt(i);
        i++;
        chatLog.scrollTop = chatLog.scrollHeight;
      } else {
        clearInterval(timer);
      }
    }, speed);
  }

  function showThinking() {
    const wrap = document.createElement('div');
    wrap.className = 'emo-bubble emo-bubble-mau emo-bubble-thinking';
    wrap.id = 'emoThinkingBubble';
    wrap.innerHTML =
      '<div class="emo-mascot"><span class="emo-mascot-cloud" aria-hidden="true"></span></div>' +
      '<div class="emo-bubble-text emo-typing-dots"><span></span><span></span><span></span></div>';
    chatLog.appendChild(wrap);
    chatLog.scrollTop = chatLog.scrollHeight;
  }

  function hideThinking() {
    const el = document.getElementById('emoThinkingBubble');
    if (el) el.remove();
  }

  function showCrisisNote() {
    const div = document.createElement('div');
    div.className = 'emo-crisis-note';
    div.innerHTML = lang() === 'vi'
      ? '<b>Nếu bạn đang trong khủng hoảng ngay lúc này, hãy liên hệ ngay:</b><ul>' +
        '<li><b>115</b> — Cấp cứu y tế, toàn quốc, 24/7</li>' +
        '<li><b>1900 1267</b> — Cấp cứu trầm cảm, TP. HCM</li>' +
        '<li><b>1900 636446</b> — Hỗ trợ tâm lý – xã hội khẩn cấp, toàn quốc, 24/7</li></ul>'
      : '<b>If you\'re in crisis right now, please reach out:</b><ul>' +
        '<li><b>115</b> — Medical emergency, nationwide, 24/7</li>' +
        '<li><b>1900 1267</b> — Mental health emergency line, HCMC</li>' +
        '<li><b>1900 636446</b> — Psychological–Social First Aid, nationwide, 24/7</li></ul>';
    chatLog.appendChild(div);
    chatLog.scrollTop = chatLog.scrollHeight;
  }

  function renderWordChips() {
    if (!wordChipsEl) return;
    wordChipsEl.innerHTML = '';
    emotionWords.forEach(w => {
      const chip = document.createElement('span');
      chip.className = 'emo-chip';
      chip.dataset.vi = w.vi;
      chip.dataset.en = w.en || w.vi;
      chip.textContent = lang() === 'vi' ? w.vi : (w.en || w.vi);
      wordChipsEl.appendChild(chip);
    });
  }

  // ---------------- sending ----------------

  async function sendMessage() {
    if (busy) return;
    const raw = (inputField.value || '').trim();
    if (!raw) return;
    const text = raw.slice(0, EMO_MAX_CHARS);

    busy = true;
    sendBtn.disabled = true;
    inputField.disabled = true;

    addUserBubble(text);
    history.push({ role: 'user', text });
    inputField.value = '';
    showThinking();

    try {
      const res = await fetch(EMO_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ history, message: text, round })
      });
      if (!res.ok) throw new Error('request failed: ' + res.status);
      const data = await res.json();
      hideThinking();
      round++;
      updateProgress();

      if (data.crisis) {
        addAssistantBubble({
          vi: data.reply_vi || 'Mình nghe thấy là bạn đang rất khó khăn. Bạn không cần một mình vượt qua điều này.',
          en: data.reply_en || "It sounds like you're going through something really hard. You don't have to face this alone."
        }, { typing: true });
        showCrisisNote();
        finishBtn.classList.remove('hidden');
      } else {
        addAssistantBubble({ vi: data.reply_vi, en: data.reply_en }, { typing: true });
        history.push({ role: 'assistant', vi: data.reply_vi, en: data.reply_en });

        if (Array.isArray(data.emotion_words)) {
          data.emotion_words.forEach(w => {
            if (w && w.vi && !emotionWords.some(e => e.vi === w.vi)) emotionWords.push(w);
          });
        }
        if (round >= EMO_MAX_ROUNDS) {
          finishBtn.classList.remove('hidden');
        }
      }
    } catch (err) {
      console.error('Emotion reflect error:', err);
      hideThinking();
      addAssistantBubble({
        vi: 'Xin lỗi, mình đang gặp trục trặc kết nối. Bạn có thể thử gửi lại không?',
        en: "Sorry, I'm having trouble connecting. Could you try sending that again?"
      });
    } finally {
      busy = false;
      sendBtn.disabled = false;
      inputField.disabled = false;
      inputField.focus();
    }
  }

  // ---------------- language sync ----------------
  // Assistant bubbles carry both languages in data attributes so
  // toggling 🇻🇳/🇬🇧 (already wired in script.js) updates them
  // instantly without re-calling the API.

  const langObserver = new MutationObserver(muts => {
    muts.forEach(m => {
      if (m.attributeName === 'data-lang') {
        refreshBubbleLanguages();
        renderWordChips();
        updateProgress();
      }
    });
  });
  langObserver.observe(document.body, { attributes: true });

  function refreshBubbleLanguages() {
    document.querySelectorAll('.emo-bubble-mau').forEach(wrap => {
      if (wrap.classList.contains('emo-bubble-thinking')) return;
      const bubble = wrap.querySelector('.emo-bubble-text');
      if (!bubble) return;
      const text = lang() === 'vi' ? wrap.dataset.vi : wrap.dataset.en;
      if (text) bubble.textContent = text;
    });
    document.querySelectorAll('.emo-crisis-note').forEach(el => el.remove());
  }

  // ---------------- events ----------------

  if (openBtn) openBtn.addEventListener('click', openEmotions);
  if (startBtn) startBtn.addEventListener('click', showSession);
  if (exitBtn) exitBtn.addEventListener('click', closeEmotions);
  if (restartBtn) restartBtn.addEventListener('click', () => { resetState(); showSession(); });
  if (finishBtn) finishBtn.addEventListener('click', showComplete);
  if (sendBtn) sendBtn.addEventListener('click', sendMessage);

  if (inputField) {
    inputField.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
  }

  // Expose for other scripts (e.g. mega-nav "Gọi tên cảm xúc" link)
  window.openEmotionsExercise = openEmotions;
})();