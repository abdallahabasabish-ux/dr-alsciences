// ============================================================
// نظام الدروس: lesson.html
// - قراءة الدرس والمادة والصف والمرحلة من Firestore
// - فيديو YouTube (تحويل الرابط إلى embed) + شرح نصي + PDF
// - زر «تم إكمال الدرس» يكتب/يحذف مستند progress في Firestore
//   بمعرّف ثابت `${uid}_${lessonId}` لمنع التكرار
// - الدرس السابق/التالي + قائمة دروس المادة الجانبية
// ============================================================
import { db, isConfigured, fbStoreNS } from './firebase-config.js';
import { initLayout } from './layout.js';
import { waitForAuth } from './auth.js';
import { esc, showToast, emptyStateHTML, getQueryParam, setPageMeta, breadcrumbHTML } from './utils.js';

initLayout();

const {
  doc, getDoc, setDoc, deleteDoc,
  collection, query, where, getDocs, serverTimestamp,
} = fbStoreNS;

const qsEl = (sel, root = document) => root.querySelector(sel);
const byOrder = (a, b) => (a.order ?? 9999) - (b.order ?? 9999);

/* ---------- حالات عامة ---------- */
const notFoundHTML = () => emptyStateHTML(
  'i-info', 'لم يتم العثور على الدرس',
  'قد يكون الرابط قديمًا أو أن الدرس غير منشور.',
  { action: '<a href="stages.html" class="btn btn-outline btn-sm">تصفح الدروس</a>' }
);

const configEmptyHTML = () => emptyStateHTML(
  'i-info', 'المحتوى يظهر هنا بعد ربط Firebase',
  'استبدل قيم PASTE- في js/firebase-config.js ببيانات مشروعك ثم أعد المحاولة.'
);

const errorHTML = () => emptyStateHTML(
  'i-x-circle', 'تعذر تحميل الدرس',
  'حدث خطأ أثناء الاتصال بقاعدة البيانات. حدّث الصفحة لإعادة المحاولة.'
);

/* ---------- أدوات العرض ---------- */

/** تحويل أي صيغة رابط YouTube إلى رابط embed (بدون كوكيز - خصوصية أفضل) */
function youTubeEmbed(url) {
  const patterns = [
    /youtube\.com\/watch\?v=([\w-]{11})/,
    /youtu\.be\/([\w-]{11})/,
    /youtube\.com\/shorts\/([\w-]{11})/,
    /youtube\.com\/embed\/([\w-]{11})/,
  ];
  for (const re of patterns) {
    const m = String(url).match(re);
    if (m) return `https://www.youtube-nocookie.com/embed/${m[1]}`;
  }
  return null;
}

/** عرض نص الشرح: فقرات مفصولة بسطرين فارغين، وأسطر مفردة تُحترم */
function renderRichText(text) {
  return esc(text)
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`)
    .join('');
}

function completeBtnHTML(isDone) {
  return isDone
    ? '<button class="btn btn-success-outline" id="completeBtn"><svg class="icon"><use href="#i-check"/></svg> مكتمل — نقر هنا للإلغاء</button>'
    : '<button class="btn btn-success" id="completeBtn"><svg class="icon"><use href="#i-check-circle"/></svg> تم إكمال الدرس</button>';
}

function asideItemHTML(lesson, { isCurrent, isDone }) {
  const num = isDone
    ? '<svg class="icon" style="width:14px;height:14px"><use href="#i-check"/></svg>'
    : (lesson.order != null ? esc(String(lesson.order)) : '•');
  return `
  <a class="aside-item ${isCurrent ? 'is-current' : ''} ${isDone ? 'is-done' : ''}"
     href="lesson.html?id=${encodeURIComponent(lesson.id)}">
    <span class="aside-num">${num}</span>
    <b>${esc(lesson.title)}</b>
  </a>`;
}

/* ==================== التهيئة ==================== */
async function initLesson() {
  const mainEl = qsEl('#lessonMain');
  const asideList = qsEl('#asideList');
  const id = getQueryParam('id');

  if (!id) { mainEl.innerHTML = notFoundHTML(); asideList.innerHTML = ''; return; }
  if (!isConfigured) { mainEl.innerHTML = configEmptyHTML(); asideList.innerHTML = ''; return; }

  /* --- قراءة الدرس وسلسلة التصنيف --- */
  let lesson, subject = null, grade = null, stageName = null;
  try {
    const lessonSnap = await getDoc(doc(db, 'lessons', id));
    if (!lessonSnap.exists() || lessonSnap.data().isPublished !== true) {
      qsEl('#lessonTitle').textContent = 'الدرس غير متاح';
      mainEl.innerHTML = notFoundHTML();
      asideList.innerHTML = '';
      return;
    }
    lesson = { id, ...lessonSnap.data() };

    if (lesson.subjectId) {
      const s = await getDoc(doc(db, 'subjects', lesson.subjectId));
      if (s.exists()) subject = { id: s.id, ...s.data() };
    }
    const gradeId = lesson.gradeId || subject?.gradeId;
    if (gradeId) {
      const g = await getDoc(doc(db, 'grades', gradeId));
      if (g.exists()) grade = { id: g.id, ...g.data() };
    }
    if (grade?.stageId) {
      const st = await getDoc(doc(db, 'stages', grade.stageId));
      if (st.exists()) stageName = st.data().name;
    }
  } catch (err) {
    console.error('خطأ في تحميل الدرس:', err);
    mainEl.innerHTML = errorHTML();
    return;
  }

  /* --- الترويسة والمسار وSEO --- */
  qsEl('#lessonTitle').textContent = lesson.title;
  setPageMeta(lesson.title, lesson.description || `درس ${lesson.title} من منصة الدكتور في العلوم.`);
  qsEl('#crumbHere').innerHTML = breadcrumbHTML([
    { text: 'الرئيسية', href: 'index.html' },
    { text: 'المراحل الدراسية', href: 'stages.html' },
    ...(stageName ? [{ text: stageName, href: `stages.html#${grade.stageId}` }] : []),
    ...(grade ? [{ text: grade.name, href: `grade.html?id=${grade.id}` }] : []),
    ...(subject ? [{ text: subject.name, href: `subject.html?id=${subject.id}` }] : []),
    { text: lesson.title },
  ]);

  /* --- دروس المادة الشقيقة --- */
  let siblings = [];
  if (subject) {
    try {
      const snap = await getDocs(query(collection(db, 'lessons'), where('subjectId', '==', subject.id)));
      siblings = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((l) => l.isPublished === true)
        .sort(byOrder);
    } catch (err) {
      console.warn('تعذر تحميل قائمة الدروس:', err.message);
    }
  }
  const idx = siblings.findIndex((l) => l.id === lesson.id);

  /* --- المستخدم وحالة الإكمال --- */
  const user = await waitForAuth();
  const doneIds = new Set();
  if (user) {
    try {
      const progSnap = await getDocs(query(collection(db, 'progress'), where('userId', '==', user.uid)));
      progSnap.forEach((d) => { if (d.data().lessonId) doneIds.add(d.data().lessonId); });
    } catch (err) {
      console.warn('تعذر قراءة تقدمك:', err.message);
    }
  }
  let isDone = doneIds.has(lesson.id);

  /* --- القائمة الجانبية --- */
  qsEl('#asideTitle').textContent = subject ? `دروس مادة ${subject.name}` : 'دروس المادة';
  asideList.innerHTML = siblings.length
    ? siblings.map((l) => asideItemHTML(l, { isCurrent: l.id === lesson.id, isDone: doneIds.has(l.id) })).join('')
    : emptyStateHTML('i-book', 'لا دروس أخرى', 'ستظهر بقية دروس المادة هنا.', { compact: true });

  /* --- رقائق المعلومات --- */
  const chips = [];
  if (subject) chips.push(`<a class="meta-chip" href="subject.html?id=${encodeURIComponent(subject.id)}"><b>${esc(subject.name)}</b></a>`);
  if (grade) chips.push(`<a class="meta-chip" href="grade.html?id=${encodeURIComponent(grade.id)}">${esc(grade.name)}</a>`);
  if (idx > -1 && siblings.length > 1) chips.push(`<span class="meta-chip">الدرس <b>${idx + 1}</b> من ${siblings.length}</span>`);
  qsEl('#lessonMeta').innerHTML = chips.join('') + (isDone ? '<span class="done-note"><svg class="icon"><use href="#i-check-circle"/></svg> أكملت هذا الدرس</span>' : '');

  /* --- بناء المحتوى الرئيسي --- */
  const embedUrl = lesson.videoUrl ? youTubeEmbed(lesson.videoUrl) : null;
  const pdfLink = lesson.pdfUrl
    ? `<a class="btn btn-outline" href="${esc(lesson.pdfUrl)}" target="_blank" rel="noopener">
         <svg class="icon"><use href="#i-download"/></svg> تحميل PDF</a>`
    : '';

  const prev = idx > 0 ? siblings[idx - 1] : null;
  const next = idx > -1 && idx < siblings.length - 1 ? siblings[idx + 1] : null;
  const navCard = (label, l, cls = '') => l
    ? `<a class="${cls}" href="lesson.html?id=${encodeURIComponent(l.id)}">
         <span class="nav-label">${label}</span>
         <span class="nav-title">${esc(l.title)}</span></a>`
    : `<div class="nav-disabled">${label === 'الدرس السابق' ? 'هذا أول درس في المادة' : 'هذا آخر درس في المادة'}</div>`;

  mainEl.innerHTML = `
    ${embedUrl
      ? `<div class="video-frame">
           <iframe src="${embedUrl}" title="${esc(lesson.title)}" loading="lazy"
                   allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
                   allowfullscreen></iframe>
         </div>`
      : ''}
    ${lesson.description
      ? `<p class="page-desc" style="margin-top:${embedUrl ? '18px' : '0'}">${esc(lesson.description)}</p>`
      : ''}
    ${lesson.content
      ? `<div class="lesson-content">${renderRichText(lesson.content)}</div>`
      : ''}
    <div class="lesson-actions">
      ${completeBtnHTML(isDone)}
      ${pdfLink}
    </div>
    ${siblings.length > 1
      ? `<nav class="lesson-nav" aria-label="التنقل بين الدروس">
           ${navCard('الدرس السابق', prev)}
           ${navCard('الدرس التالي', next, 'is-next')}
         </nav>`
      : ''}`;

  /* --- منطق زر الإكمال (كتابة/حذف في Firestore) --- */
  mainEl.addEventListener('click', async (e) => {
    const btn = e.target.closest('#completeBtn');
    if (!btn) return;

    if (!user) {
      showToast('سجّل الدخول لحفظ تقدمك', 'info');
      setTimeout(() => {
        location.href = `login.html?next=${encodeURIComponent(`lesson.html?id=${lesson.id}`)}`;
      }, 900);
      return;
    }

    btn.disabled = true;
    try {
      const progressRef = doc(db, 'progress', `${user.uid}_${lesson.id}`);
      if (isDone) {
        await deleteDoc(progressRef);
        isDone = false;
        showToast('تم إلغاء إكمال الدرس', 'info');
      } else {
        await setDoc(progressRef, {
          userId: user.uid,
          lessonId: lesson.id,
          lessonTitle: lesson.title,
          subjectId: subject?.id ?? lesson.subjectId ?? null,
          subjectName: subject?.name ?? null,
          gradeId: grade?.id ?? lesson.gradeId ?? null,
          gradeName: grade?.name ?? null,
          completedAt: serverTimestamp(),
        });
        isDone = true;
        showToast('أحسنت! تم تسجيل إكمال الدرس');
      }

      /* تحديث الواجهة بعد التبديل */
      btn.outerHTML = completeBtnHTML(isDone);
      const noteEl = qsEl('#lessonMeta .done-note');
      if (isDone && !noteEl) {
        qsEl('#lessonMeta').insertAdjacentHTML('beforeend',
          '<span class="done-note"><svg class="icon"><use href="#i-check-circle"/></svg> أكملت هذا الدرس</span>');
      } else if (!isDone && noteEl) {
        noteEl.remove();
      }
      const asideItem = asideList.querySelector(`a[href="lesson.html?id=${encodeURIComponent(lesson.id)}"]`);
      if (asideItem) asideItem.classList.toggle('is-done', isDone);
    } catch (err) {
      console.error('خطأ في حفظ التقدم:', err);
      showToast('تعذر حفظ تقدمك، تحقق من اتصالك ثم أعد المحاولة', 'error');
      btn.disabled = false;
    }
  });
}

initLesson();
