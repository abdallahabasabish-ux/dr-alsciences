// ============================================================
// البحث الشامل: دروس + مواد + كورسات (المحتوى المنشور فقط)
// بحث جانب العميل — مناسب لحجم محتوى v1 وبدون فهارس إضافية
// ============================================================
import { db, isConfigured, fbStoreNS } from './firebase-config.js';
import { initLayout } from './layout.js';
import {
  esc, formatNumber, emptyStateHTML, courseCardHTML,
  getQueryParam, setPageMeta,
} from './utils.js';

initLayout();

const { collection, query, where, getDocs } = fbStoreNS;
const qsEl = (sel, root = document) => root.querySelector(sel);

function lessonRow(l) {
  const badges = [
    l.videoUrl ? '<span class="mini-badge">فيديو</span>' : '',
    l.pdfUrl ? '<span class="mini-badge">PDF</span>' : '',
  ].join('');
  return `
  <a class="lesson-row" href="lesson.html?id=${encodeURIComponent(l.id)}">
    <span class="lesson-num"><svg class="icon"><use href="#i-book"/></svg></span>
    <span class="item-text"><b>${esc(l.title)}</b>
      ${l.description ? `<span class="item-meta">${esc(l.description)}</span>` : ''}
    </span>
    <span class="lesson-badges">${badges}</span>
  </a>`;
}

function subjectRow(s) {
  return `
  <a class="quiz-card" href="subject.html?id=${encodeURIComponent(s.id)}">
    <span class="item-icon"><svg class="icon"><use href="#i-flask"/></svg></span>
    <span class="quiz-info"><b>${esc(s.name)}</b>
      <span class="item-meta">${esc(s.description || '')}</span>
    </span>
    <svg class="icon quiz-arrow"><use href="#i-arrow-left"/></svg>
  </a>`;
}

const sectionHTML = (title, count, inner) => `
  <section class="grade-section">
    <div class="stage-block-head"><h2>${title}</h2><span>${formatNumber(count)} نتيجة</span></div>
    ${inner}
  </section>`;

async function initSearch() {
  const root = qsEl('#searchRoot');
  const input = qsEl('#searchInput');
  const q = (getQueryParam('q') || '').trim();
  if (input) input.value = q;

  if (!q) return; // الحالة الافتراضية موجودة في HTML

  if (!isConfigured) {
    root.innerHTML = emptyStateHTML('i-info', 'البحث يعمل بعد ربط Firebase',
      'استبدل قيم PASTE- في js/firebase-config.js ببيانات مشروعك.');
    return;
  }

  root.innerHTML = `
    <div class="empty-state"><div class="sk sk-line w40" style="margin-inline:auto"></div>
    <div class="sk sk-line" style="margin-top:10px"></div></div>`;

  try {
    const needle = q.toLowerCase();
    const match = (...fields) => fields.join(' ').toLowerCase().includes(needle);

    const [lSnap, sSnap, cSnap] = await Promise.all([
      getDocs(query(collection(db, 'lessons'), where('isPublished', '==', true))),
      getDocs(query(collection(db, 'subjects'), where('isPublished', '==', true))),
      getDocs(query(collection(db, 'courses'), where('isPublished', '==', true))),
    ]);

    const lessons = lSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
      .filter((l) => match(l.title, l.description)).sort((a, b) => (a.order ?? 9) - (b.order ?? 9));
    const subjects = sSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
      .filter((s) => match(s.name, s.description));
    const courses = cSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
      .filter((c) => match(c.title, c.description));

    const total = lessons.length + subjects.length + courses.length;
    setPageMeta(`نتائج البحث: ${q}`);

    if (!total) {
      root.innerHTML = emptyStateHTML('i-search', `لا توجد نتائج لـ "${q}"`,
        'جرّب كلمة أخرى أقصر، أو تصفح المراحل الدراسية للوصول للمحتوى.',
        { action: '<a href="stages.html" class="btn btn-outline btn-sm">تصفح المراحل</a>' });
      return;
    }

    root.innerHTML = [
      lessons.length
        ? sectionHTML('الدروس', lessons.length,
            `<div class="lesson-list">${lessons.map(lessonRow).join('')}</div>`)
        : '',
      subjects.length
        ? sectionHTML('المواد', subjects.length,
            `<div class="quiz-list">${subjects.map(subjectRow).join('')}</div>`)
        : '',
      courses.length
        ? sectionHTML('الكورسات', courses.length,
            `<div class="courses-grid">${courses.map(courseCardHTML).join('')}</div>`)
        : '',
    ].join('');
  } catch (err) {
    console.error('خطأ في البحث:', err);
    root.innerHTML = emptyStateHTML('i-x-circle', 'تعذر تنفيذ البحث',
      'حدث خطأ أثناء الاتصال، حدّث الصفحة لإعادة المحاولة.');
  }
}

initSearch();
