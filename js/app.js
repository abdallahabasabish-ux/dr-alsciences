// ============================================================
// منطق الصفحة الرئيسية (index.html): الإحصائيات + الكورسات
// سلوكيات الهيدر وحالة الدخول أصبحت في js/layout.js
// ============================================================
import { db, isConfigured, fbStoreNS } from './firebase-config.js';
import { initLayout } from './layout.js';
import { esc, CURRENCY } from './utils.js';

initLayout();

const { doc, onSnapshot, collection, where, limit, query, getDocs } = fbStoreNS;

/* ---------- شريط الإحصائيات (مستند stats/counters) ---------- */
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

/* ---------- الكورسات المنشورة ---------- */
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
  const price = course.isFree ? '' : `<span class="course-price">${esc(course.price ?? '')} ${esc(CURRENCY)}</span>`;
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
    coursesGrid.innerHTML = emptyHTML('الكورسات قادمة قريبًا', 'نجهّز لك كورسات مجانية ومدفوعة تغطي جميع المراحل الدراسية.');
    return;
  }
  try {
    const snap = await getDocs(query(collection(db, 'courses'), where('isPublished', '==', true), limit(6)));
    const items = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
    coursesGrid.innerHTML = items.length
      ? items.map(courseCardHTML).join('')
      : emptyHTML('لا توجد كورسات منشورة بعد', 'ستظهر الكورسات هنا فور إضافتها من لوحة التحكم.');
  } catch (err) {
    console.error('خطأ في تحميل الكورسات:', err);
    coursesGrid.innerHTML = emptyHTML('تعذر تحميل الكورسات', 'حدث خطأ أثناء الاتصال بقاعدة البيانات. حدّث الصفحة لإعادة المحاولة.');
  }
}
loadCourses();
