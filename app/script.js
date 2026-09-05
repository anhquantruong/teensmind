const body = document.body;
const navToggle = document.getElementById('navToggle');
const navLinks = document.getElementById('navLinks');
const NAV_COLLAPSE_QUERY = '(max-width: 1024px)';

function closeNavMenu(){
  if(!navLinks || !navToggle) return;
  navLinks.classList.remove('open');
  navToggle.setAttribute('aria-expanded', 'false');
}
function openNavMenu(){
  if(!navLinks || !navToggle) return;
  navLinks.classList.add('open');
  navToggle.setAttribute('aria-expanded', 'true');
}
function toggleNavMenu(){
  if(!navLinks) return;
  if(navLinks.classList.contains('open')) closeNavMenu();
  else openNavMenu();
}

if(navToggle && navLinks){

  navToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleNavMenu();
  });

  document.addEventListener('click', (e) => {
    if(!window.matchMedia(NAV_COLLAPSE_QUERY).matches) return;
    if(navLinks.contains(e.target) || navToggle.contains(e.target)) return;
    closeNavMenu();
  });

  ['navHome', 'navAbout', 'navHelp', 'navWiki', 'navExercise'].forEach(id => {
    const el = document.getElementById(id);
    if(el){
      el.addEventListener('click', () => {
        if(window.matchMedia(NAV_COLLAPSE_QUERY).matches) closeNavMenu();
      });
    }
  });

  window.addEventListener('resize', () => {
    if(!window.matchMedia(NAV_COLLAPSE_QUERY).matches) closeNavMenu();
  });
}

const settingsBtn = document.getElementById('settingsBtn');
const settingsPanel = document.getElementById('settingsPanel');
const lightBtn = document.getElementById('lightBtn');
const darkBtn = document.getElementById('darkBtn');
const sizeBtns = document.querySelectorAll('.size-btn');
const viBtn = document.getElementById('viBtn');
const enBtn = document.getElementById('enBtn');

settingsBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  const isOpen = settingsPanel.classList.toggle('open');
  settingsBtn.setAttribute('aria-expanded', isOpen);
});
document.addEventListener('click', (e) => {
  if(!settingsPanel.contains(e.target) && e.target !== settingsBtn){
    settingsPanel.classList.remove('open');
    settingsBtn.setAttribute('aria-expanded', 'false');
  }
});

function setTheme(theme){
  body.setAttribute('data-theme', theme);
  lightBtn.classList.toggle('active', theme === 'light');
  darkBtn.classList.toggle('active', theme === 'dark');
}
lightBtn.addEventListener('click', () => setTheme('light'));
darkBtn.addEventListener('click', () => setTheme('dark'));

sizeBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    sizeBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.documentElement.style.setProperty('--font-scale', btn.dataset.scale);
  });
});
const HERO_TYPING_TEXT = {
  vi: 'Không gian tìm kiếm sự hỗ trợ tâm lý an toàn!',
  en: 'A respectful space to find mental health support!',
};
const heroTypingVi = document.getElementById('heroTypingVi');
const heroTypingEn = document.getElementById('heroTypingEn');
let heroTypingTimer = null;

function stopHeroTyping(){
  if(heroTypingTimer){
    clearInterval(heroTypingTimer);
    heroTypingTimer = null;
  }
  document.querySelectorAll('.typing-cursor').forEach(c => c.classList.remove('is-active'));
}

function typeHeroTitle(lang, instant){
  stopHeroTyping();
  const text = HERO_TYPING_TEXT[lang];
  const target = lang === 'vi' ? heroTypingVi : heroTypingEn;
  const other = lang === 'vi' ? heroTypingEn : heroTypingVi;
  const cursor = target.parentElement.querySelector('.typing-cursor');

  other.textContent = '';
  target.textContent = '';

  if(instant || window.matchMedia('(prefers-reduced-motion: reduce)').matches){
    target.textContent = text;
    return;
  }

  cursor.classList.add('is-active');
  let i = 0;
  const speed = lang === 'vi' ? 42 : 34;

  heroTypingTimer = setInterval(() => {
    if(i < text.length){
      target.textContent += text.charAt(i);
      i++;
    } else {
      stopHeroTyping();
    }
  }, speed);
}

function setLang(lang){
  body.setAttribute('data-lang', lang);
  viBtn.classList.toggle('active', lang === 'vi');
  enBtn.classList.toggle('active', lang === 'en');
  if(pageHome && !pageHome.classList.contains('hidden')) typeHeroTitle(lang);
  if(pageDirectory && !pageDirectory.classList.contains('hidden')) refreshDirectoryUI();
}
viBtn.addEventListener('click', () => setLang('vi'));
enBtn.addEventListener('click', () => setLang('en'));
typeHeroTitle(body.getAttribute('data-lang') || 'vi');

const navHome = document.getElementById('navHome');
const navAbout = document.getElementById('navAbout');
const navHelp = document.getElementById('navHelp');
const pageHome = document.getElementById('pageHome');
const pageAbout = document.getElementById('pageAbout');
const pageHelp = document.getElementById('pageHelp');
const pagePractice = document.getElementById('pagePractice');
const navDirectory = document.getElementById('navDirectory');
const pageDirectory = document.getElementById('pageDirectory');
const pageResults = document.getElementById('pageResults');
const navWiki = document.getElementById('navWiki');
const navExercise = document.getElementById('navExercise');
const pageWiki = document.getElementById('pageWiki');
let pendingPageAfterLogin = null;
const GATED_PAGES = ['wiki', 'practice'];

function isAuthed(){ return document.body.classList.contains('is-authed'); }

function goToGatedPage(page){
  if(isAuthed()){
    showPage(page);
  } else {
    pendingPageAfterLogin = page;
    if (typeof openAuthModal === 'function') openAuthModal();
  }
}

const footerDirectory = document.getElementById('footerDirectory');
if (footerDirectory) {
  footerDirectory.addEventListener('click', (e) => {
    e.preventDefault();
    showPage('directory');
  });
}
const footerAbout = document.getElementById('footerAbout');
footerAbout.addEventListener('click', (e) => {
  e.preventDefault();
  showPage('about');
});
const footerHelp = document.getElementById('footerHelp');
footerHelp.addEventListener('click', (e) => {
  e.preventDefault();
  showPage('help');
});
const footerHome = document.getElementById('footerHome');
footerHome.addEventListener('click', (e) => {
  e.preventDefault();
  showPage('home');
});
const footerFeedback = document.getElementById('footerFeedback');
const feedbackF = document.getElementById('feedbackForm');

if (footerFeedback && feedbackF) {
  footerFeedback.addEventListener('click', (e) => {
    e.preventDefault();

    showPage('help');

    setTimeout(() => {
      const y =
        feedbackF.getBoundingClientRect().top +
        window.scrollY -
        100;

      window.scrollTo({
        top: y,
        behavior: 'smooth'
      });
    }, 150);
  });
}

function showPage(page) {
  pageHome.classList.toggle('hidden', page !== 'home');
  pageAbout.classList.toggle('hidden', page !== 'about');
  pageHelp.classList.toggle('hidden', page !== 'help');
  pagePractice.classList.toggle('hidden', page !== 'practice');
  pageDirectory.classList.toggle('hidden', page !== 'directory');
  pageResults.classList.toggle('hidden', page !== 'results');
  pageWiki.classList.toggle('hidden', page !== 'wiki');

  [navHome, navAbout, navHelp, navWiki, navExercise].forEach(n => n && n.classList.remove('active'));
  if (navDirectory) navDirectory.classList.remove('active');

  if (page === 'home') navHome.classList.add('active');
  if (page === 'about') navAbout.classList.add('active');
  if (page === 'help') navHelp.classList.add('active');
  if (page === 'wiki') {
    navWiki.classList.add('active');
    if (typeof loadArticles === 'function') loadArticles();
  }
  if (page === 'practice') navExercise.classList.add('active');
  if (page === 'directory') {
    if (navDirectory) navDirectory.classList.add('active');
    ensureDirectoryLoaded();
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });

  if (page === 'home') {
    typeHeroTitle(body.getAttribute('data-lang') || 'vi');
  }
}
navHome.addEventListener('click', () => showPage('home'));
navAbout.addEventListener('click', () => showPage('about'));
navHelp.addEventListener('click', () => showPage('help'));
navWiki.addEventListener('click', () => goToGatedPage('wiki'));
navExercise.addEventListener('click', () => goToGatedPage('practice'));
if (navDirectory) {
  navDirectory.addEventListener('click', () => showPage('directory'));
}

const noticeOverlay = document.getElementById('noticeOverlay');
const noticeClose = document.getElementById('noticeClose');

function openNotice(){ noticeOverlay.classList.add('open'); }
function closeNotice(){ noticeOverlay.classList.remove('open'); }

noticeClose.addEventListener('click', closeNotice);
noticeOverlay.addEventListener('click', (e) => {
  if(e.target === noticeOverlay) closeNotice();
});

openNotice();
let answers = {};
let cursor = 0;
let geoPending = false;

function activeSteps(){
  return steps.filter(s => !s.showIf || s.showIf(answers));
}
function lang(){ return body.getAttribute('data-lang'); }
function t(obj){ return obj[lang()]; }

const overlay = document.getElementById('wizardOverlay');
const wizardBody = document.getElementById('wizardBody');
const progressBar = document.getElementById('progressBar');
const wfBack = document.getElementById('wfBack');
const wfNext = document.getElementById('wfNext');
const wizardFooter = document.getElementById('wizardFooter');

function openWizard(){
  answers = {};
  cursor = 0;
  overlay.classList.add('open');
  render();
}
function closeWizard(){ overlay.classList.remove('open'); }
function goToResults(){
  closeWizard();
  let location;

  if(answers.q4geo && !answers.q4geoDenied){
    location = { type: 'geo', coords: answers.q4geo };
  } else {
    const locationAnswer = answers.q4 || {};
    const provInfo = locationsState.provinces?.[locationAnswer.province];
    const wardInfo = provInfo?.wards?.[locationAnswer.ward];
    location = {
      type: 'manual',
      provinceVi: provInfo?.vi, provinceEn: provInfo?.en,
      wardVi: wardInfo?.vi, wardEn: wardInfo?.en,
    };
  }

  sessionStorage.setItem('mappingWizardResult', JSON.stringify({
    answers,
    location,
    recommendation: computeRecommendation(answers),
  }));

  showPage('results');
  if (window.PsyMapResults && typeof window.PsyMapResults.init === 'function') {
    window.PsyMapResults.init();
  }
}

document.getElementById('startBtn').addEventListener('click', openWizard);
document.getElementById('wizardClose').addEventListener('click', closeWizard);

function isAnswered(step){
  if(!step.required) return true;
  const v = answers[step.key];
  if(step.type === 'multi') return Array.isArray(v) && v.length > 0;
  if(step.type === 'text'){
    if(typeof v !== 'string' || v.trim().length === 0) return false;
    if(step.inputType === 'number'){
      const n = Number(v);
      return Number.isInteger(n) && n > 0 && n <= 120;
    }
    return true;
  }
  if(step.type === 'cascade') return v && v.province !== undefined && v.ward !== undefined;
  if(step.type === 'single') return v !== undefined;
  return true;
}

function recommendationMessage(rec){
  if(rec.redFlag){
    return {
      text: {
        vi: '⚠️ Hệ thống nhận thấy bạn có thể đang cần hỗ trợ khẩn cấp. Vui lòng liên hệ ngay đường dây nóng hoặc cơ sở cấp cứu gần nhất trước khi xem danh sách gợi ý.',
        en: '⚠️ Our system noticed you may need urgent support. Please contact a crisis hotline or the nearest emergency facility right away before viewing the suggestions.',
      },
      isEmergency: true,
    };
  }
  if(rec.recommendation === 'psychiatrist'){
    return {
      text: {
        vi: 'Hệ thống gợi ý bạn nên đi khám <b>Bác sĩ tâm thần</b> trước, dựa trên câu trả lời của bạn.',
        en: 'Based on your answers, our system suggests seeing a <b>psychiatrist</b> first.',
      },
      isEmergency: false,
    };
  }
  if(rec.recommendation === 'psychologist'){
    return {
      text: {
        vi: 'Hệ thống gợi ý bạn nên gặp <b>Nhà tâm lý</b> trước, dựa trên câu trả lời của bạn.',
        en: 'Based on your answers, our system suggests seeing a <b>psychologist</b> first.',
      },
      isEmergency: false,
    };
  }
  return {
    text: {
      vi: 'Hệ thống gợi ý bạn nên tìm cơ sở có cả <b>Bác sĩ tâm thần và Nhà tâm lý</b> làm việc theo ekip, để được đánh giá toàn diện hơn.',
      en: 'Our system suggests a facility with both a <b>psychiatrist and psychologist</b> working as a team, for a fuller assessment.',
    },
    isEmergency: false,
  };
}

function render(){
  const list = activeSteps();
  if(cursor >= list.length) cursor = list.length - 1;
  const step = list[cursor];
  const total = list.length - 2;
  const posInQuestions = list.slice(0, cursor).filter(s => s.type !== 'lang' && s.type !== 'done').length;

  progressBar.style.width = (step.type === 'lang') ? '0%'
    : (step.type === 'done') ? '100%'
    : Math.round(((posInQuestions + 1) / total) * 100) + '%';

  wizardFooter.style.display = (step.type === 'lang' || step.type === 'done') ? 'none' : 'flex';
  wfBack.disabled = cursor === 0;

  let html = '';

  if(step.type === 'lang'){
    html = `
      <div class="lang-gate">
        <div class="wizard-question" style="margin-bottom:16px;">Vui lòng chọn ngôn ngữ / Please select your language</div>
        <button class="lang-gate-btn" data-lang-pick="vi">Tiếng Việt <small>Vietnamese</small></button>
        <button class="lang-gate-btn" data-lang-pick="en">English <small>Tiếng Anh</small></button>
      </div>`;
  } else if(step.type === 'done'){
    const rec = computeRecommendation(answers);
    const recMsg = recommendationMessage(rec);
    html = `
      <div style="text-align:center; padding: 10px 0 18px;">
        <div class="done-icon">✓</div>
        <div class="wizard-question">${t({vi:'Cảm ơn bạn đã chia sẻ',en:'Thank you for sharing'})}</div>
        <div class="wizard-recommendation ${recMsg.isEmergency ? 'is-emergency' : ''}">${t(recMsg.text)}</div>
        <p class="wizard-hint">${t({vi:'Đang chuyển bạn đến trang kết quả gợi ý…',en:'Taking you to your results…'})}</p>
      </div>`;
    setTimeout(goToResults, 2600);
  } else {
    const stepNumLabel = t({vi:`Câu ${posInQuestions + 1} / ${total}`, en:`Question ${posInQuestions + 1} of ${total}`});
    html += `<div class="wizard-step-label">${stepNumLabel}</div>`;
    html += `<div class="wizard-question">${t(step.q)}</div>`;
    if(step.hint) html += `<div class="wizard-hint">${t(step.hint)}</div>`;
    else html += `<div class="wizard-hint" style="visibility:hidden">.</div>`;
    if(step.key === 'q4perm' && geoPending){
      html += `<div class="wizard-hint" style="color:var(--teal)">${t({vi:'Đang chờ bạn cấp quyền truy cập vị trí trên trình duyệt…', en:'Waiting for you to grant location access in your browser…'})}</div>`;
    }
    if(step.key === 'q4perm' && answers.q4permLocked){
      if(answers.q4geoDenied){
        html += `<div class="wizard-hint" style="color:var(--coral)">${t({
          vi: 'Trình duyệt của bạn không cấp quyền truy cập vị trí, hệ thống đã tự chuyển câu trả lời sang "Không đồng ý". Vui lòng chọn khu vực của bạn ở bước tiếp theo.',
          en: 'Your browser did not grant location access, so we automatically switched your answer to "Disagree". Please select your area in the next step.'
        })}</div>`;
      } else {
        html += `<div class="wizard-hint" style="color:var(--teal)">${t({
          vi: 'Bạn đã cấp quyền truy cập vị trí. Hãy tiếp tục sang câu hỏi sàng lọc tiếp theo.',
          en: 'You have granted location access. Please continue.'
        })}</div>`;
      }
    }

    if(step.type === 'single' || step.type === 'multi'){
      const selected = answers[step.key];
      const locked = step.key === 'q4perm' && answers.q4permLocked;
      html += `<div class="option-list ${step.grid ? 'grid' : ''} ${locked ? 'locked' : ''}">`;
      step.options.forEach((opt, i) => {
        const isSel = step.type === 'single' ? selected === i : Array.isArray(selected) && selected.includes(i);
        html += `<button type="button" class="option-card ${isSel ? 'selected' : ''}" data-opt="${i}" ${locked ? 'disabled' : ''}>
          <span class="option-check"></span><span>${t(opt)}</span></button>`;
      });
      html += `</div>`;
    }

    if(step.type === 'text'){
      const val = answers[step.key] || '';
      const inputType = step.inputType === 'number' ? 'number' : 'text';
      const extraAttrs = step.inputType === 'number' ? ' min="0" max="120" step="1" inputmode="numeric"' : '';
      const placeholderText = step.placeholder ? t(step.placeholder) : '';
      html += `<input class="text-input" id="textField" type="${inputType}" value="${String(val).replace(/"/g,'&quot;')}" placeholder="${placeholderText}"${extraAttrs}>`;
    }
    if(step.type === 'cascade'){

      if(locationsState.status !== 'ready'){
        if(locationsState.status === 'idle') ensureLocationsLoaded(render);
        if(locationsState.status === 'error'){
          html += `<div class="wizard-hint" style="color:var(--coral)">${t({vi:'Không tải được danh sách Tỉnh/Phường. ', en:'Could not load the Province/Ward list. '})}</div>
            <button type="button" class="wf-btn wf-back" id="retryLocations">${t({vi:'Thử lại', en:'Retry'})}</button>`;
        } else {
          html += `<div class="wizard-hint">${t({vi:'Đang tải danh sách Phường…', en:'Loading the Ward list…'})}</div>`;
        }
      } else {
        const cur = answers[step.key] || {};
        const provinces = locationsState.provinces;
        html += `<select class="select-input" id="provinceSelect">
          <option value="">${t({vi:'-- Chọn Tỉnh/Thành --', en:'-- Select Province/City --'})}</option>`;
        provinces.forEach((p, i) => {
          html += `<option value="${i}" ${cur.province === i ? 'selected' : ''}>${t(p)}</option>`;
        });
        html += `</select>`;
        html += `<select class="select-input" id="wardSelect" ${cur.province === undefined ? 'disabled' : ''}>
          <option value="">${t({vi:'-- Chọn Phường --', en:'-- Select Ward --'})}</option>`;
        if(cur.province !== undefined){
          provinces[cur.province].wards.forEach((w, i) => {
            html += `<option value="${i}" ${cur.ward === i ? 'selected' : ''}>${t(w)}</option>`;
          });
        }
        html += `</select>`;
      }
    }
  }

  wizardBody.innerHTML = html;
  bindStepEvents(step);
  wfNext.disabled = !isAnswered(step) || (step.key === 'q4perm' && geoPending);
  wfNext.innerHTML = (cursor === list.length - 2 && list[list.length-1].type === 'done')
    ? `<span lang-el="vi">Hoàn tất</span><span lang-el="en">Finish</span>`
    : `<span lang-el="vi">Tiếp theo</span><span lang-el="en">Next</span>`;
  applyLangAttrs();
}

function applyLangAttrs(){
}
function requestGeolocation(onDone){
  if(!navigator.geolocation){
    answers.q4geo = null;
    answers.q4geoDenied = true;
    if(onDone) onDone();
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      answers.q4geo = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      answers.q4geoDenied = false;
      if(onDone) onDone();
    },
    (err) => {
      console.error('Geolocation error (có thể do người dùng bấm "Don\'t allow"):', err);
      answers.q4geo = null;
      answers.q4geoDenied = true;
      if(onDone) onDone();
    },
    { enableHighAccuracy: true, timeout: 8000 }
  );
}

function bindStepEvents(step){
  if(step.type === 'lang'){
    wizardBody.querySelectorAll('[data-lang-pick]').forEach(btn => {
      btn.addEventListener('click', () => {
        setLang(btn.dataset.langPick);
        goNext();
      });
    });
    return;
  }

  if(step.type === 'single'){
    wizardBody.querySelectorAll('.option-card').forEach(btn => {
      btn.addEventListener('click', () => {
        if(step.key === 'q4perm' && answers.q4permLocked) return;

        const optIndex = parseInt(btn.dataset.opt);
        answers[step.key] = optIndex;
        if(step.key === 'q4perm' && optIndex === 0){
          answers.q4geoDenied = false;
          geoPending = true;
          render();
          requestGeolocation(() => {
            geoPending = false;
            if(answers.q4geoDenied){
              answers.q4perm = 1;
            } else {
              answers.q4perm = 0;
            }
            answers.q4permLocked = true;
            render();
          });
          return;
        }
        render();
      });
    });
  }

  if(step.type === 'multi'){
    wizardBody.querySelectorAll('.option-card').forEach(btn => {
      btn.addEventListener('click', () => {
        const i = parseInt(btn.dataset.opt);
        const arr = Array.isArray(answers[step.key]) ? answers[step.key].slice() : [];
        const idx = arr.indexOf(i);
        if(idx === -1) arr.push(i); else arr.splice(idx, 1);
        answers[step.key] = arr;
        render();
      });
    });
  }
  if(step.type === 'text'){
    const field = document.getElementById('textField');
    field.addEventListener('input', () => {
      let val = field.value;
      if(step.inputType === 'number'){
        val = val.replace(/[^\d]/g, '');
        if(field.value !== val) field.value = val;
      }
      answers[step.key] = val;
      wfNext.disabled = !isAnswered(step);
    });
  }
  if(step.type === 'cascade'){
    const retryBtn = document.getElementById('retryLocations');
    if(retryBtn){
      retryBtn.addEventListener('click', () => {
        locationsState.status = 'idle';
        ensureLocationsLoaded(render);
      });
    }
    const provinceSelect = document.getElementById('provinceSelect');
    const wardSelect = document.getElementById('wardSelect');
    if(provinceSelect){
      provinceSelect.addEventListener('change', () => {
        const pi = provinceSelect.value === '' ? undefined : parseInt(provinceSelect.value);
        answers[step.key] = { province: pi, ward: undefined };
        render();
      });
    }
    if(wardSelect){
      wardSelect.addEventListener('change', () => {
        const cur = answers[step.key] || {};
        const wi = wardSelect.value === '' ? undefined : parseInt(wardSelect.value);
        answers[step.key] = { ...cur, ward: wi };
        wfNext.disabled = !isAnswered(step);
      });
    }
  }
}

function goNext(){
  const list = activeSteps();
  if(cursor < list.length - 1){
    cursor++;
    render();
  }
}
function goBack(){
  if(cursor > 0){
    cursor--;
    render();
  }
}

wfNext.addEventListener('click', () => {

  const list = activeSteps();
  const step = list[cursor];
  if (step.type === 'done') {
    closeWizard();
    goToResults();
    return;
  }

  if (cursor === list.length - 1){
    closeWizard();
    return;
  }

  goNext();
});

wfBack.addEventListener('click', goBack);

function animateCounter(element) {
  const target = Number(element.dataset.target);
  const duration = 3000;
  const startTime = performance.now();

  function update(currentTime) {
    const progress = Math.min(
      (currentTime - startTime) / duration,
      1
    );

    const easedProgress = 1 - Math.pow(1 - progress, 3);
    const currentValue = Math.round(target * easedProgress);
    element.textContent = currentValue;

    if (progress < 1) {
      requestAnimationFrame(update);
    } else {
      element.textContent = Math.round(target);
    }
  }

  requestAnimationFrame(update);
}
const statsSection = document.querySelector('.stats-section');

if (statsSection) {
  const observer = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {

          document
            .querySelectorAll('.counter')
            .forEach(counter => {
              animateCounter(counter);
            });

          observer.unobserve(statsSection);
        }
      });
    },
    {
      threshold: 0.5
    }
  );

  observer.observe(statsSection);
}

const footer = document.querySelector('.site-footer');
const wordmark = document.querySelector('.wordmark');

if (footer && wordmark) {
  const footerObserver = new IntersectionObserver(
    ([entry]) => {
      wordmark.classList.toggle('footer-visible', entry.isIntersecting);
    },
    {
      threshold: 0
    }
  );

  footerObserver.observe(footer);
}

const feedbackForm = document.getElementById('feedbackForm');
const feedbackSuccess = document.getElementById('feedbackSuccess');
const feedbackAgain = document.getElementById('feedbackAgain');

if (feedbackForm && feedbackSuccess) {

  feedbackForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const submitBtn = feedbackForm.querySelector('.feedback-submit');
    const originalHTML = submitBtn ? submitBtn.innerHTML : '';

    const payload = {
      name: feedbackForm.name.value.trim(),
      email: feedbackForm.email.value.trim(),
      type: feedbackForm.type.value,
      message: feedbackForm.message.value.trim()
    };

    try {

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = (lang() === 'vi') ? 'Đang gửi...' : 'Sending...';
      }

      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      let result = {};
      try {
        result = await response.json();
      } catch {
        result = {};
      }

      if (!response.ok) {
        throw new Error(
          result.error ||
          (lang() === 'vi' ? 'Gửi feedback thất bại.' : 'Failed to send feedback.')
        );
      }

      feedbackForm.classList.add('hidden');
      feedbackSuccess.classList.remove('hidden');

    } catch (error) {

      console.error('Feedback submit error:', error);

      alert(
        error.message ||
        (lang() === 'vi'
          ? 'Gửi feedback thất bại. Vui lòng thử lại.'
          : 'Failed to send feedback. Please try again.')
      );

    } finally {

      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalHTML;
      }

    }
  });

  if (feedbackAgain) {
    feedbackAgain.addEventListener('click', () => {

      feedbackForm.reset();

      feedbackSuccess.classList.add('hidden');
      feedbackForm.classList.remove('hidden');

    });
  }
}
const directoryState = { status: 'idle', clinics: [] };

function escapeHtml(str){
  return String(str ?? '').replace(/[&<>"']/g, m => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]
  ));
}

async function ensureDirectoryLoaded(){
  if(directoryState.status === 'ready' || directoryState.status === 'loading') return;
  directoryState.status = 'loading';
  renderDirectoryStatus();
  try {
    const res = await fetch('/api/clinics');
    if(!res.ok) throw new Error('request failed');
    const data = await res.json();
    directoryState.clinics = Array.isArray(data) ? data : [];
    directoryState.status = 'ready';
    refreshDirectoryUI();
  } catch (err) {
    console.error('Failed to load clinics directory:', err);
    directoryState.status = 'error';
    renderDirectoryStatus();
  }
}

function refreshDirectoryUI(){
  if(directoryState.status !== 'ready') { renderDirectoryStatus(); return; }
  populateDirectoryFilters();
  renderDirectoryStatus();
  renderDirectoryList();
}

function renderDirectoryStatus(){
  const statusEl = document.getElementById('directoryStatus');
  if(!statusEl) return;
  if(directoryState.status === 'loading'){
    statusEl.textContent = lang() === 'vi' ? 'Đang tải danh sách cơ sở…' : 'Loading clinics…';
    statusEl.classList.remove('hidden');
  } else if(directoryState.status === 'error'){
    statusEl.textContent = lang() === 'vi'
      ? 'Không tải được danh sách cơ sở. Vui lòng thử lại.'
      : 'Could not load the directory. Please try again.';
    statusEl.classList.remove('hidden');
  } else {
    statusEl.classList.add('hidden');
  }
}

function populateDirectoryFilters(){
  const typeSelect = document.getElementById('directoryTypeFilter');
  const provSelect = document.getElementById('directoryProvFilter');
  if(!typeSelect || !provSelect) return;

  const prevType = typeSelect.value;
  const prevProv = provSelect.value;

  const types = [...new Set(directoryState.clinics.map(c => c.clinic_type).filter(Boolean))].sort();
  const provs = [...new Set(directoryState.clinics.map(c => c.prov).filter(Boolean))].sort();

  typeSelect.innerHTML =
    `<option value="">${lang() === 'vi' ? 'Tất cả loại hình' : 'All types'}</option>` +
    types.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('');
  provSelect.innerHTML =
    `<option value="">${lang() === 'vi' ? 'Tất cả tỉnh/thành' : 'All provinces'}</option>` +
    provs.map(p => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join('');

  if(types.includes(prevType)) typeSelect.value = prevType;
  if(provs.includes(prevProv)) provSelect.value = prevProv;

  updateWardFilterOptions();
}

function updateWardFilterOptions(){
  const provSelect = document.getElementById('directoryProvFilter');
  const wardSelect = document.getElementById('directoryWardFilter');
  if(!provSelect || !wardSelect) return;

  const provVal = provSelect.value;
  const prevWard = wardSelect.value;

  const wards = [...new Set(
    directoryState.clinics
      .filter(c => !provVal || c.prov === provVal)
      .map(c => c.ward)
      .filter(Boolean)
  )].sort();

  wardSelect.innerHTML =
    `<option value="">${lang() === 'vi' ? 'Tất cả phường' : 'All wards'}</option>` +
    wards.map(w => `<option value="${escapeHtml(w)}">${escapeHtml(w)}</option>`).join('');

  if(wards.includes(prevWard)) wardSelect.value = prevWard;
}

function renderDirectoryList(){
  const listEl = document.getElementById('directoryList');
  if(!listEl) return;

  const searchVal = (document.getElementById('directorySearch')?.value || '').trim().toLowerCase();
  const typeVal = document.getElementById('directoryTypeFilter')?.value || '';
  const provVal = document.getElementById('directoryProvFilter')?.value || '';
  const wardVal = document.getElementById('directoryWardFilter')?.value || '';

  const filtered = directoryState.clinics.filter(c => {
    if(typeVal && c.clinic_type !== typeVal) return false;
    if(provVal && c.prov !== provVal) return false;
    if(wardVal && c.ward !== wardVal) return false;
    if(searchVal){
      const haystack = [c.clinic_name, c.address, c.ward, c.prov]
        .filter(Boolean).join(' ').toLowerCase();
      if(!haystack.includes(searchVal)) return false;
    }
    return true;
  });

  if(filtered.length === 0){
    listEl.innerHTML = `<div class="directory-empty">${
      lang() === 'vi' ? 'Không tìm thấy cơ sở phù hợp.' : 'No matching clinics found.'
    }</div>`;
    return;
  }

  const headLabels = lang() === 'vi'
    ? ['Tên cơ sở', 'Loại hình', 'Địa chỉ', 'Phường', 'Tỉnh/Thành', 'Điện thoại', 'Website']
    : ['Clinic Name', 'Type', 'Address', 'Ward', 'Province/City', 'Phone', 'Website'];

  const rows = filtered.map(c => `
    <tr>
      <td class="dir-name">${escapeHtml(c.clinic_name || '')}</td>
      <td>${c.clinic_type ? `<span class="directory-type-tag">${escapeHtml(c.clinic_type)}</span>` : ''}</td>
      <td class="dir-address">${escapeHtml(c.address || '')}</td>
      <td>${escapeHtml(c.ward || '')}</td>
      <td>${escapeHtml(c.prov || '')}</td>
      <td>${c.phone ? `<a href="tel:${escapeHtml(c.phone)}">${escapeHtml(c.phone)}</a>` : ''}</td>
      <td>${c.website ? `<a href="${escapeHtml(c.website)}" target="_blank" rel="noopener noreferrer">${lang() === 'vi' ? 'Xem trang' : 'Visit site'}</a>` : ''}</td>
    </tr>
  `).join('');

  listEl.innerHTML = `
    <table class="directory-table">
      <thead>
        <tr>${headLabels.map(h => `<th>${h}</th>`).join('')}</tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

document.addEventListener('input', (e) => {
  if(e.target && e.target.id === 'directorySearch') renderDirectoryList();
});
document.addEventListener('change', (e) => {
  if(!e.target) return;
  if(e.target.id === 'directoryTypeFilter') renderDirectoryList();
  if(e.target.id === 'directoryProvFilter'){ updateWardFilterOptions(); renderDirectoryList(); }
  if(e.target.id === 'directoryWardFilter') renderDirectoryList();
});

document.querySelectorAll('.faq-card-head').forEach(btn => {
  btn.addEventListener('click', () => {
    const expanded = btn.getAttribute('aria-expanded') === 'true';
    btn.setAttribute('aria-expanded', String(!expanded));
  });
});

document.querySelectorAll('.reveal-on-scroll').forEach(section => {
  const observer = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          obs.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );
  observer.observe(section);
});

const emergencyFabBtn = document.getElementById('emergencyFabBtn');
const emergencyPanel = document.getElementById('emergencyPanel');

if (emergencyFabBtn && emergencyPanel) {
  emergencyFabBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = emergencyPanel.classList.toggle('open');
    emergencyFabBtn.setAttribute('aria-expanded', String(isOpen));
  });

  document.addEventListener('click', (e) => {
    if (!emergencyPanel.contains(e.target) && !emergencyFabBtn.contains(e.target)) {
      emergencyPanel.classList.remove('open');
      emergencyFabBtn.setAttribute('aria-expanded', 'false');
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      emergencyPanel.classList.remove('open');
      emergencyFabBtn.setAttribute('aria-expanded', 'false');
    }
  });
}