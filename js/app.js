// ============================================================
// الصفحة الرئيسية (index.html): الإحصائيات + الكورسات
// - الإحصائيات: مستند stats/counters (تحديث لحظي عبر onSnapshot)
// - الكورسات: مجموعة courses حيث isPublished == true
// - سلوكيات الهيدر والقائمة في js/layout.js
// ============================================================
import { db, isConfigured, fbStoreNS } from './firebase-config.js';
import { initLayout } from './layout.js';
import { emptyStateHTML, courseCardHTML } from './utils.js';

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

const statsStrip = document.querySelector('.stats-strip');
if (statsStrip) {
  new IntersectionObserver((entries, obs) => {
    entries.forEach((e) => {
      if (e.isIntersecting) { statsVisible = true; renderStats(); obs.disconnect(); }
    });
  }, { threshold: 0.3 }).observe(statsStrip);
}

/* ---------- الكورسات المنشورة ---------- */
const coursesGrid = document.getElementById('coursesGrid');

async function loadCourses() {
  if (!coursesGrid) return;

  if (!isConfigured) {
    coursesGrid.innerHTML = emptyStateHTML(
      'i-layers', 'الكورسات قادمة قريبًا',
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
      : emptyStateHTML('i-layers', 'لا توجد كورسات منشورة بعد',
        'ستظهر الكورسات هنا فور إضافتها من لوحة التحكم.');
  } catch (err) {
    console.error('خطأ في تحميل الكورسات:', err);
    coursesGrid.innerHTML = emptyStateHTML(
      'i-x-circle', 'تعذر تحميل الكورسات',
      'حدث خطأ أثناء الاتصال بقاعدة البيانات. حدّث الصفحة لإعادة المحاولة.'
    );
  }
}
loadCourses();
