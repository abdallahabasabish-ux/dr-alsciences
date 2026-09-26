// ============================================================
// نظام التنقل الاحترافي:
// - Desktop (≥1024): Sidebar ثابتة يمين (RTL) قابلة للتصغير + Tooltips
// - Tablet/Mobile (<1024): Drawer ينزلق من اليمين + Overlay
// - Accordion للمراحل + قوائم حسب الدور (زائر/طالب/أدمن)
// - إغلاق: X / Overlay / رابط / Escape — مع منع تمرير الخلفية
// - يُولَّد كله داخل #siteHeaderRoot — الصفحات لا تُعدَّل
// ============================================================
import { auth, isConfigured, fbAuthNS, fbStoreNS } from './firebase-config.js';
import { injectIcons, showToast, hidePreloader } from './utils.js';

const { onAuthStateChanged, signOut } = fbAuthNS;
const { doc, getDoc } = fbStoreNS;

const ROOT = location.pathname.includes('/admin/') ? '../' : '';
const LOGO = ROOT + 'assets/icons/logo.svg';

/* ---------- رمزان إضافيان للقائمة (يُحقنان في Sprite الموجود) ---------- */
const EXTRA_SYMBOLS = `
<symbol id="i-home" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m3 10.5 9-7 9 7"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/></symbol>
<symbol id="i-grid" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/></symbol>`;

/* ---------- تعريف عناصر القائمة (الترتيب حسب المواصفة) ---------- */
const ITEMS = {
  home:    { href: 'index.html',             icon: 'i-home',       label: 'الرئيسية',       pages: ['home'] },
  stages:  { href: 'stages.html',            icon: 'i-layers',     label: 'المراحل الدراسية', pages: ['stages', 'grade', 'subject', 'lesson'],
             children: [
               { href: 'stages.html#primary',   label: 'الابتدائي' },
               { href: 'stages.html#prep',      label: 'الإعدادي' },
               { href: 'stages.html#secondary', label: 'الثانوي' },
             ] },
  courses: { href: 'courses.html',           icon: 'i-cap',        label: 'الكورسات',       pages: ['courses', 'courseDetail'] },
  lessons: { href: 'lessons.html',           icon: 'i-book',       label: 'الدروس',         pages: ['lessons'] },
  quizzes: { href: 'quizzes.html',           icon: 'i-list-check', label: 'الاختبارات',     pages: ['quizzes', 'quiz'] },
  results: { href: 'results.html',           icon: 'i-award',      label: 'نتائجي',         pages: ['results'],            student: true },
  progress:{ href: 'student-dashboard.html', icon: 'i-chart',      label: 'تقدمي',          pages: ['dashboard'],          student: true },
  profile: { href: 'profile.html',           icon: 'i-user',       label: 'الملف الشخصي',   pages: ['profile'],            student: true },
  about:   { href: 'about.html',             icon: 'i-info',       label: 'عن المنصة',      pages: ['about'] },
  contact: { href: 'contact.html',           icon: 'i-mail',       label: 'تواصل معنا',     pages: ['contact'] },
};
const MAIN_ORDER = ['home', 'stages', 'courses', 'lessons', 'quizzes', 'results', 'progress', 'profile', 'about', 'contact'];

const ADMIN_ITEMS = [
  { href: 'admin/index.html',    icon: 'i-grid',       label: 'لوحة الإدارة' },
  { href: 'admin/students.html', icon: 'i-users',      label: 'إدارة الطلاب' },
  { href: 'admin/stages.html',   icon: 'i-layers',     label: 'إدارة المراحل' },
  { href: 'admin/subjects.html', icon: 'i-flask',      label: 'إدارة المواد' },
  { href: 'admin/lessons.html',  icon: 'i-book',       label: 'إدارة الدروس' },
  { href: 'admin/courses.html',  icon: 'i-cap',        label: 'إدارة الكورسات' },
  { href: 'admin/quizzes.html',  icon: 'i-list-check', label: 'إدارة الاختبارات' },
  { href: 'admin/results.html',  icon: 'i-award',      label: 'النتائج' },
];

const logoHTML = () => `
  <img class="brand-logo" src="${LOGO}" alt="شعار الدكتور في العلوم"
       onerror="this.style.display='none';this.nextElementSibling.style.display='grid'">
  <span class="brand-mark" style="display:none"><svg class="icon"><use href="#i-atom"/></svg></span>`;

/* ---------- قائمة عناصر مشتركة (تُحقن في الـ Sidebar والـ Drawer) ---------- */
function navListHTML() {
  const page = document.body.dataset.page;
  const link = (it, extra = '') => {
    const active = it.pages?.includes(page);
    return `
    <li class="sb-item ${extra}">
      <a class="sb-link${active ? ' is-active' : ''}" href="${ROOT}${it.href}" data-tip="${it.label}"${active ? ' aria-current="page"' : ''}>
        <svg class="icon"><use href="#${it.icon}"/></svg>
        <span class="sb-label">${it.label}</span>
      </a>
    </li>`;
  };

  const stagesSub = ITEMS.stages.children.map((c) => {
    const active = page === 'stages' && location.hash && location.hash === '#' + c.href.split('#')[1];
    return `<li><a class="sb-sublink${active ? ' is-active' : ''}" href="${ROOT}${c.href}"><span class="sb-label">${c.label}</span></a></li>`;
  }).join('');

  const mainItems = MAIN_ORDER.map((key) => {
    const it = ITEMS[key];
    if (it.children) {
      return `
      <li class="sb-item sb-acc">
        <button class="sb-link sb-acc-btn${page && it.pages.includes(page) ? ' is-active' : ''}" type="button"
                data-acc aria-expanded="false" aria-controls="sbSubStages" data-tip="${it.label}">
          <svg class="icon"><use href="#${it.icon}"/></svg>
          <span class="sb-label">${it.label}</span>
          <svg class="icon sb-chev"><use href="#i-chevron-down"/></svg>
        </button>
        <ul class="sb-sub" id="sbSubStages">${stagesSub}</ul>
      </li>`;
    }
    return link(it, it.student ? 'js-student-only' : '');
  }).join('');

  const adminItems = ADMIN_ITEMS.map((it) => `
    <li class="sb-item">
      <a class="sb-link" href="${ROOT}${it.href}" data-tip="${it.label}">
        <svg class="icon"><use href="#${it.icon}"/></svg>
        <span class="sb-label">${it.label}</span>
      </a>
    </li>`).join('');

  return `
  <ul class="sb-list">${mainItems}</ul>
  <div class="sb-sep sb-label"></div>
  <ul class="sb-list js-admin-only" hidden>${adminItems}</ul>`;
}

const authSlotHTML = `
  <a class="sb-link js-when-guest" href="${ROOT}login.html">
    <svg class="icon"><use href="#i-user"/></svg><span class="sb-label">تسجيل الدخول</span>
  </a>
  <button class="sb-link js-when-user js-logout" type="button" hidden>
    <svg class="icon"><use href="#i-logout"/></svg><span class="sb-label">تسجيل الخروج</span>
  </button>`;

const userBlockHTML = `
  <a class="sb-user js-when-user" href="${ROOT}profile.html" hidden>
    <span class="avatar sb-avatar" data-av>ب</span>
    <span class="sb-label sb-user-text"><b class="sb-name">…</b><small>ملفي الشخصي</small></span>
  </a>
  <a class="sb-user js-when-guest" href="${ROOT}login.html">
    <span class="avatar sb-avatar"><svg class="icon"><use href="#i-user"/></svg></span>
    <span class="sb-label sb-user-text"><b>زائر</b><small>سجّل الدخول للتعلم</small></span>
  </a>`;

/* ---------- الـ Sidebar (كمبيوتر) ---------- */
function sidebarHTML() {
  return `
  <aside class="app-sidebar" id="appSidebar" aria-label="القائمة الجانبية">
    <a class="sb-brand" href="${ROOT}index.html">${logoHTML()}<span class="sb-label sb-brand-name">الدكتور <b>في العلوم</b></span></a>
    ${userBlockHTML()}
    <nav class="sb-nav">${navListHTML()}</nav>
    <div class="sb-foot">
      ${authSlotHTML}
      <button class="sb-link sb-collapse" id="sbCollapse" type="button" aria-label="تصغير القائمة">
        <svg class="icon"><use href="#i-arrow-left"/></svg><span class="sb-label">تصغير القائمة</span>
      </button>
    </div>
  </aside>`;
}

/* ---------- الهيدر ---------- */
function headerHTML() {
  const page = document.body.dataset.page;
  const short = [
    { href: 'index.html', label: 'الرئيسية', on: page === 'home' },
    { href: 'courses.html', label: 'الكورسات', on: page === 'courses' || page === 'courseDetail' },
    { href: 'quizzes.html', label: 'الاختبارات', on: page === 'quizzes' || page === 'quiz' },
  ].map((l) => `<a href="${ROOT}${l.href}" class="${l.on ? 'is-active' : ''}">${l.label}</a>`).join('');

  return `
  <header class="site-header" id="siteHeader">
    <div class="container header-inner">
      <a href="${ROOT}index.html" class="brand" aria-label="الدكتور في العلوم — الرئيسية">
        ${logoHTML()}<span class="brand-name">الدكتور <b>في العلوم</b></span>
      </a>
      <nav class="main-nav top-links" aria-label="روابط سريعة">${short}</nav>
      <div class="header-actions">
        <div class="hdr-auth" id="authLinks">
          <a href="${ROOT}login.html" class="btn btn-ghost btn-sm">
            <svg class="icon"><use href="#i-user"/></svg><span class="btn-label">تسجيل الدخول</span>
          </a>
        </div>
        <div class="user-chip" id="userChip" hidden>
          <button id="userChipBtn" class="user-chip-btn" aria-haspopup="true">
            <span class="avatar" id="userInitial">ب</span>
            <span class="user-name" id="userName">حسابي</span>
            <svg class="icon"><use href="#i-chevron-down"/></svg>
          </button>
          <div class="user-menu" id="userMenu" hidden>
            <a href="${ROOT}student-dashboard.html"><svg class="icon"><use href="#i-chart"/></svg> تقدمي</a>
            <a href="${ROOT}profile.html"><svg class="icon"><use href="#i-user"/></svg> ملفي الشخصي</a>
            <button id="logoutBtn" class="danger"><svg class="icon"><use href="#i-logout"/></svg> تسجيل الخروج</button>
          </div>
        </div>
        <button class="menu-btn" id="menuBtn" aria-expanded="false" aria-controls="mDrawer" aria-label="فتح القائمة">
          <svg class="icon icon-open"><use href="#i-menu"/></svg>
          <svg class="icon icon-close" hidden><use href="#i-close"/></svg>
        </button>
      </div>
    </div>
  </header>`;
}

/* ---------- الـ Drawer (تابلت/هاتف) — ينزلق من اليمين ---------- */
function drawerHTML() {
  return `
  <div class="nav-backdrop" id="navBackdrop"></div>
  <aside class="m-drawer" id="mDrawer" aria-label="قائمة التنقل" aria-hidden="true">
    <div class="m-head">
      <a class="sb-brand" href="${ROOT}index.html">${logoHTML()}<span class="sb-brand-name">الدكتور <b>في العلوم</b></span></a>
      <button class="m-close" id="drawerClose" aria-label="إغلاق القائمة">
        <svg class="icon"><use href="#i-close"/></svg>
      </button>
    </div>
    ${userBlockHTML()}
    <nav class="sb-nav">${navListHTML()}</nav>
    <div class="sb-foot">${authSlotHTML}</div>
  </aside>`;
}

function footerHTML() {
  return `
  <footer class="site-footer">
    <div class="container footer-grid">
      <div class="footer-brand">
        <a href="${ROOT}index.html" class="brand" aria-label="الدكتور في العلوم">${logoHTML()}<span class="brand-name">الدكتور <b>في العلوم</b></span></a>
        <p>منصة عربية متخصصة في تعليم العلوم لجميع المراحل الدراسية: دروس مبسطة، فيديوهات، ملفات، واختبارات إلكترونية مع متابعة تقدم الطالب خطوة بخطوة.</p>
      </div>
      <nav aria-label="روابط الموقع">
        <h4>روابط سريعة</h4>
        <ul class="footer-links">
          <li><a href="${ROOT}index.html">الرئيسية</a></li>
          <li><a href="${ROOT}courses.html">الكورسات</a></li>
          <li><a href="${ROOT}quizzes.html">الاختبارات</a></li>
          <li><a href="${ROOT}about.html">من نحن</a></li>
          <li><a href="${ROOT}contact.html">تواصل معنا</a></li>
        </ul>
      </nav>
      <nav aria-label="المراحل الدراسية">
        <h4>المراحل الدراسية</h4>
        <ul class="footer-links">
          <li><a href="${ROOT}stages.html#primary">المرحلة الابتدائية</a></li>
          <li><a href="${ROOT}stages.html#prep">المرحلة الإعدادية</a></li>
          <li><a href="${ROOT}stages.html#secondary">المرحلة الثانوية</a></li>
        </ul>
      </nav>
      <div>
        <h4>تواصل معنا</h4>
        <!-- عدّل بيانات التواصل من هنا فقط -->
        <ul class="footer-contact">
          <li><svg class="icon"><use href="#i-phone"/></svg> <span dir="ltr">+20 100 000 0000</span></li>
          <li><svg class="icon"><use href="#i-mail"/></svg> <span dir="ltr">support@example.com</span></li>
          <li><svg class="icon"><use href="#i-map-pin"/></svg> <span>مصر</span></li>
        </ul>
        <div class="footer-legal">
          <a href="${ROOT}privacy.html">سياسة الخصوصية</a>
          <a href="${ROOT}terms.html">الشروط والأحكام</a>
        </div>
      </div>
    </div>
    <div class="footer-bar container">
      <span>© <span id="year"></span> الدكتور في العلوم — جميع الحقوق محفوظة.</span>
      <span>صُنع بعناية من أجل طلاب العلوم.</span>
    </div>
  </footer>`;
}

/* ---------- حالة المستخدم في كل مواضع الهوية ---------- */
function applyAvatar(el, userDoc, name) {
  if (userDoc?.photoUrl) {
    el.style.backgroundImage = `url("${userDoc.photoUrl}")`;
    el.style.backgroundSize = 'cover';
    el.style.backgroundPosition = 'center';
    el.textContent = '';
  } else {
    el.style.backgroundImage = '';
    el.textContent = (name || 'ب').charAt(0);
  }
}

function renderAuthState(user, userDoc) {
  const logged = !!user;
  const name = (userDoc?.name || user?.displayName || '').trim();

  document.querySelectorAll('.js-when-guest').forEach((el) => (el.hidden = logged));
  document.querySelectorAll('.js-when-user').forEach((el) => (el.hidden = !logged));
  document.querySelectorAll('.js-student-only').forEach((el) => (el.hidden = !logged));
  document.querySelector('.js-admin-only')?.toggleAttribute('hidden', !(userDoc?.role === 'admin'));

  if (logged) {
    document.querySelectorAll('[data-av]').forEach((el) => applyAvatar(el, userDoc, name));
    document.querySelectorAll('.sb-name').forEach((el) => (el.textContent = name || 'حسابي'));
    const chip = document.getElementById('userChip');
    const links = document.getElementById('authLinks');
    if (chip) chip.hidden = false;
    if (links) links.hidden = true;
    const init = document.getElementById('userInitial');
    if (init) applyAvatar(init, userDoc, name);
    const nm = document.getElementById('userName');
    if (nm) nm.textContent = name || 'حسابي';
  } else {
    const chip = document.getElementById('userChip');
    const links = document.getElementById('authLinks');
    if (chip) chip.hidden = true;
    if (links) links.hidden = false;
  }
}

let currentUser = null;

/** تحديث الهوية بعد رفع صورة أو حفظ الملف */
export async function refreshHeaderUser() {
  if (!currentUser) return;
  try {
    const s = await getDoc(doc(db, 'users', currentUser.uid));
    if (s.exists()) renderAuthState(currentUser, s.data());
  } catch { /* تجاهل */ }
}

export function initLayout() {
  injectIcons();
  document.getElementById('icon-sprite')?.insertAdjacentHTML('beforeend', EXTRA_SYMBOLS);

  const hRoot = document.getElementById('siteHeaderRoot');
  if (hRoot) hRoot.innerHTML = sidebarHTML() + headerHTML() + drawerHTML();
  const fRoot = document.getElementById('siteFooterRoot');
  if (fRoot) fRoot.innerHTML = footerHTML();

  /* ---------- Drawer: فتح/إغلاق (Overlay + X + رابط + Escape) ---------- */
  const drawer = document.getElementById('mDrawer');
  const backdrop = document.getElementById('navBackdrop');
  const menuBtn = document.getElementById('menuBtn');
  const drawerOpen = () => document.body.classList.contains('nav-open');
  const setDrawer = (open) => {
    document.body.classList.toggle('nav-open', open);
    document.documentElement.classList.toggle('nav-locked', open);
    if (menuBtn) {
      menuBtn.setAttribute('aria-expanded', String(open));
      menuBtn.setAttribute('aria-label', open ? 'إغلاق القائمة' : 'فتح القائمة');
      const io = menuBtn.querySelector('.icon-open'), ic = menuBtn.querySelector('.icon-close');
      if (io) io.hidden = open;
      if (ic) ic.hidden = !open;
    }
    if (drawer) drawer.setAttribute('aria-hidden', String(!open));
    if (open) drawer?.querySelector('.sb-link, .m-close')?.focus();
  };
  const closeDrawer = () => setDrawer(false);

  menuBtn?.addEventListener('click', () => setDrawer(!drawerOpen()));
  document.getElementById('drawerClose')?.addEventListener('click', closeDrawer);
  backdrop?.addEventListener('click', closeDrawer);
  drawer?.addEventListener('click', (e) => { if (e.target.closest('a')) closeDrawer(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && drawerOpen()) closeDrawer();
  });
  window.addEventListener('resize', () => { if (window.innerWidth >= 1024 && drawerOpen()) closeDrawer(); });

  /* ---------- Accordion: فتح واحد في كل مرة ---------- */
  document.querySelectorAll('[data-acc]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const collapsed = document.body.classList.contains('sb-collapsed') && window.innerWidth >= 1024;
      if (collapsed) { toggleCollapse(false); } // مفعّل: اضغط المراحل والقائمة مصغرة → تتوسع أولًا
      const item = btn.closest('.sb-acc');
      const sub = item?.querySelector('.sb-sub');
      if (!sub) return;
      const isOpen = item.classList.contains('is-open');
      /* إغلاق بقية الأكورديونات في نفس القائمة */
      item.closest('.sb-nav')?.querySelectorAll('.sb-acc.is-open').forEach((o) => {
        if (o !== item) {
          o.classList.remove('is-open');
          o.querySelector('[data-acc]')?.setAttribute('aria-expanded', 'false');
          const s = o.querySelector('.sb-sub');
          if (s) s.style.maxHeight = '0px';
        }
      });
      item.classList.toggle('is-open', !isOpen);
      btn.setAttribute('aria-expanded', String(!isOpen));
      sub.style.maxHeight = !isOpen ? sub.scrollHeight + 'px' : '0px';
    });
  });

  /* ---------- تصغير الـ Sidebar (كمبيوتر) ---------- */
  function toggleCollapse(collapsed) {
    document.body.classList.toggle('sb-collapsed', collapsed);
    try { localStorage.setItem('sbCollapsed', collapsed ? '1' : '0'); } catch { /* تجاهل */ }
  }
  try { if (localStorage.getItem('sbCollapsed') === '1') toggleCollapse(true); } catch { /* تجاهل */ }
  document.getElementById('sbCollapse')?.addEventListener('click', () =>
    toggleCollapse(!document.body.classList.contains('sb-collapsed')));

  /* ---------- ظل الهيدر ---------- */
  const header = document.getElementById('siteHeader');
  if (header) {
    window.addEventListener('scroll', () =>
      header.classList.toggle('is-scrolled', window.scrollY > 8), { passive: true });
  }

  /* ---------- حركات الظهور ---------- */
  const revealEls = document.querySelectorAll('.reveal');
  if (revealEls.length) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('is-visible'); io.unobserve(e.target); }
      });
    }, { threshold: 0.12 });
    revealEls.forEach((el) => io.observe(el));
  }

  const year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();

  /* ---------- قائمة الحساب بالهيدر ---------- */
  const chipBtn = document.getElementById('userChipBtn');
  const userMenu = document.getElementById('userMenu');
  chipBtn?.addEventListener('click', (e) => { e.stopPropagation(); if (userMenu) userMenu.hidden = !userMenu.hidden; });
  document.addEventListener('click', (e) => {
    if (userMenu && !userMenu.hidden && !e.target.closest('.user-chip')) userMenu.hidden = true;
  });

  /* ---------- تسجيل الخروج (كل المواضع) ---------- */
  const doLogout = async () => {
    try {
      await signOut(auth);
      closeDrawer();
      if (userMenu) userMenu.hidden = true;
      showToast('تم تسجيل الخروج بنجاح');
      if (document.body.dataset.protected === 'true') location.href = ROOT + 'index.html';
      else renderAuthState(null, null);
    } catch { showToast('تعذر تسجيل الخروج، حاول مرة أخرى', 'error'); }
  };
  document.querySelectorAll('.js-logout').forEach((b) => b.addEventListener('click', doLogout));
  document.getElementById('logoutBtn')?.addEventListener('click', doLogout);

  /* ---------- حالة الدخول من نظام Firebase الحالي ---------- */
  if (isConfigured) {
    onAuthStateChanged(auth, async (user) => {
      currentUser = user;
      if (!user) { renderAuthState(null, null); return; }
      renderAuthState(user, null);
      try {
        const s = await getDoc(doc(db, 'users', user.uid));
        renderAuthState(user, s.exists() ? s.data() : null);
      } catch { /* تجاهل */ }
    });
  }

  /* إخفاء شاشة التحميل (الصفحات المحمية تخفيها بنفسها) */
  if (document.body.dataset.protected !== 'true') {
    requestAnimationFrame(() => requestAnimationFrame(hidePreloader));
  }
}
