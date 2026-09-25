// ============================================================
// الهوية المشتركة: توليد الهيدر والفوتر لكل الصفحات تلقائيًا
// - الشعار من assets/icons/logo.svg (مع بديل تلقائي إن غاب)
// - زر القائمة عنصر مستقل أقصى اليسار على الهاتف (لا يتزاحم أبدًا)
// - قائمة موبايل محصّنة (تفويض أحداث) + حالة الدخول + Preloader
// ============================================================
import { auth, isConfigured, fbAuthNS, fbStoreNS } from './firebase-config.js';
import { injectIcons, showToast, hidePreloader } from './utils.js';

const { onAuthStateChanged, signOut } = fbAuthNS;
const { doc, getDoc } = fbStoreNS;

const ROOT = location.pathname.includes('/admin/') ? '../' : '';
const LOGO = ROOT + 'assets/icons/logo.svg';

const NAV = [
  { key: 'home', href: 'index.html', label: 'الرئيسية' },
  { key: 'stages', href: 'stages.html', label: 'المراحل الدراسية' },
  { key: 'courses', href: 'courses.html', label: 'الكورسات' },
  { key: 'quizzes', href: 'quizzes.html', label: 'الاختبارات' },
  { key: 'about', href: 'about.html', label: 'من نحن' },
  { key: 'contact', href: 'contact.html', label: 'تواصل معنا' },
];
const ACTIVE_MAP = { home:'home', stages:'stages', grade:'stages', subject:'stages', lesson:'stages',
  courses:'courses', courseDetail:'courses', quizzes:'quizzes', quiz:'quizzes', about:'about', contact:'contact' };

let currentUser = null;

const searchForm = (cls, ph) => `
  <form class="${cls}" action="${ROOT}search.html" role="search">
    <input type="search" name="q" placeholder="${ph}" aria-label="بحث في المنصة">
    <button type="submit" aria-label="ابحث"><svg class="icon"><use href="#i-search"/></svg></button>
  </form>`;

const logoHTML = () => `
  <img class="brand-logo" src="${LOGO}" alt="شعار الدكتور في العلوم"
       onerror="this.style.display='none';this.nextElementSibling.style.display='grid'">
  <span class="brand-mark" style="display:none"><svg class="icon"><use href="#i-atom"/></svg></span>`;

function headerHTML() {
  const key = ACTIVE_MAP[document.body.dataset.page]
    ?? ((location.pathname.endsWith('index.html') || location.pathname.endsWith('/')) ? 'home' : '');
  const links = NAV.map((n) =>
    `<a href="${ROOT}${n.href}" class="${n.key === key ? 'is-active' : ''}"${n.key === key ? ' aria-current="page"' : ''}>${n.label}</a>`
  ).join('');
  return `
  <header class="site-header" id="siteHeader">
    <div class="container header-inner">
      <a href="${ROOT}index.html" class="brand" aria-label="الدكتور في العلوم — الصفحة الرئيسية">
        ${logoHTML()}
        <span class="brand-name">الدكتور <b>في العلوم</b></span>
      </a>

      <!-- القائمة: أفقية على الكمبيوتر / درج جانبي على الهاتف -->
      <nav class="main-nav" id="mainNav" aria-label="التنقل الرئيسي">
        ${searchForm('nav-search', 'ابحث عن درس أو كورس…')}
        ${links}
        <div class="nav-auth" id="navAuth">
          <a href="${ROOT}login.html" class="btn btn-outline">تسجيل الدخول</a>
          <a href="${ROOT}register.html" class="btn btn-primary">إنشاء حساب</a>
        </div>
      </nav>

      <div class="header-actions">
        ${searchForm('header-search', 'ابحث…')}
        <div class="auth-links" id="authLinks">
          <a href="${ROOT}login.html" class="btn btn-ghost btn-sm">تسجيل الدخول</a>
          <a href="${ROOT}register.html" class="btn btn-primary btn-sm">إنشاء حساب</a>
        </div>
        <div class="user-chip" id="userChip" hidden>
          <button id="userChipBtn" class="user-chip-btn" aria-haspopup="true">
            <span class="avatar" id="userInitial">ب</span>
            <span class="user-name" id="userName">حسابي</span>
            <svg class="icon"><use href="#i-chevron-down"/></svg>
          </button>
          <div class="user-menu" id="userMenu" hidden>
            <a href="${ROOT}student-dashboard.html"><svg class="icon"><use href="#i-chart"/></svg> لوحة الطالب</a>
            <a href="${ROOT}profile.html"><svg class="icon"><use href="#i-user"/></svg> ملفي الشخصي</a>
            <button id="logoutBtn" class="danger"><svg class="icon"><use href="#i-logout"/></svg> تسجيل الخروج</button>
          </div>
        </div>
      </div>

      <!-- زر القائمة: عنصر مستقل — يثبت أقصى اليسار على الهاتف دائمًا -->
      <button class="menu-btn" id="menuBtn" aria-expanded="false" aria-controls="mainNav" aria-label="فتح القائمة">
        <svg class="icon icon-open"><use href="#i-menu"/></svg>
        <svg class="icon icon-close" hidden><use href="#i-close"/></svg>
      </button>
    </div>
  </header>
  <div class="nav-backdrop" id="navBackdrop"></div>`;
}

function footerHTML() {
  return `
  <footer class="site-footer">
    <div class="container footer-grid">
      <div class="footer-brand">
        <a href="${ROOT}index.html" class="brand" aria-label="الدكتور في العلوم">
          ${logoHTML()}
          <span class="brand-name">الدكتور <b>في العلوم</b></span>
        </a>
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

function applyUser(userDoc, fallbackName) {
  const name = (userDoc?.name || fallbackName || 'حسابي').trim();
  const init = document.getElementById('userInitial');
  const nm = document.getElementById('userName');
  if (nm) nm.textContent = name;
  if (init) {
    if (userDoc?.photoUrl) {
      init.style.backgroundImage = `url("${userDoc.photoUrl}")`;
      init.style.backgroundSize = 'cover';
      init.style.backgroundPosition = 'center';
      init.textContent = '';
    } else {
      init.style.backgroundImage = '';
      init.textContent = (name || 'ب').charAt(0);
    }
  }
}

/** إعادة قراءة بيانات الطالب وتحديث الهيدر (تُستدعى بعد رفع صورة أو حفظ الملف) */
export async function refreshHeaderUser() {
  if (!currentUser) return;
  try {
    const s = await getDoc(doc(db, 'users', currentUser.uid));
    if (s.exists()) applyUser(s.data());
  } catch { /* تجاهل */ }
}

export function initLayout() {
  injectIcons();

  const hRoot = document.getElementById('siteHeaderRoot');
  if (hRoot) hRoot.innerHTML = headerHTML();
  const fRoot = document.getElementById('siteFooterRoot');
  if (fRoot) fRoot.innerHTML = footerHTML();

  /* ظل الهيدر */
  const header = document.getElementById('siteHeader');
  if (header) {
    window.addEventListener('scroll', () =>
      header.classList.toggle('is-scrolled', window.scrollY > 8), { passive: true });
  }

  /* قائمة الموبايل — تفويض أحداث محصّن (يعمل حتى مع تكرر العناصر) */
  const navOpen = () => document.body.classList.contains('nav-open');
  const setNav = (open) => {
    document.body.classList.toggle('nav-open', open);
    document.documentElement.classList.toggle('nav-locked', open);
    document.querySelectorAll('#menuBtn').forEach((btn) => {
      btn.setAttribute('aria-expanded', String(open));
      btn.setAttribute('aria-label', open ? 'إغلاق القائمة' : 'فتح القائمة');
      const io = btn.querySelector('.icon-open'), ic = btn.querySelector('.icon-close');
      if (io) io.hidden = open;
      if (ic) ic.hidden = !open;
    });
  };
  const closeNav = () => setNav(false);

  document.addEventListener('click', (e) => {
    if (e.target.closest('#menuBtn')) { e.preventDefault(); setNav(!navOpen()); return; }
    if (navOpen() && e.target.closest('#navBackdrop')) { closeNav(); return; }
    if (navOpen() && e.target.closest('#mainNav a')) closeNav();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && navOpen()) closeNav(); });
  window.addEventListener('resize', () => { if (window.innerWidth > 992 && navOpen()) closeNav(); });

  /* حركات الظهور */
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

  /* قائمة الحساب */
  const chipBtn = document.getElementById('userChipBtn');
  const userMenu = document.getElementById('userMenu');
  chipBtn?.addEventListener('click', (e) => { e.stopPropagation(); if (userMenu) userMenu.hidden = !userMenu.hidden; });
  document.addEventListener('click', (e) => {
    if (userMenu && !userMenu.hidden && !e.target.closest('.user-chip')) userMenu.hidden = true;
  });
  document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    try {
      await signOut(auth);
      if (userMenu) userMenu.hidden = true;
      closeNav();
      showToast('تم تسجيل الخروج بنجاح');
      if (document.body.dataset.protected === 'true') location.href = ROOT + 'index.html';
    } catch { showToast('تعذر تسجيل الخروج، حاول مرة أخرى', 'error'); }
  });

  /* حالة الدخول: إخفاء أزرار الدخول (الشريط + داخل القائمة) وعرض بيانات الطالب */
  if (isConfigured) {
    onAuthStateChanged(auth, async (user) => {
      currentUser = user;
      const links = document.getElementById('authLinks');
      const chip = document.getElementById('userChip');
      const navAuth = document.getElementById('navAuth');
      if (!user) {
        if (links) links.hidden = false;
        if (chip) chip.hidden = true;
        if (navAuth) navAuth.hidden = false;
        return;
      }
      if (links) links.hidden = true;
      if (chip) chip.hidden = false;
      if (navAuth) navAuth.hidden = true;
      applyUser(null, user.displayName);
      try {
        const s = await getDoc(doc(db, 'users', user.uid));
        if (s.exists()) applyUser(s.data());
      } catch { /* تجاهل */ }
    });
  }

  /* إخفاء شاشة التحميل بعد رسم الواجهة.
     الصفحات المحمية (data-protected) تُخفيها بنفسها بعد التحقق من الجلسة */
  if (document.body.dataset.protected !== 'true') {
    requestAnimationFrame(() => requestAnimationFrame(hidePreloader));
  }
}
