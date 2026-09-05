const SUPABASE_URL = 'https://xlbetyyfxkhpbrufnjdg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhsYmV0eXlmeGtocGJydWZuamRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0NzE4NTUsImV4cCI6MjEwMzA0Nzg1NX0.yI1hdE1cN9P7kMSS2oRU8X53lduChZXXlYlWawbcmP0';

let supabaseClient = null;
try {
  if (typeof window.supabase === 'undefined') {
    throw new Error('Thư viện Supabase chưa được tải (kiểm tra mạng/ad-blocker).');
  }
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: true
    }
  });
} catch (err) {
  console.error('Lỗi khởi tạo Supabase:', err.message);
}

const authOverlay = document.getElementById('authOverlay');
const appShell = document.getElementById('appShell');
const tabLogin = document.getElementById('tabLogin');
const tabRegister = document.getElementById('tabRegister');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const loginError = document.getElementById('loginError');
const registerError = document.getElementById('registerError');

const accountTrigger = document.getElementById('accountTrigger');
const accountPanel = document.getElementById('accountPanel');
const appUserName = document.getElementById('appUserName');
const appUserEmail = document.getElementById('appUserEmail');
const appUserAvatar = document.getElementById('appUserAvatar');
const appUserAvatarLg = document.getElementById('appUserAvatarLg');
const appLogoutBtn = document.getElementById('appLogoutBtn');
const SESSION_TIMEOUT_MS = 5 * 60 * 1000;
let sessionTimeoutId = null;

function startSessionTimeout(){
  clearSessionTimeout();
  sessionTimeoutId = setTimeout(async () => {
    if(supabaseClient) await supabaseClient.auth.signOut();
    accountPanel.classList.remove('open');
    renderLoggedOutState();
  }, SESSION_TIMEOUT_MS);
}

function clearSessionTimeout(){
  if(sessionTimeoutId){
    clearTimeout(sessionTimeoutId);
    sessionTimeoutId = null;
  }
}

function lang(){ return document.body.getAttribute('data-lang') || 'vi'; }
function msg(vi, en){ return lang() === 'vi' ? vi : en; }

function showError(el, text){
  el.textContent = text;
  el.classList.remove('hidden');
}
function clearError(el){
  el.textContent = '';
  el.classList.add('hidden');
}

function switchAuthTab(target){
  const showLogin = target === 'login';
  tabLogin.classList.toggle('active', showLogin);
  tabRegister.classList.toggle('active', !showLogin);
  loginForm.classList.toggle('hidden', !showLogin);
  loginForm.style.display = showLogin ? '' : 'none';
  registerForm.classList.toggle('hidden', showLogin);
  registerForm.style.display = showLogin ? 'none' : '';
}
tabLogin.addEventListener('click', () => switchAuthTab('login'));
tabRegister.addEventListener('click', () => switchAuthTab('register'));

document.querySelectorAll('.auth-eye-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const input = document.getElementById(btn.dataset.toggle);
    const icon = btn.querySelector('i');
    const isHidden = input.type === 'password';
    input.type = isHidden ? 'text' : 'password';
    icon.classList.toggle('fa-eye', !isHidden);
    icon.classList.toggle('fa-eye-slash', isHidden);
  });
});

function renderLoggedInState(user, profile){
  authOverlay.classList.add('hidden');
  appShell.classList.remove('hidden');

  const displayName = (profile && profile.full_name) || user.email;
  appUserName.textContent = displayName;
  appUserEmail.textContent = user.email;

  const initial = displayName.charAt(0).toUpperCase();
  const avatarUrl = profile && profile.avatar_url;
  [appUserAvatar, appUserAvatarLg].forEach(el => {
    if(avatarUrl){
      el.style.backgroundImage = `url('${avatarUrl}')`;
      el.textContent = '';
    } else {
      el.style.backgroundImage = '';
      el.textContent = initial;
    }
  });

  startSessionTimeout();
}

function renderLoggedOutState(){
  authOverlay.classList.remove('hidden');
  appShell.classList.add('hidden');
  clearSessionTimeout();
}

async function fetchProfile(userId){
  if(!supabaseClient) return null;
  const { data, error } = await supabaseClient
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if(error){
    console.error('Không lấy được hồ sơ user:', error.message);
    return null;
  }
  return data;
}

async function loadCurrentSession(){
  if(!supabaseClient){ renderLoggedOutState(); return; }
  const { data: { session } } = await supabaseClient.auth.getSession();
  if(session && session.user){
    const profile = await fetchProfile(session.user.id);
    renderLoggedInState(session.user, profile);
  } else {
    renderLoggedOutState();
  }
}

registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearError(registerError);

  if(!supabaseClient){
    showError(registerError, msg('Không thể kết nối máy chủ. Vui lòng thử lại sau.', 'Cannot connect to server. Please try again later.'));
    return;
  }

  const name = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim().toLowerCase();
  const password = document.getElementById('regPassword').value;
  const passwordConfirm = document.getElementById('regPasswordConfirm').value;

  if(!name){
    showError(registerError, msg('Vui lòng nhập họ tên.', 'Please enter your full name.'));
    return;
  }
  if(password.length < 6){
    showError(registerError, msg('Mật khẩu phải có ít nhất 6 ký tự.', 'Password must be at least 6 characters.'));
    return;
  }
  if(password !== passwordConfirm){
    showError(registerError, msg('Mật khẩu nhập lại không khớp.', 'Passwords do not match.'));
    return;
  }

  const submitBtn = registerForm.querySelector('.auth-submit');
  submitBtn.disabled = true;

  let data, error;
  try {
    ({ data, error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } }
    }));
  } catch (err) {
    submitBtn.disabled = false;
    showError(registerError, msg('Có lỗi xảy ra, vui lòng thử lại.', 'Something went wrong, please try again.'));
    console.error('Lỗi đăng ký:', err);
    return;
  }

  submitBtn.disabled = false;

  if(error){
    showError(registerError, error.message);
    return;
  }

  if(data.user){
    try {
      const { error: profileError } = await supabaseClient.from('users').upsert({
        id: data.user.id,
        email,
        full_name: name,
      });
      if(profileError) console.error('Lỗi tạo hồ sơ user:', profileError.message);
    } catch (err) {
      console.error('Lỗi tạo hồ sơ user:', err);
    }
  }

  if(data.session){
    await loadCurrentSession();
  } else {
    registerForm.reset();
    showError(registerError, msg(
      `Vui lòng kiểm tra email ${email} và bấm vào link xác nhận để hoàn tất đăng ký.`,
      `Please check ${email} and click the confirmation link to complete registration.`
    ));
  }
});

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearError(loginError);

  if(!supabaseClient){
    showError(loginError, msg('Không thể kết nối máy chủ. Vui lòng thử lại sau.', 'Cannot connect to server. Please try again later.'));
    return;
  }

  const email = document.getElementById('loginEmail').value.trim().toLowerCase();
  const password = document.getElementById('loginPassword').value;

  const submitBtn = loginForm.querySelector('.auth-submit');
  submitBtn.disabled = true;

  let data, error;
  try {
    ({ data, error } = await supabaseClient.auth.signInWithPassword({ email, password }));
  } catch (err) {
    submitBtn.disabled = false;
    showError(loginError, msg('Có lỗi xảy ra, vui lòng thử lại.', 'Something went wrong, please try again.'));
    console.error('Lỗi đăng nhập:', err);
    return;
  }

  submitBtn.disabled = false;

  if(error){
    const rawMsg = (error.message || '').toLowerCase();
    if(rawMsg.includes('email not confirmed')){
      showError(loginError, msg(
        'Vui lòng kiểm tra email và bấm vào link xác nhận trước khi đăng nhập.',
        'Please check your email and click the confirmation link before logging in.'
      ));
    } else if(rawMsg.includes('invalid login credentials')){
      showError(loginError, msg('Email hoặc mật khẩu không đúng.', 'Incorrect email or password.'));
    } else {
      showError(loginError, msg('Đăng nhập thất bại. Vui lòng thử lại.', 'Login failed. Please try again.'));
    }
    console.error('Supabase signIn error:', error.message);
    return;
  }

  let profile = null;
  try {
    await supabaseClient
      .from('users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', data.user.id);
  } catch (err) {
    console.error('Không cập nhật được last_login_at:', err);
  }

  try {
    profile = await fetchProfile(data.user.id);
  } catch (err) {
    console.error('Không lấy được hồ sơ user:', err);
  }

  renderLoggedInState(data.user, profile);
});

appLogoutBtn.addEventListener('click', async () => {
  if(supabaseClient) await supabaseClient.auth.signOut();
  accountPanel.classList.remove('open');
  clearSessionTimeout();
  renderLoggedOutState();
});

accountTrigger.addEventListener('click', (e) => {
  e.stopPropagation();
  const isOpen = accountPanel.classList.toggle('open');
  accountTrigger.setAttribute('aria-expanded', String(isOpen));
});
document.addEventListener('click', (e) => {
  if(!accountPanel.contains(e.target) && !accountTrigger.contains(e.target)){
    accountPanel.classList.remove('open');
    accountTrigger.setAttribute('aria-expanded', 'false');
  }
});

document.querySelectorAll('.app-nav-item[data-section]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.app-nav-item[data-section]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const target = btn.dataset.section;
    document.querySelectorAll('.app-section').forEach(sec => {
      sec.classList.toggle('hidden', sec.id !== 'section' + target.charAt(0).toUpperCase() + target.slice(1));
    });
  });
});

document.getElementById('appLangBtn').addEventListener('click', () => {
  const newLang = lang() === 'vi' ? 'en' : 'vi';
  document.body.setAttribute('data-lang', newLang);
});

const readingGrid = document.getElementById("readingGrid");
const articleOverlay = document.getElementById("articleOverlay");
const articleReaderCover = document.getElementById("articleReaderCover");
const articleReaderTitle = document.getElementById("articleReaderTitle");
const articleReaderSubtitle = document.getElementById("articleReaderSubtitle");
const articleReaderBody = document.getElementById("articleReaderBody");
const articleCloseBtn = document.getElementById("articleCloseBtn");

let publishedArticles = [];

function escapeAppHTML(value){
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function loadArticles(){
  if(!readingGrid) return;
  try{
    const response = await fetch("/api/articles");
    if(!response.ok) throw new Error("Failed to load articles.");
    publishedArticles = await response.json();
    renderReadingGrid();
  }catch(err){
    console.error("Không tải được bài viết:", err.message);
    readingGrid.innerHTML = `<p class="reading-empty">${msg("Không tải được bài viết.", "Could not load articles.")}</p>`;
  }
}

function formatArticleDate(value){
  if(!value) return "";
  const date = new Date(value);
  if(Number.isNaN(date.getTime())) return "";

  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const mo = String(date.getMonth() + 1).padStart(2, "0");

  return `${hh}:${mm}, ${dd}/${mo}/${date.getFullYear()}`;
}

function renderReadingGrid(){
  if(!readingGrid) return;
  if(publishedArticles.length === 0){
    readingGrid.innerHTML = `<p class="reading-empty">${msg("Ú Oà!!! Xin nhỗi cục vàng nhiều😍 Chúng mình sẽ cập nhật các bài viết trong giai đoạn tới nhé", "No articles yet.")}</p>`;
    return;
  }

  readingGrid.innerHTML = publishedArticles.map(a => `
    <button class="reading-row" data-id="${a.id}" type="button">
      <img class="reading-row-img" src="${a.cover_image_url || ''}" alt=""
           loading="lazy" onerror="this.style.display='none'">
      <span class="reading-row-body">
        <span class="reading-row-title">${escapeAppHTML(a.title)}</span>
        <span class="reading-row-time">${formatArticleDate(a.created_at)}</span>
        <span class="reading-row-excerpt">${escapeAppHTML(a.subtitle)}</span>
      </span>
    </button>
  `).join("");

  readingGrid.querySelectorAll(".reading-row").forEach(row => {
    row.addEventListener("click", () => openArticle(row.dataset.id));
  });
}

async function openArticle(id){
  try{
    const response = await fetch(`/api/articles/${id}`);
    if(!response.ok) throw new Error("Failed to load article.");
    const article = await response.json();

    if(article.cover_image_url){
      articleReaderCover.src = article.cover_image_url;
      articleReaderCover.classList.remove("hidden");
    } else {
      articleReaderCover.classList.add("hidden");
    }
    articleReaderTitle.textContent = article.title || "";
    articleReaderSubtitle.textContent = article.subtitle || "";

    articleReaderBody.innerHTML = window.DOMPurify
      ? DOMPurify.sanitize(article.content || "")
      : "";

    articleOverlay.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  }catch(err){
    console.error("Không mở được bài viết:", err.message);
  }
}

function closeArticle(){
  articleOverlay.classList.add("hidden");
  document.body.style.overflow = "";
}

articleCloseBtn?.addEventListener("click", closeArticle);
articleOverlay?.addEventListener("click", (e) => { if(e.target === articleOverlay) closeArticle(); });

loadArticles();
loadCurrentSession();

if(supabaseClient){
  supabaseClient.auth.onAuthStateChange(async (event, session) => {
    if(event === 'SIGNED_OUT'){
      renderLoggedOutState();
    }
    if(event === 'SIGNED_IN' && session){
      const profile = await fetchProfile(session.user.id);
      renderLoggedInState(session.user, profile);
    }
  });
}