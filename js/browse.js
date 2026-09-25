// ============================================================
// التصفح العام: stages.html / grade.html / subject.html
// كل الأسماء تُقرأ من Firestore — لا أسماء ثابتة في الكود.
// الفرز يتم في الذاكرة لتجنّب الحاجة لإنشاء فهارس مركبة (Composite Indexes).
// المحتوى يظهر فقط إذا كان isPublished === true تمامًا.
// ============================================================
import { db, isConfigured, fbStoreNS } from './firebase-config.js';
import { initLayout } from './layout.js';
import { waitForAuth } from './auth.js';
import {
  esc, formatNumber, emptyStateHTML, courseCardHTML,
  getQueryParam, setPageMeta,
} from './utils.js';

initLayout();

const { doc, getDoc, collection, query, where, getDocs } = fbStoreNS;
const qs = (sel, root = document) => root.querySelector(sel);

/* ---------- أدوات مساعدة ---------- */
const byOrder = (a, b) => (a.order ?? 9999) - (b.order ?? 9999);
const byNewest = (a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0);

async function fetchPublished(collName, field, value) {
  const snap = await getDocs(query(collection(db, collName), where(field, '==', value)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((item) => item.isPublished === true);
}

const CONFIG_EMPTY = () => emptyStateHTML(
  'i-info', 'المحتوى يظهر هنا بعد ربط Firebase',
  'استبدل قيم PASTE- في js/firebase-config.js ببيانات مشروعك، ثم أضف المراحل والصفوف والمواد.'
);

const notFoundHTML = (entity) => emptyStateHTML(
  'i-info', `لم يتم العثور على ${entity}`,
  'قد يكون الرابط قديمًا أو تم حذف هذا المحتوى.',
  { action: '<a href="stages.html" class="btn btn-outline btn-sm">تصفح المراحل الدراسية</a>' }
);

const errorHTML = () => emptyStateHTML(
  'i-x-circle', 'تعذر تحميل المحتوى',
  'حدث خطأ أثناء الاتصال بقاعدة البيانات. حدّث الصفحة لإعادة المحاولة.'
);

function breadcrumbHTML(items) {
  return items.map((item, i) =>
    item.href && i < items.length - 1
      ? `<a href="${item.href}">${esc(item.text)}</a>`
      : `<span aria-current="page">${esc(item.text)}</span>`
  ).join('<span class="sep" aria-hidden="true">/</span>');
}

/* ---------- بطاقات ومكوّنات ---------- */
function gradeCardHTML(grade) {
  return `
  <a class="grade-card" href="grade.html?id=${encodeURIComponent(grade.id)}">
    <h3>${esc(grade.name)}</h3>
    <p>${grade.description ? esc(grade.description) : 'استعرض مواد ودروس واختبارات هذا الصف.'}</p>
    <span class="grade-link">الدخول للصف <svg class="icon"><use href="#i-arrow-left"/></svg></span>
  </a>`;
}

function subjectCardHTML(subject) {
  const counts = `${formatNumber(subject.lessonsCount ?? 0)} درس · ${formatNumber(subject.quizzesCount ?? 0)} اختبار`;
  return `
  <article class="course-card">
    <div class="course-thumb">
      ${subject.imageUrl
        ? `<img src="${esc(subject.imageUrl)}" alt="${esc(subject.name)}" loading="lazy">`
        : '<svg class="icon course-fallback"><use href="#i-flask"/></svg>'}
    </div>
    <div class="course-body">
      <h3>${esc(subject.name)}</h3>
      ${subject.description ? `<p class="course-desc">${esc(subject.description)}</p>` : ''}
      <div class="course-foot">
        <span class="course-stage">${counts}</span>
        <a class="btn btn-outline btn-sm" href="subject.html?id=${encodeURIComponent(subject.id)}">استكشف</a>
      </div>
    </div>
  </article>`;
}

function quizCardHTML(quiz) {
  const meta = [
    quiz.durationMinutes ? `${quiz.durationMinutes} دقائق` : null,
    `النجاح ${quiz.passScore ?? 50}%`,
  ].filter(Boolean).join(' · ');
  return `
  <a class="quiz-card" href="quiz.html?id=${encodeURIComponent(quiz.id)}">
    <span class="item-icon"><svg class="icon"><use href="#i-list-check"/></svg></span>
    <span class="quiz-info">
      <b>${esc(quiz.title)}</b>
      <span class="item-meta">${meta}</span>
    </span>
    <svg class="icon quiz-arrow"><use href="#i-arrow-left"/></svg>
  </a>`;
}

function lessonRowHTML(lesson, { done = false, startHere = false } = {}) {
  const badges = [
    lesson.videoUrl ? '<span class="mini-badge">فيديو</span>' : '',
    lesson.pdfUrl ? '<span class="mini-badge">PDF</span>' : '',
    startHere ? '<span class="mini-badge accent">ابدأ من هنا</span>' : '',
  ].filter(Boolean).join('');
  const num = done
    ? '<svg class="icon"><use href="#i-check"/></svg>'
    : (lesson.order != null ? esc(formatNumber(lesson.order)) : '•');
  return `
  <a class="lesson-row ${done ? 'is-done' : ''}" href="lesson.html?id=${encodeURIComponent(lesson.id)}">
    <span class="lesson-num">${num}</span>
    <span class="item-text">
      <b>${esc(lesson.title)}</b>
      ${lesson.description ? `<span class="item-meta">${esc(lesson.description)}</span>` : ''}
    </span>
    <span class="lesson-badges">${badges}</span>
  </a>`;
}

/* ==================== صفحة المراحل الدراسية ==================== */
async function initStages() {
  const root = qs('#stagesRoot');
  if (!root) return;
  if (!isConfigured) { root.innerHTML = CONFIG_EMPTY(); return; }

  try {
    const [stagesSnap, gradesSnap] = await Promise.all([
      getDocs(collection(db, 'stages')),
      getDocs(collection(db, 'grades')),
    ]);
    const stages = stagesSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
      .filter((s) => s.isPublished === true).sort(byOrder);
    const grades = gradesSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
      .filter((g) => g.isPublished === true).sort(byOrder);

    if (!stages.length) {
      root.innerHTML = emptyStateHTML('i-cap', 'لم تُضف المراحل الدراسية بعد',
        'ستظهر المراحل والصفوف هنا فور إضافتها من لوحة التحكم.');
      return;
    }

    root.innerHTML = stages.map((stage) => {
      const list = grades.filter((g) => g.stageId === stage.id);
      return `
      <section class="stage-block" id="${esc(stage.id)}">
        <div class="stage-block-head">
          <h2>${esc(stage.name)}</h2>
          <span>${formatNumber(list.length)} صفوف</span>
        </div>
        <div class="grades-grid">
          ${list.map(gradeCardHTML).join('')
            || emptyStateHTML('i-book', 'لا توجد صفوف في هذه المرحلة بعد',
              'ستظهر صفوف هذه المرحلة هنا فور إضافتها.', { compact: true })}
        </div>
      </section>`;
    }).join('');

    setPageMeta('المراحل الدراسية',
      'تصفح المراحل الدراسية في منصة الدكتور في العلوم واختر صفك للبدء: دروس واختبارات لكل صف.');

    /* الانتقال لمرحلة محددة عبر الروابط النازلة (#primary مثلًا) */
    if (location.hash) {
      const target = document.getElementById(location.hash.slice(1));
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  } catch (err) {
    console.error('خطأ في تحميل المراحل:', err);
    root.innerHTML = errorHTML();
  }
}

/* ==================== صفحة الصف الدراسي ==================== */
async function initGrade() {
  const id = getQueryParam('id');
  const contentEl = qs('#gradeContent');
  if (!contentEl) return;

  if (!id) { contentEl.innerHTML = notFoundHTML('الصف الدراسي'); return; }
  if (!isConfigured) { contentEl.innerHTML = CONFIG_EMPTY(); return; }

  try {
    const gradeSnap = await getDoc(doc(db, 'grades', id));
    if (!gradeSnap.exists() || gradeSnap.data().isPublished !== true) {
      contentEl.innerHTML = notFoundHTML('الصف الدراسي');
      return;
    }
    const grade = { id, ...gradeSnap.data() };

    const stageSnap = grade.stageId ? await getDoc(doc(db, 'stages', grade.stageId)) : null;
    const stageName = stageSnap?.exists() ? stageSnap.data().name : null;

    qs('#crumbHere').innerHTML = breadcrumbHTML([
      { text: 'الرئيسية', href: 'index.html' },
      { text: 'المراحل الدراسية', href: 'stages.html' },
      ...(stageName ? [{ text: stageName, href: `stages.html#${grade.stageId}` }] : []),
      { text: grade.name },
    ]);
    qs('#gradeTitle').textContent = grade.name;
    qs('#gradeDesc').textContent = grade.description
      || 'استعرض المواد والكورسات والدروس والاختبارات المتاحة في هذا الصف.';
    setPageMeta(grade.name, grade.description || `مواد ودروس واختبارات ${grade.name} في منصة الدكتور في العلوم.`);

    const [subjects, courses, lessons, quizzes] = await Promise.all([
      fetchPublished('subjects', 'gradeId', id),
      fetchPublished('courses', 'gradeId', id),
      fetchPublished('lessons', 'gradeId', id),
      fetchPublished('quizzes', 'gradeId', id),
    ]);
    subjects.sort(byNewest);
    courses.sort(byNewest);
    lessons.sort(byOrder);
    quizzes.sort(byNewest);

    const section = (title, inner) => `
      <section class="grade-section"><h2>${title}</h2>${inner}</section>`;

    contentEl.innerHTML = [
      section('المواد المتاحة',
        subjects.length
          ? `<div class="courses-grid">${subjects.map(subjectCardHTML).join('')}</div>`
          : emptyStateHTML('i-flask', 'لا توجد مواد منشورة بعد',
            'ستظهر مواد هذا الصف هنا فور إضافتها من لوحة التحكم.', { compact: true })),
      section('الكورسات',
        courses.length
          ? `<div class="courses-grid">${courses.map(courseCardHTML).join('')}</div>`
          : emptyStateHTML('i-layers', 'لا توجد كورسات بعد',
            'كورسات هذا الصف ستظهر هنا — مجانية ومدفوعة.', { compact: true })),
      section('الدروس',
        lessons.length
          ? `<div class="lesson-list">${lessons.slice(0, 8).map((l) => lessonRowHTML(l)).join('')}</div>`
            + (lessons.length > 8
              ? '<p class="more-hint">لعرض جميع الدروس، ادخل إلى المادة من قسم «المواد المتاحة».</p>'
              : '')
          : emptyStateHTML('i-book', 'لا توجد دروس منشورة بعد',
            'دروس هذا الصف ستظهر هنا مرتبة حسب المنهج.', { compact: true })),
      section('الاختبارات',
        quizzes.length
          ? `<div class="quiz-list">${quizzes.map(quizCardHTML).join('')}</div>`
          : emptyStateHTML('i-list-check', 'لا توجد اختبارات بعد',
            'اختبارات هذا الصف ستظهر هنا مع نتائجها الفورية.', { compact: true })),
    ].join('');
  } catch (err) {
    console.error('خطأ في تحميل الصف:', err);
    contentEl.innerHTML = errorHTML();
  }
}

/* ==================== صفحة المادة ==================== */
async function initSubject() {
  const id = getQueryParam('id');
  const contentEl = qs('#subjectContent');
  if (!contentEl) return;

  if (!id) { contentEl.innerHTML = notFoundHTML('المادة'); return; }
  if (!isConfigured) { contentEl.innerHTML = CONFIG_EMPTY(); return; }

  try {
    const subjectSnap = await getDoc(doc(db, 'subjects', id));
    if (!subjectSnap.exists() || subjectSnap.data().isPublished !== true) {
      contentEl.innerHTML = notFoundHTML('المادة');
      return;
    }
    const subject = { id, ...subjectSnap.data() };

    const gradeSnap = subject.gradeId ? await getDoc(doc(db, 'grades', subject.gradeId)) : null;
    const grade = gradeSnap?.exists() ? { id: gradeSnap.id, ...gradeSnap.data() } : null;

    qs('#crumbHere').innerHTML = breadcrumbHTML([
      { text: 'الرئيسية', href: 'index.html' },
      { text: 'المراحل الدراسية', href: 'stages.html' },
      ...(grade ? [{ text: grade.name, href: `grade.html?id=${grade.id}` }] : []),
      { text: subject.name },
    ]);
    qs('#subjectTitle').textContent = subject.name;
    if (subject.description) qs('#subjectDesc').textContent = subject.description;

    const thumbImg = qs('#subjectThumb');
    if (subject.imageUrl && thumbImg) {
      thumbImg.src = subject.imageUrl;
      thumbImg.alt = subject.name;
      thumbImg.hidden = false;
    }

    setPageMeta(
      subject.name + (grade ? ` - ${grade.name}` : ''),
      subject.description || `دروس واختبارات مادة ${subject.name}${grade ? ' لـ' + grade.name : ''}.`
    );

    const [lessons, quizzes, user] = await Promise.all([
      fetchPublished('lessons', 'subjectId', id),
      fetchPublished('quizzes', 'subjectId', id),
      waitForAuth(),
    ]);
    lessons.sort(byOrder);
    quizzes.sort(byNewest);

    /* حالة إكمال الدروس للطالب المسجل (يقرأ مجموعة progress الخاصة به فقط) */
    const completedSet = new Set();
    if (user) {
      try {
        const progSnap = await getDocs(query(collection(db, 'progress'), where('userId', '==', user.uid)));
        progSnap.forEach((d) => { if (d.data().lessonId) completedSet.add(d.data().lessonId); });
      } catch (err) {
        console.warn('تعذر قراءة تقدمك:', err.message);
      }
    }

    qs('#subjectChips').innerHTML = `
      <span class="meta-chip"><b>${formatNumber(lessons.length)}</b> درس</span>
      <span class="meta-chip"><b>${formatNumber(quizzes.length)}</b> اختبار</span>`;

    /* أول درس غير مكتمل يحمل شارة «ابدأ من هنا» */
    const firstUndone = lessons.findIndex((l) => !completedSet.has(l.id));

    const lessonsHTML = lessons.length
      ? `<div class="lesson-list">${lessons.map((l, i) => lessonRowHTML(l, {
          done: completedSet.has(l.id),
          startHere: i === firstUndone,
        })).join('')}</div>`
      : emptyStateHTML('i-book', 'لا توجد دروس منشورة بعد',
        'ستظهر دروس هذه المادة هنا مرتبة حسب المنهج.', { compact: true });

    const quizzesHTML = quizzes.length
      ? `<div class="quiz-list">${quizzes.map(quizCardHTML).join('')}</div>`
      : emptyStateHTML('i-list-check', 'لا توجد اختبارات بعد',
        'اختبارات هذه المادة ستظهر هنا.', { compact: true });

    contentEl.innerHTML = `
      <section class="grade-section"><h2>الدروس</h2>${lessonsHTML}</section>
      <section class="grade-section"><h2>الاختبارات</h2>${quizzesHTML}</section>`;

    if (!user && lessons.length) {
      contentEl.insertAdjacentHTML('beforeend',
        '<p class="more-hint">سجّل الدخول لتُحفظ دروسك المكتملة وتتابع تقدمك تلقائيًا.</p>');
    }
  } catch (err) {
    console.error('خطأ في تحميل المادة:', err);
    contentEl.innerHTML = errorHTML();
  }
}

/* ---------- التشغيل حسب الصفحة ---------- */
const page = document.body.dataset.page;
if (page === 'stages') initStages();
if (page === 'grade') initGrade();
if (page === 'subject') initSubject();
