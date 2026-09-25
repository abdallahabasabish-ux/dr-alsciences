// ============================================================
// منطق الصفحة الرئيسية: الهيدر، قائمة الموبايل، الإحصائيات، الكورسات
// كل قراءة البيانات تتم من Firestore — لا بيانات وهمية إطلاقًا.
// ============================================================
import { auth, db, isConfigured, fbAuthNS, fbStoreNS } from './firebase-config.js';
import { injectIcons, esc, showToast, CURRENCY } from './utils.js';

injectIcons();

const { onAuthStateChanged, signOut } = fbAuthNS;
const { doc, onSnapshot, collection, where, limit, query, getDocs } = fbStoreNS;

/* ---------- الهيدر: ظل عند التمرير ---------- */
const headerEl = document.getElementById('siteHeader');
window.addEventListener('scroll', () => {
  headerEl.classList.toggle('is-scrolled', window.scrollY > 8);
}, { passive: true });

/* ---------- قائمة الموبايل (Drawer) ---------- */
const menuBtn = document.getElementById('menuBtn');
const mainNav = document.getElementById('mainNav');
const backdrop = document.getElementById('navBackdrop');
const iconOpen = menuBtn.querySelector('.icon-open');
const iconClose = menuBtn.querySelector('.icon-close');

function setNav(open) {
  document.body.classList.toggle('nav-open', open);
  menuBtn.setAttribute('aria-expanded', String(open));
  menuBtn.setAttribute('aria-label', open ? 'إغلاق القائمة' : 'فتح القائمة');
  iconOpen.hidden = open;
  iconClose.hidden = !open;
}
menuBtn.addEventListener('click', () => setNav(!document.body.classList.contains('nav-open')));
backdrop.addEventListener('click', () => setNav(false));
mainNav.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setNav(false)));

/* ---------- حركات الظهور عند التمرير (مرة واحدة) ---------- */
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (e.isIntersecting) {
      e.target.classList.add('is-visible');
      revealObserver.unobserve(e.target);
    }
  });
}, { threshold: 0.12 });
document.querySelectorAll('.reveal').forEach((el) => revealObserver.observe(el));

/* ---------- سنة الفوتر ---------- */
document.getElementById('year').textContent = new Date().getFullYear();

/* ---------- إحصائيات المنصة (مستند stats/counters) ---------- */
const STAT_KEYS = ['lessons', 'courses', 'quizzes', 'students'];
let statsData = null;
let statsVisible = false;

function runCounter(el, target) {
  const start = performance.now();
  const duration = 1200;
  const step = (now) => {
    const p = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(target * eased).toLocaleString('en-US');
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function renderStats() {
  if (!statsVisible || !statsData) return;
  STAT_KEYS.forEach((key) => {
    const el = document.querySelector(`[data-stat="${key}"]`);
    if (el && statsData[key] != null) runCounter(el, Number(statsData[key]) || 0);
  });
}

if (isConfigured) {
  onSnapshot(
    doc(db, 'stats', 'counters'),
    (snap) => { statsData = snap.data() || null; renderStats(); },
    (err) => console.warn('تعذر قراءة الإحصائيات:', err.message)
  );
}

new IntersectionObserver((entries, obs) => {
  entries.forEach((e) => {
    if (e.isIntersecting) { statsVisible = true; renderStats(); obs.disconnect(); }
  });
}, { threshold: 0.3 }).observe(document.querySelector('.stats-strip'));

/* ---------- الكورسات المنشورة (مجموعة courses) ---------- */
const coursesGrid = document.getElementById('coursesGrid');

const emptyHTML = (title, text) => `
  <div class="empty-state">
    <svg class="icon"><use href="#i-layers"/></svg>
    <h3>${esc(title)}</h3>
    <p>${esc(text)}</p>
  </div>`;

function courseCardHTML(course) {
  const meta = [course.stageName, course.gradeName].filter(Boolean).join(' · ');
  const badge = course.isFree
    ? '<span class="badge badge-free">مجاني</span>'
    : '<span class="badge badge-paid">مدفوع</span>';
  const price = course.isFree
    ? ''
    : `<span class="course-price">${esc(course.price ?? '')} ${esc(CURRENCY)}</span>`;
  return `
  <article class="course-card">
    <div class="course-thumb">
      ${course.imageUrl
        ? `<img src="${esc(course.imageUrl)}" alt="${esc(course.title)}" loading="lazy">`
        : '<svg class="icon course-fallback"><use href="#i-cap"/></svg>'}
    </div>
    <div class="course-body">
      <div class="course-badges">${badge}${meta ? `<span class="course-stage">${esc(meta)}</span>` : ''}</div>
      <h3>${esc(course.title)}</h3>
      ${course.description ? `<p class="course-desc">${esc(course.description)}</p>` : ''}
      <div class="course-foot">
        ${price || '<span></span>'}
        <a class="btn btn-outline btn-sm" href="course.html?id=${encodeURIComponent(course.id)}">التفاصيل</a>
      </div>
    </div>
  </article>`;
}

async function loadCourses() {
  if (!isConfigured) {
    coursesGrid.innerHTML = emptyHTML(
      'الكورسات قادمة قريبًا',
      'نجهّز لك كورسات مجانية ومدفوعة تغطي جميع المراحل الدراسية.'
    );
    return;
  }
  try {
    const snap = await getDocs(
      query(collection(db, 'courses'), where('isPublished', '==', true), limit(6))
    );
    const items = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
    coursesGrid.innerHTML = items.length
      ? items.map(courseCardHTML).join('')
      : emptyHTML('لا توجد كورسات منشورة بعد', 'ستظهر الكورسات هنا فور إضافتها من لوحة التحكم.');
  } catch (err) {
    console.error('خطأ في تحميل الكورسات:', err);
    coursesGrid.innerHTML = emptyHTML(
      'تعذر تحميل الكورسات',
      'حدث خطأ أثناء الاتصال بقاعدة البيانات. حدّث الصفحة لإعادة المحاولة.'
    );
  }
}
loadCourses();

/* ---------- حالة تسجيل الدخول في الهيدر ---------- */
const authLinks = document.getElementById('authLinks');
const userChip = document.getElementById('userChip');
const userMenu = document.getElementById('userMenu');

if (isConfigured) {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      authLinks.hidden = true;
      userChip.hidden = false;
      const name = (user.displayName || user.email || 'ب').trim();
      document.getElementById('userInitial').textContent = name.charAt(0);
      document.getElementById('userName').textContent = user.displayName || 'حسابي';
    } else {
      authLinks.hidden = false;
      userChip.hidden = true;
      userMenu.hidden = true;
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
      userMenu.hidden = true;
      setNav(false);
      showToast('تم تسجيل الخروج بنجاح');
    } catch (err) {
      showToast('تعذر تسجيل الخروج، حاول مرة أخرى', 'error');
    }
  });
}
