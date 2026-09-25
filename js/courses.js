// ============================================================
// نظام الكورسات: courses.html (القائمة) + course.html (التفاصيل)
// - المجاني: انضمام فوري بمستند enrollments ثم عرض الدروس مع التقدم
// - المدفوع: يظهر مقفلًا مع نقطة ربط startCheckout() لبوابة الدفع
// - دروس الكورس = الدروس المنشورة لمادة الكورس مرتبة بالترتيب
// ============================================================
import { db, isConfigured, fbStoreNS } from './firebase-config.js';
import { initLayout } from './layout.js';
import { waitForAuth } from './auth.js';
import {
  esc, showToast, formatNumber, emptyStateHTML, courseCardHTML, quizCardHTML,
  getQueryParam, setPageMeta, setBtnLoading, breadcrumbHTML, CURRENCY,
} from './utils.js';

initLayout();

const { doc, getDoc, setDoc, collection, query, where, getDocs, serverTimestamp } = fbStoreNS;

const qsEl = (sel, root = document) => root.querySelector(sel);
const byOrder = (a, b) => (a.order ?? 9999) - (b.order ?? 9999);
const byNewest = (a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0);

/* ---------- حالات عامة ---------- */
const configEmptyHTML = () => emptyStateHTML(
  'i-info', 'الكورسات تظهر هنا بعد ربط Firebase',
  'استبدل قيم PASTE- في js/firebase-config.js ببيانات مشروعك ثم أعد المحاولة.'
);
const errorHTML = () => emptyStateHTML(
  'i-x-circle', 'تعذر تحميل الكورسات',
  'حدث خطأ أثناء الاتصال بقاعدة البيانات. حدّث الصفحة لإعادة المحاولة.'
);
const notFoundHTML = () => emptyStateHTML(
  'i-info', 'لم يتم العثور على الكورس',
  'قد يكون الرابط قديمًا أو أن الكورس غير منشور.',
  { action: '<a href="courses.html" class="btn btn-outline btn-sm">تصفح الكورسات</a>' }
);

/* ============================================================
 * نقطة ربط بوابة الدفع المستقبلية — لا حاجة لتغيير أي شيء آخر:
 * 1) استبدل جسم هذه الدالة بمنطق إنشاء الطلب (مثلًا: مستند
 *    payments/{orderId} ثم التحويل لصفحة المزود).
 * 2) عند تأكيد الدفع (Cloud Function / Webhook من المزود) حدّث
 *    مستند التسجيل: enrollments/{uid}_{courseId}
 *    → { status: 'paid', orderId, amount }
 *    (تحديث التسجيل مسدود على الطالب في القواعد — يحدث من الخادم فقط)
 * 3) صفحة الكورس ستفتح المحتوى تلقائيًا لأن الفتح يعتمد على
 *    enrollment.status === 'paid' — انظر canAccess أدناه.
 * ============================================================ */
async function startCheckout(course, user) {
  showToast('بوابة الدفع قيد الإعداد — سنعلمك فور تفعيلها', 'info');
}

/* ---------- صف درس داخل الكورس (يدعم حالة المقفل) ---------- */
function courseLessonRow(lesson, { done = false, locked = false } = {}) {
  const badges = [
    lesson.videoUrl ? '<span class="mini-badge">فيديو</span>' : '',
    lesson.pdfUrl ? '<span class="mini-badge">PDF</span>' : '',
    locked ? '<span class="mini-badge accent">مقفل</span>' : '',
  ].filter(Boolean).join('');
  const num = locked
    ? '<svg class="icon"><use href="#i-lock"/></svg>'
    : done
      ? '<svg class="icon"><use href="#i-check"/></svg>'
      : (lesson.order != null ? esc(formatNumber(lesson.order)) : '•');
  const inner = `
    <span class="lesson-num ${locked ? 'lock' : ''}">${num}</span>
    <span class="item-text">
      <b>${esc(lesson.title)}</b>
      ${lesson.description ? `<span class="item-meta">${esc(lesson.description)}</span>` : ''}
    </span>
    <span class="lesson-badges">${badges}</span>`;
  return locked
    ? `<div class="lesson-row is-locked">${inner}</div>`
    : `<a class="lesson-row ${done ? 'is-done' : ''}" href="lesson.html?id=${encodeURIComponent(lesson.id)}">${inner}</a>`;
}

/* ==================== صفحة القائمة ==================== */
async function initCoursesList() {
  const root = qsEl('#coursesRoot');
  const gradeFilter = qsEl('#gradeFilter');
  const typeFilter = qsEl('#typeFilter');
  if (!root) return;
  if (!isConfigured) { root.innerHTML = configEmptyHTML(); return; }

  let courses = [];
  try {
    const [cSnap, gSnap] = await Promise.all([
      getDocs(query(collection(db, 'courses'), where('isPublished', '==', true))),
      getDocs(collection(db, 'grades')),
    ]);
    courses = cSnap.docs.map((d) => ({ id: d.id, ...d.data() })).sort(byNewest);
    gSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((g) => g.isPublished !== false)
      .sort(byOrder)
      .forEach((g) => gradeFilter.add(new Option(g.name, g.id)));
  } catch (err) {
    console.error('خطأ في تحميل الكورسات:', err);
    root.innerHTML = errorHTML();
    return;
  }

  function render() {
    const g = gradeFilter.value;
    const t = typeFilter.value; // '' | 'free' | 'paid'
    const list = courses.filter((c) =>
      (!g || c.gradeId === g)
      && (!t || (t === 'free' ? c.isFree : !c.isFree)));
    root.innerHTML = list.length
      ? `<div class="courses-grid">${list.map(courseCardHTML).join('')}</div>`
      : emptyStateHTML('i-layers', 'لا توجد كورسات مطابقة',
        'جرّب تغيير الفلاتر أو عد لاحقًا — تُضاف كورسات جديدة باستمرار.');
  }

  gradeFilter.addEventListener('change', render);
  typeFilter.addEventListener('change', render);
  render();

  setPageMeta('الكورسات',
    'تصفح كورسات العلوم المجانية والمدفوعة لجميع المراحل الدراسية — دروس فيديو وملفات واختبارات.');
}

/* ==================== صفحة التفاصيل ==================== */
async function initCourseDetail() {
  const id = getQueryParam('id');
  const contentEl = qsEl('#courseContent');
  if (!contentEl) return;

  if (!id) { qsEl('#courseTitle').textContent = 'الكورس غير متاح'; contentEl.innerHTML = notFoundHTML(); return; }
  if (!isConfigured) { qsEl('#courseTitle').textContent = 'الكورسات'; contentEl.innerHTML = configEmptyHTML(); return; }

  /* --- الكورس والتصنيف --- */
  let course, grade = null, subject = null;
  try {
    const snap = await getDoc(doc(db, 'courses', id));
    if (!snap.exists() || snap.data().isPublished !== true) {
      qsEl('#courseTitle').textContent = 'الكورس غير متاح';
      contentEl.innerHTML = notFoundHTML();
      return;
    }
    course = { id, ...snap.data() };

    if (course.gradeId) {
      const g = await getDoc(doc(db, 'grades', course.gradeId));
      if (g.exists()) grade = { id: g.id, ...g.data() };
    }
    if (course.subjectId) {
      const s = await getDoc(doc(db, 'subjects', course.subjectId));
      if (s.exists()) subject = { id: s.id, ...s.data() };
    }
  } catch (err) {
    console.error('خطأ في تحميل الكورس:', err);
    contentEl.innerHTML = errorHTML();
    return;
  }

  /* --- الترويسة --- */
  qsEl('#courseTitle').textContent = course.title;
  if (course.description) qsEl('#courseDesc').textContent = course.description;
  qsEl('#crumbHere').innerHTML = breadcrumbHTML([
    { text: 'الرئيسية', href: 'index.html' },
    { text: 'الكورسات', href: 'courses.html' },
    ...(grade ? [{ text: grade.name, href: `grade.html?id=${grade.id}` }] : []),
    { text: course.title },
  ]);
  setPageMeta(course.title, course.description || `كورس ${course.title} من منصة الدكتور في العلوم.`);

  document.getElementById('heroMedia').outerHTML = course.imageUrl
    ? `<img class="hero-thumb" src="${esc(course.imageUrl)}" alt="${esc(course.title)}">`
    : `<div class="hero-fallback"><svg class="icon"><use href="#i-cap"/></svg></div>`;

  const badge = course.isFree
    ? '<span class="badge badge-free">مجاني</span>'
    : `<span class="badge badge-paid">مدفوع · ${esc(formatNumber(course.price ?? 0))} ${esc(CURRENCY)}</span>`;

  /* --- بيانات الطالب --- */
  const user = await waitForAuth();
  let enrollment = null;
  const doneIds = new Set();
  if (user) {
    try {
      const enrSnap = await getDoc(doc(db, 'enrollments', `${user.uid}_${course.id}`));
      if (enrSnap.exists()) enrollment = enrSnap.data();
      const progSnap = await getDocs(query(collection(db, 'progress'), where('userId', '==', user.uid)));
      progSnap.forEach((d) => { if (d.data().lessonId) doneIds.add(d.data().lessonId); });
    } catch (err) {
      console.warn('تعذر قراءة بياناتك:', err.message);
    }
  }

  /* --- دروس واختبارات مادة الكورس --- */
  let lessons = [], quizzes = [];
  if (subject) {
    try {
      const [lSnap, qSnap] = await Promise.all([
        getDocs(query(collection(db, 'lessons'), where('subjectId', '==', subject.id))),
        getDocs(query(collection(db, 'quizzes'), where('subjectId', '==', subject.id))),
      ]);
      lessons = lSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
        .filter((l) => l.isPublished === true).sort(byOrder);
      quizzes = qSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
        .filter((q) => q.isPublished === true).sort(byNewest);
    } catch (err) {
      console.warn('تعذر تحميل محتوى الكورس:', err.message);
    }
  }

  /* --- حالة الوصول --- */
  const isPaid = !course.isFree;
  // v1: المجاني متاح دائمًا. المدفوع يُفتح فقط بتسجيل status === 'paid' (بعد ربط الدفع)
  const unlocked = !isPaid || enrollment?.status === 'paid';
  const completedCount = lessons.filter((l) => doneIds.has(l.id)).length;
  const percent = lessons.length ? Math.round((completedCount / lessons.length) * 100) : 0;

  /* --- لوحة الانضمام حسب الحالة --- */
  let panelHTML = '';
  if (isPaid && !unlocked) {
    panelHTML = `
      <div class="enroll-panel">
        <div class="enroll-info">
          <svg class="icon"><use href="#i-lock"/></svg>
          <div><b>هذا كورس مدفوع</b>
            <p>السعر: ${esc(formatNumber(course.price ?? 0))} ${esc(CURRENCY)}${course.instructor ? ` · المدرب: ${esc(course.instructor)}` : ''}</p>
          </div>
        </div>
        <button class="btn btn-accent btn-lg" data-pay>الدفع قريبًا</button>
      </div>
      <div class="locked-banner">
        <svg class="icon"><use href="#i-info"/></svg>
        <span>يمكنك الاطلاع على محتوى الكورس أدناه، وسيُفتح بالكامل فور تفعيل بوابة الدفع — <b>تابعنا ليصلك إشعار الإطلاق.</b></span>
      </div>`;
  } else if (!user) {
    panelHTML = `
      <div class="enroll-panel">
        <div class="enroll-info">
          <svg class="icon"><use href="#i-info"/></svg>
          <div><b>سجّل الدخول للانضمام للكورس</b>
            <p>الانضمام يتيح حفظ دروسك المكتملة ومتابعة نسبة تقدمك في الكورس.</p>
          </div>
        </div>
        <a class="btn btn-primary" href="login.html?next=${encodeURIComponent(`course.html?id=${course.id}`)}">تسجيل الدخول</a>
      </div>`;
  } else if (!enrollment) {
    panelHTML = `
      <div class="enroll-panel">
        <div class="enroll-info">
          <svg class="icon"><use href="#i-cap"/></svg>
          <div><b>انضم إلى هذا الكورس مجانًا</b>
            <p>${lessons.length ? `${formatNumber(lessons.length)} درس بانتظارك` : 'سيُضاف الدروس قريبًا'} — متابعة التقدم مجانية بالكامل.</p>
          </div>
        </div>
        <button class="btn btn-primary btn-lg" data-enroll>انضم الآن مجانًا</button>
      </div>`;
  } else {
    panelHTML = `
      <div class="enroll-panel">
        <div class="enroll-info">
          <svg class="icon"><use href="#i-check-circle"/></svg>
          <div><b>أنت منضم لهذا الكورس</b>
            <p>واصل من حيث توقفت — كل درس يقرّبك من إتمام الكورس.</p>
          </div>
        </div>
        <div class="enroll-progress">
          <div class="progress-row" style="margin-bottom:8px">
            <b class="progress-num" style="font-size:1.2rem">${formatNumber(percent)}%</b>
            <span class="item-meta">${formatNumber(completedCount)} من ${formatNumber(lessons.length)} درس</span>
          </div>
          <div class="progress-track"><span class="progress-fill" style="width:${percent}%"></span></div>
        </div>
      </div>`;
  }

  /* --- قوائم المحتوى --- */
  const lessonsHTML = lessons.length
    ? `<div class="lesson-list">${lessons.map((l) => courseLessonRow(l, {
        done: doneIds.has(l.id),
        locked: !unlocked,
      })).join('')}</div>`
    : emptyStateHTML('i-book', 'لا توجد دروس بعد',
      'دروس هذا الكورس ستظهر هنا فور إضافتها.', { compact: true });

  const quizzesHTML = quizzes.length
    ? `<section class="grade-section"><h2>اختبارات المادة</h2>
         <div class="quiz-list">${quizzes.map(quizCardHTML).join('')}</div></section>`
    : '';

  contentEl.innerHTML = `
    ${panelHTML}
    <section class="grade-section" style="margin-top:34px">
      <h2>دروس الكورس</h2>${lessonsHTML}
    </section>
    ${quizzesHTML}`;

  /* --- رقائق المعلومات (بعد معرفة الأعداد) --- */
  qsEl('#courseChips').innerHTML = [
    badge,
    grade ? `<a class="meta-chip" href="grade.html?id=${encodeURIComponent(grade.id)}">${esc(grade.name)}</a>` : '',
    subject ? `<a class="meta-chip" href="subject.html?id=${encodeURIComponent(subject.id)}"><b>${esc(subject.name)}</b></a>` : '',
    course.instructor ? `<span class="meta-chip">المدرب: <b>${esc(course.instructor)}</b></span>` : '',
    `<span class="meta-chip"><b>${formatNumber(course.lessonsCount ?? lessons.length)}</b> درس</span>`,
  ].join('');

  /* --- أحداث الانضمام والدفع (onclick يستبدل المعالج عند إعادة الرسم) --- */
  contentEl.onclick = async (e) => {
    const enrollBtn = e.target.closest('[data-enroll]');
    if (enrollBtn) {
      setBtnLoading(enrollBtn, true);
      try {
        await setDoc(doc(db, 'enrollments', `${user.uid}_${course.id}`), {
          userId: user.uid,
          courseId: course.id,
          courseTitle: course.title,
          type: 'free',
          status: 'active',
          pricePaid: 0,
          enrolledAt: serverTimestamp(),
        });
        showToast('تم انضمامك للكورس، بالتوفيق!');
        initCourseDetail(); // إعادة الرسم بحالة «منضم»
      } catch (err) {
        console.error('خطأ في الانضمام:', err);
        showToast('تعذر الانضمام، حاول مرة أخرى', 'error');
        setBtnLoading(enrollBtn, false);
      }
      return;
    }
    if (e.target.closest('[data-pay]')) {
      await startCheckout(course, user);
    }
  };
}

/* ---------- التشغيل حسب الصفحة ---------- */
const page = document.body.dataset.page;
if (page === 'courses') initCoursesList();
if (page === 'courseDetail') initCourseDetail();
