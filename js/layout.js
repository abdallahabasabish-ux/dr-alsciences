// ============================================================
// سلوكيات مشتركة لكل الصفحات: الهيدر، قائمة الموبايل، حالة الدخول
// استدعِ initLayout() مرة واحدة في كل صفحة كاملة الهيدر.
// ============================================================
import { auth, isConfigured, fbAuthNS } from './firebase-config.js';
import { injectIcons, showToast } from './utils.js';

const { onAuthStateChanged, signOut } = fbAuthNS;

export function initLayout() {
  injectIcons();

  /* ظل الهيدر عند التمرير */
  const header = document.getElementById('siteHeader');
  if (header) {
    window.addEventListener('scroll', () => {
      header.classList.toggle('is-scrolled', window.scrollY > 8);
    }, { passive: true });
  }

  /* قائمة الموبايل */
  const menuBtn = document.getElementById('menuBtn');
  const mainNav = document.getElementById('mainNav');
  const backdrop = document.getElementById('navBackdrop');
  let closeNav = () => {};
  if (menuBtn && mainNav) {
    const iconOpen = menuBtn.querySelector('.icon-open');
    const iconClose = menuBtn.querySelector('.icon-close');
    const setNav = (open) => {
      document.body.classList.toggle('nav-open', open);
      menuBtn.setAttribute('aria-expanded', String(open));
      menuBtn.setAttribute('aria-label', open ? 'إغلاق القائمة' : 'فتح القائمة');
      iconOpen.hidden = open;
      iconClose.hidden = !open;
    };
    closeNav = () => setNav(false);
    menuBtn.addEventListener('click', () => setNav(!document.body.classList.contains('nav-open')));
    if (backdrop) backdrop.addEventListener('click', closeNav);
    mainNav.querySelectorAll('a').forEach((a) => a.addEventListener('click', closeNav));
  }

  /* حركات الظهور عند التمرير */
  const revealEls = document.querySelectorAll('.reveal');
  if (revealEls.length) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('is-visible'); io.unobserve(e.target); }
      });
    }, { threshold: 0.12 });
    revealEls.forEach((el) => io.observe(el));
  }

  /* سنة الفوتر */
  const year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();

  /* حالة تسجيل الدخول في الهيدر */
  const authLinks = document.getElementById('authLinks');
  const userChip = document.getElementById('userChip');
  const userMenu = document.getElementById('userMenu');

  if (isConfigured && userChip) {
    onAuthStateChanged(auth, (user) => {
      if (user) {
        if (authLinks) authLinks.hidden = true;
        userChip.hidden = false;
        const name = (user.displayName || user.email || 'حسابي').trim();
        document.getElementById('userInitial').textContent = name.charAt(0);
        document.getElementById('userName').textContent = user.displayName || 'حسابي';
      } else {
        if (authLinks) authLinks.hidden = false;
        userChip.hidden = true;
        if (userMenu) userMenu.hidden = true;
      }
    });

    document.getElementById('userChipBtn').addEventListener('click', (e) => {
      e.stopPropagation();
      userMenu.hidden = !userMenu.hidden;
    });
    document.addEventListener('click', (e) => {
      if (!userChip.contains(e.target)) userMenu.hidden = true;
    });

    document.getElementById('logoutBtn').addEventListener('click', async () => {
      try {
        await signOut(auth);
        if (userMenu) userMenu.hidden = true;
        closeNav();
        showToast('تم تسجيل الخروج بنجاح');
        // الصفحات المحمية تعود للرئيسية بعد الخروج
        if (document.body.dataset.protected === 'true') location.href = 'index.html';
      } catch {
        showToast('تعذر تسجيل الخروج، حاول مرة أخرى', 'error');
      }
    });
  }
}
