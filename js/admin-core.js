// ============================================================
// لوحة الإدارة — الجزء الثاني:
// الدروس / الاختبارات ومحرر الأسئلة / الكورسات / النتائج
// - إنشاء/حذف درس أو اختبار يحدّث عدّادات المادة تلقائيًا
// - إضافة/حذف سؤال يحدّث questionsCount في مستند الاختبار
// - رفع PDF والصور إلى Firebase Storage (الروابط تُحفظ في Firestore)
// - اختيار المادة يشتق المرحلة والصف تلقائيًا (لا تكرار للبيانات)
// ============================================================
import { db, fbStoreNS } from './firebase-config.js';
import {
  requireAdmin, initAdminShell, field, textareaField, selectField, opt,
  checkboxField, fileField, openFormModal, createIn, updateIn, removeIn,
  uploadFormFile, bindRowActions, pubPill, actionBtns, errorState,
} from './admin-core.js';
import { esc, showToast, formatNumber, formatDate, confirmDialog } from './utils.js';

const {
  collection, getDocs, query, where, doc, getDoc,
  addDoc, updateDoc, deleteDoc, increment,
} = fbStoreNS;

const byOrder = (a, b) => (a.order ?? 9999) - (b.order ?? 9999);
const byNewest = (a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0);
const ARABIC_LETTERS = ['أ', 'ب', 'ج', 'د'];
const pointsWord = (p) => (p === 1 ? 'درجة' : p === 2 ? 'درجتان' : 'درجات');

/* ==================== أدوات مشتركة ==================== */

async function loadTaxonomy() {
  const [sSnap, gSnap, subSnap] = await Promise.all([
    getDocs(collection(db, 'stages')),
    getDocs(collection(db, 'grades')),
    getDocs(collection(db, 'subjects')),
  ]);
  return {
    stages: sSnap.docs.map((d) => ({ id: d.id, ...d.data() })).sort(byOrder),
    grades: gSnap.docs.map((d) => ({ id: d.id, ...d.data() })).sort(byOrder),
    subjects: subSnap.docs.map((d) => ({ id: d.id, ...d.data() })).sort(byNewest),
  };
}

/** قائمة مواد مجمّعة: المرحلة — الصف */
function subjectOptions(taxonomy, selectedId = '') {
  let html = '<option value="">— اختر المادة —</option>';
  taxonomy.stages.forEach((st) => {
    taxonomy.grades.filter((g) => g.stageId === st.id).forEach((g) => {
      const subs = taxonomy.subjects.filter((s) => s.gradeId === g.id);
      if (!subs.length) return;
      html += `<optgroup label="${esc(st.name)} — ${esc(g.name)}">`
        + subs.map((s) => opt(s.id, s.name, s.id === selectedId)).join('')
        + '</optgroup>';
    });
  });
  return html;
}

/** تحديث عدّاد (+1/-1) في مستند المادة أو الاختبار */
async function bumpCount(coll, id, fieldName, delta) {
  if (!id || !delta) return;
  try {
    await updateDoc(doc(db, coll, id), { [fieldName]: increment(delta) });
  } catch (err) {
    console.warn(`تعذر تحديث العداد ${fieldName}:`, err.message);
  }
}

function attachBadges(item) {
  const badges = [
    item.videoUrl ? '<span class="mini-badge">فيديو</span>' : '',
    item.pdfUrl ? '<span class="mini-badge">PDF</span>' : '',
    item.imageUrl ? '<span class="mini-badge">صورة</span>' : '',
  ].filter(Boolean).join(' ');
  return badges || '—';
}

/* ==================== الدروس ==================== */
async function initAdminLessons() {
  const ctx = await requireAdmin(); if (!ctx) return;
  initAdminShell(ctx);

  let taxonomy = null, lessons = [];
  const tbody = document.getElementById('lessonsBody');
  const filterEl = document.getElementById('subjectFilter');
  const subjectById = (id) => taxonomy?.subjects.find((s) => s.id === id);

  async function refresh() {
    try {
      taxonomy = await loadTaxonomy();
      const snap = await getDocs(collection(db, 'lessons'));
      lessons = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort(byOrder);
      filterEl.innerHTML = '<option value="">كل المواد</option>' + subjectOptions(taxonomy, filterEl.value);
      render();
    } catch (err) {
      console.error(err);
      tbody.closest('table').outerHTML = errorState();
    }
  }

  function render() {
    const filter = filterEl.value;
    const list = filter ? lessons.filter((l) => l.subjectId === filter) : lessons;
    tbody.innerHTML = list.length ? list.map((l) => `
      <tr>
        <td data-label="الدرس"><div class="cell-main"><b>${esc(l.title)}</b>
          ${l.description ? `<span>${esc(l.description)}</span>` : ''}</div></td>
        <td data-label="المادة">${esc(subjectById(l.subjectId)?.name ?? '—')}</td>
        <td data-label="الترتيب">${formatNumber(l.order ?? 0)}</td>
        <td data-label="المرفقات">${attachBadges(l)}</td>
        <td data-label="الحالة">${pubPill(l.isPublished)}</td>
        <td data-label="إجراءات">${actionBtns(`lessons:${l.id}`, l.isPublished)}</td>
      </tr>`).join('')
    : `<tr><td colspan="6" style="text-align:center;color:var(--c-ink-2)">لا توجد دروس — أضف أول درس.</td></tr>`;
  }

  function lessonModal(lesson = null) {
    if (!taxonomy.subjects.length) { showToast('أضف مادة واحدة على الأقل أولًا', 'info'); return; }
    openFormModal({
      title: lesson ? 'تعديل الدرس' : 'إضافة درس',
      bodyHTML:
        field('title', 'عنوان الدرس', lesson?.title ?? '', { required: true })
        + selectField('subjectId', 'المادة (تحدد الصف تلقائيًا)', subjectOptions(taxonomy, lesson?.subjectId))
        + textareaField('description', 'وصف مختصر', lesson?.description ?? '')
        + textareaField('content', 'الشرح النصي', lesson?.content ?? '', { rows: 8, hint: 'افصل الفقرات بسطرين فارغين' })
        + field('videoUrl', 'رابط فيديو YouTube', lesson?.videoUrl ?? '', { dir: 'ltr', placeholder: 'https://www.youtube.com/watch?v=…', hint: 'اختياري' })
        + field('order', 'ترتيب الدرس', lesson?.order ?? 0, { type: 'number' })
        + fileField('imageFile', 'صورة الدرس', { accept: 'image/*', currentUrl: lesson?.imageUrl ?? '', hint: 'اختياري — اتركه فارغًا للاحتفاظ بالحالي' })
        + fileField('pdfFile', 'ملف PDF', { accept: 'application/pdf', currentUrl: lesson?.pdfUrl ?? '', hint: 'اختياري — بحد أقصى 10MB' })
        + checkboxField('isPublished', 'منشور للطلاب', lesson?.isPublished ?? true),
      onSubmit: async (f) => {
        const title = f.title.value.trim();
        if (title.length < 2) throw new Error('يرجى إدخال عنوان الدرس');
        const subject = subjectById(f.subjectId.value);
        if (!subject) throw new Error('يرجى اختيار المادة');
        const [imageUrl, pdfUrl] = await Promise.all([
          uploadFormFile(f, 'imageFile', 'uploads/images'),
          uploadFormFile(f, 'pdfFile', 'uploads/pdf'),
        ]);
        const data = {
          title,
          subjectId: subject.id,
          gradeId: subject.gradeId ?? null,
          stageId: subject.stageId ?? null,
          description: f.description.value.trim(),
          content: f.content.value.trim(),
          videoUrl: f.videoUrl.value.trim(),
          order: Number(f.order.value) || 0,
          imageUrl: imageUrl || lesson?.imageUrl || '',
          pdfUrl: pdfUrl || lesson?.pdfUrl || '',
          isPublished: f.isPublished.checked,
        };
        if (lesson) {
          await updateIn('lessons', lesson.id, data);
        } else {
          await createIn('lessons', data);
          await bumpCount('subjects', subject.id, 'lessonsCount', 1);
        }
        showToast(lesson ? 'تم تحديث الدرس' : 'تمت إضافة الدرس');
        refresh();
      },
    });
  }

  document.getElementById('addLessonBtn').addEventListener('click', () => lessonModal());
  filterEl.addEventListener('change', render);

  bindRowActions(document.getElementById('lessonsSection'), {
    onToggle: async (_c, id) => {
      const item = lessons.find((x) => x.id === id);
      await updateIn('lessons', id, { isPublished: !item.isPublished });
      showToast(item.isPublished ? 'تم الإخفاء' : 'تم النشر'); refresh();
    },
    onEdit: async (_c, id) => lessonModal(lessons.find((x) => x.id === id)),
    onDelete: async (_c, id) => {
      const item = lessons.find((x) => x.id === id);
      if (await removeIn('lessons', id, `الدرس "${item?.title}"`)) {
        await bumpCount('subjects', item.subjectId, 'lessonsCount', -1);
        refresh();
      }
    },
  });

  await refresh();
}

/* ==================== الاختبارات ==================== */

function quizActionBtns(key, published) {
  return `<div class="row-actions">
    <button class="icon-btn" data-questions="${key}" title="إدارة الأسئلة">
      <svg class="icon"><use href="#i-list-check"/></svg></button>
    <button class="icon-btn" data-toggle="${key}" title="${published ? 'إخفاء' : 'نشر'}">
      <svg class="icon"><use href="#i-eye"/></svg></button>
    <button class="icon-btn" data-edit="${key}" title="تعديل">
      <svg class="icon"><use href="#i-pen"/></svg></button>
    <button class="icon-btn danger" data-del="${key}" title="حذف">
      <svg class="icon"><use href="#i-trash"/></svg></button>
  </div>`;
}

async function initAdminQuizzes() {
  const ctx = await requireAdmin(); if (!ctx) return;
  initAdminShell(ctx);

  let taxonomy = null, quizzes = [];
  const tbody = document.getElementById('quizzesBody');
  const subjectById = (id) => taxonomy?.subjects.find((s) => s.id === id);
  const gradeById = (id) => taxonomy?.grades.find((g) => g.id === id);

  async function refresh() {
    try {
      taxonomy = await loadTaxonomy();
      const snap = await getDocs(collection(db, 'quizzes'));
      quizzes = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort(byNewest);
      render();
    } catch (err) {
      console.error(err);
      tbody.closest('table').outerHTML = errorState();
    }
  }

  function render() {
    tbody.innerHTML = quizzes.length ? quizzes.map((q) => `
      <tr>
        <td data-label="الاختبار"><div class="cell-main"><b>${esc(q.title)}</b>
          ${q.description ? `<span>${esc(q.description)}</span>` : ''}</div></td>
        <td data-label="الصف">${esc(gradeById(q.gradeId)?.name ?? '—')}</td>
        <td data-label="الأسئلة">${formatNumber(q.questionsCount ?? 0)}</td>
        <td data-label="الوقت">${q.durationMinutes ? formatNumber(q.durationMinutes) + ' د' : 'بدون'}</td>
        <td data-label="النجاح">${formatNumber(q.passScore ?? 50)}%</td>
        <td data-label="الحالة">${pubPill(q.isPublished)}</td>
        <td data-label="إجراءات">${quizActionBtns(`quizzes:${q.id}`, q.isPublished)}</td>
      </tr>`).join('')
    : `<tr><td colspan="7" style="text-align:center;color:var(--c-ink-2)">لا توجد اختبارات — أضف أول اختبار.</td></tr>`;
  }

  function quizModal(quiz = null) {
    if (!taxonomy.subjects.length) { showToast('أضف مادة واحدة على الأقل أولًا', 'info'); return; }
    openFormModal({
      title: quiz ? 'تعديل الاختبار' : 'إضافة اختبار',
      bodyHTML:
        field('title', 'عنوان الاختبار', quiz?.title ?? '', { required: true })
        + selectField('subjectId', 'المادة (تحدد الصف تلقائيًا)', subjectOptions(taxonomy, quiz?.subjectId))
        + textareaField('description', 'وصف الاختبار', quiz?.description ?? '')
        + `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">`
          + field('durationMinutes', 'المدة بالدقائق', quiz?.durationMinutes ?? 0, { type: 'number', hint: '0 = بدون وقت' })
          + field('passScore', 'نسبة النجاح %', quiz?.passScore ?? 50, { type: 'number' })
          + `</div>`
        + checkboxField('isPublished', 'منشور للطلاب', quiz?.isPublished ?? true),
      onSubmit: async (f) => {
        const title = f.title.value.trim();
        if (title.length < 2) throw new Error('يرجى إدخال عنوان الاختبار');
        const subject = subjectById(f.subjectId.value);
        if (!subject) throw new Error('يرجى اختيار المادة');
        const data = {
          title,
          subjectId: subject.id,
          gradeId: subject.gradeId ?? null,
          stageId: subject.stageId ?? null,
          description: f.description.value.trim(),
          durationMinutes: Math.max(0, Number(f.durationMinutes.value) || 0),
          passScore: Math.min(100, Math.max(1, Number(f.passScore.value) || 50)),
          isPublished: f.isPublished.checked,
        };
        if (quiz) {
          await updateIn('quizzes', quiz.id, data);
        } else {
          await createIn('quizzes', { ...data, questionsCount: 0 });
          await bumpCount('subjects', subject.id, 'quizzesCount', 1);
        }
        showToast(quiz ? 'تم تحديث الاختبار' : 'تمت إضافة الاختبار');
        refresh();
      },
    });
  }

  /* --- مدير الأسئلة (مجموعة فرعية) --- */
  async function openQuestionsModal(quiz) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal modal-lg" role="dialog" aria-modal="true" aria-label="أسئلة الاختبار">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
          <h3>أسئلة: ${esc(quiz.title)}</h3>
          <button type="button" class="btn btn-ghost btn-sm" data-close>إغلاق</button>
        </div>
        <p class="form-hint" style="margin-top:6px">لن يتمكن الطالب من حل الاختبار قبل إضافة سؤال واحد على الأقل.</p>
        <div id="qList"><div class="sk sk-line"></div></div>
        <div class="modal-actions">
          <button type="button" class="btn btn-primary" data-add>
            <svg class="icon"><use href="#i-plus"/></svg> إضافة سؤال</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay || e.target.closest('[data-close]')) overlay.remove();
    });
    overlay.querySelector('[data-add]').addEventListener('click', () => questionModal());

    async function refreshQuestions() {
      const listEl = overlay.querySelector('#qList');
      try {
        const snap = await getDocs(collection(db, 'quizzes', quiz.id, 'questions'));
        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort(byOrder);
        listEl.innerHTML = items.length ? items.map((q) => `
          <div class="question-row">
            <div class="cell-main"><b>${esc(q.text)}</b>
              <span>الصحيحة: ${ARABIC_LETTERS[q.correctIndex] ?? '—'}
                · ${formatNumber(q.points ?? 1)} ${pointsWord(q.points ?? 1)}
                · الترتيب ${formatNumber(q.order ?? 0)}</span></div>
            <div class="row-actions">
              <button class="icon-btn" data-qedit="${q.id}" title="تعديل"><svg class="icon"><use href="#i-pen"/></svg></button>
              <button class="icon-btn danger" data-qdel="${q.id}" title="حذف"><svg class="icon"><use href="#i-trash"/></svg></button>
            </div>
          </div>`).join('')
        : '<p class="form-hint" style="margin-top:12px">لا توجد أسئلة بعد.</p>';
      } catch (err) {
        console.error(err);
        listEl.innerHTML = errorState();
      }
    }

    function questionModal(question = null) {
      const saved = question?.options ?? ['', '', '', ''];
      openFormModal({
        title: question ? 'تعديل السؤال' : 'إضافة سؤال',
        submitText: question ? 'حفظ السؤال' : 'إضافة السؤال',
        bodyHTML:
          textareaField('text', 'نص السؤال', question?.text ?? '', { required: true, rows: 2 })
          + '<p class="form-hint" style="margin:4px 0 8px">انقر على الدائرة بجانب الخيار الصحيح:</p>'
          + [0, 1, 2, 3].map((i) => `
            <div class="option-form-row">
              <input type="radio" name="correctIndex" value="${i}"
                title="تحديد كإجابة صحيحة" ${(question?.correctIndex ?? 0) === i ? 'checked' : ''}>
              <input class="form-input" name="option${i}" value="${esc(saved[i] ?? '')}"
                placeholder="الخيار ${ARABIC_LETTERS[i]}${i > 1 ? ' (اختياري)' : ''}">
            </div>`).join('')
          + `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:14px">`
            + field('points', 'درجة السؤال', question?.points ?? 1, { type: 'number' })
            + field('order', 'الترتيب', question?.order ?? 0, { type: 'number' })
            + `</div>`,
        onSubmit: async (f) => {
          const text = f.text.value.trim();
          if (text.length < 3) throw new Error('يرجى إدخال نص السؤال');
          const correctIndex = Number(new FormData(f).get('correctIndex'));
          if (!Number.isInteger(correctIndex)) throw new Error('حدد الإجابة الصحيحة');
          const options = [0, 1, 2, 3].map((i) => f['option' + i].value.trim());
          if (!options[0] || !options[1]) throw new Error('أدخل نص الخيارين الأول والثاني على الأقل');
          const optsArr = [...options];
          while (optsArr.length > 2 && optsArr[optsArr.length - 1] === '') optsArr.pop();
          if (correctIndex >= optsArr.length) throw new Error('الإجابة الصحيحة يجب أن تكون من الخيارات المُدخلة');
          const data = {
            text, options: optsArr, correctIndex,
            points: Math.max(1, Number(f.points.value) || 1),
            order: Number(f.order.value) || 0,
          };
          if (question) {
            await updateDoc(doc(db, 'quizzes', quiz.id, 'questions', question.id), data);
          } else {
            await addDoc(collection(db, 'quizzes', quiz.id, 'questions'), data);
            await bumpCount('quizzes', quiz.id, 'questionsCount', 1);
          }
          showToast(question ? 'تم تحديث السؤال' : 'تمت إضافة السؤال');
          refreshQuestions();
        },
      });
    }

    overlay.addEventListener('click', async (e) => {
      const editBtn = e.target.closest('[data-qedit]');
      const delBtn = e.target.closest('[data-qdel]');
      if (editBtn) {
        const snap = await getDoc(doc(db, 'quizzes', quiz.id, 'questions', editBtn.dataset.qedit));
        if (snap.exists()) questionModal({ id: snap.id, ...snap.data() });
      }
      if (delBtn) {
        const ok = await confirmDialog({
          title: 'حذف السؤال؟', message: 'سيُحذف السؤال من الاختبار نهائيًا.',
          confirmText: 'حذف', danger: true,
        });
        if (!ok) return;
        try {
          await deleteDoc(doc(db, 'quizzes', quiz.id, 'questions', delBtn.dataset.qdel));
          await bumpCount('quizzes', quiz.id, 'questionsCount', -1);
          showToast('تم حذف السؤال');
          refreshQuestions();
        } catch (err) {
          console.error(err);
          showToast('تعذر الحذف', 'error');
        }
      }
    });

    await refreshQuestions();
  }

  document.getElementById('addQuizBtn').addEventListener('click', () => quizModal());

  bindRowActions(document.getElementById('quizzesSection'), {
    onQuestions: async (_c, id) => openQuestionsModal(quizzes.find((x) => x.id === id)),
    onToggle: async (_c, id) => {
      const item = quizzes.find((x) => x.id === id);
      await updateIn('quizzes', id, { isPublished: !item.isPublished });
      showToast(item.isPublished ? 'تم الإخفاء' : 'تم النشر'); refresh();
    },
    onEdit: async (_c, id) => quizModal(quizzes.find((x) => x.id === id)),
    onDelete: async (_c, id) => {
      const item = quizzes.find((x) => x.id === id);
      if (await removeIn('quizzes', id, `الاختبار "${item?.title}" وكل أسئلته`)) {
        /* Firestore لا يحذف المجموعات الفرعية تلقائيًا — نحذف الأسئلة يدويًا */
        try {
          const qSnap = await getDocs(collection(db, 'quizzes', id, 'questions'));
          await Promise.all(qSnap.docs.map((d) => deleteDoc(d.ref)));
        } catch (err) {
          console.warn('تعذر حذف أسئلة الاختبار:', err.message);
        }
        await bumpCount('subjects', item.subjectId, 'quizzesCount', -1);
        refresh();
      }
    },
  });

  await refresh();
}

/* ==================== الكورسات ==================== */
async function initAdminCourses() {
  const ctx = await requireAdmin(); if (!ctx) return;
  initAdminShell(ctx);

  let taxonomy = null, courses = [];
  const tbody = document.getElementById('coursesBody');
  const gradeById = (id) => taxonomy?.grades.find((g) => g.id === id);

  async function refresh() {
    try {
      taxonomy = await loadTaxonomy();
      const snap = await getDocs(collection(db, 'courses'));
      courses = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort(byNewest);
      render();
    } catch (err) {
      console.error(err);
      tbody.closest('table').outerHTML = errorState();
    }
  }

  function render() {
    tbody.innerHTML = courses.length ? courses.map((c) => `
      <tr>
        <td data-label="الكورس"><div class="cell-main"><b>${esc(c.title)}</b>
          ${c.description ? `<span>${esc(c.description)}</span>` : ''}</div></td>
        <td data-label="الصف">${esc(gradeById(c.gradeId)?.name ?? '—')}</td>
        <td data-label="المدرب">${esc(c.instructor || '—')}</td>
        <td data-label="الدروس">${formatNumber(c.lessonsCount ?? 0)}</td>
        <td data-label="السعر">${c.isFree ? '<span class="pill pill-on">مجاني</span>' : `<b>${formatNumber(c.price ?? 0)}</b>`}</td>
        <td data-label="الحالة">${pubPill(c.isPublished)}</td>
        <td data-label="إجراءات">${actionBtns(`courses:${c.id}`, c.isPublished)}</td>
      </tr>`).join('')
    : `<tr><td colspan="7" style="text-align:center;color:var(--c-ink-2)">لا توجد كورسات — أضف أول كورس.</td></tr>`;
  }

  function courseModal(course = null) {
    if (!taxonomy.subjects.length) { showToast('أضف مادة واحدة على الأقل أولًا', 'info'); return; }
    openFormModal({
      title: course ? 'تعديل الكورس' : 'إضافة كورس',
      bodyHTML:
        field('title', 'اسم الكورس', course?.title ?? '', { required: true })
        + selectField('subjectId', 'المادة (تحدد المرحلة والصف تلقائيًا)', subjectOptions(taxonomy, course?.subjectId))
        + textareaField('description', 'وصف الكورس', course?.description ?? '')
        + field('instructor', 'المدرب', course?.instructor ?? '', { placeholder: 'مثال: د. أحمد محمد' })
        + field('lessonsCount', 'عدد الدروس', course?.lessonsCount ?? 0, { type: 'number' })
        + field('price', 'السعر', course?.price ?? 0, { type: 'number', hint: 'يظهر للطلاب فقط إذا ألغيت تحديد «مجاني»' })
        + checkboxField('isFree', 'كورس مجاني', course?.isFree ?? true)
        + fileField('imageFile', 'صورة الكورس', { accept: 'image/*', currentUrl: course?.imageUrl ?? '', hint: 'اختياري — اتركه فارغًا للاحتفاظ بالحالي' })
        + checkboxField('isPublished', 'منشور للطلاب', course?.isPublished ?? true),
      onSubmit: async (f) => {
        const title = f.title.value.trim();
        if (title.length < 2) throw new Error('يرجى إدخال اسم الكورس');
        const subject = taxonomy.subjects.find((s) => s.id === f.subjectId.value);
        if (!subject) throw new Error('يرجى اختيار المادة');
        const isFree = f.isFree.checked;
        const price = Number(f.price.value) || 0;
        if (!isFree && price <= 0) throw new Error('أدخل سعر الكورس أو حدّده كمجاني');
        const imageUrl = await uploadFormFile(f, 'imageFile', 'uploads/images');
        const data = {
          title,
          subjectId: subject.id,
          gradeId: subject.gradeId ?? null,
          stageId: subject.stageId ?? null,
          description: f.description.value.trim(),
          instructor: f.instructor.value.trim(),
          lessonsCount: Number(f.lessonsCount.value) || 0,
          isFree,
          price: isFree ? 0 : price,
          imageUrl: imageUrl || course?.imageUrl || '',
          isPublished: f.isPublished.checked,
        };
        course ? await updateIn('courses', course.id, data) : await createIn('courses', data);
        showToast(course ? 'تم تحديث الكورس' : 'تمت إضافة الكورس');
        refresh();
      },
    });
  }

  document.getElementById('addCourseBtn').addEventListener('click', () => courseModal());

  bindRowActions(document.getElementById('coursesSection'), {
    onToggle: async (_c, id) => {
      const item = courses.find((x) => x.id === id);
      await updateIn('courses', id, { isPublished: !item.isPublished });
      showToast(item.isPublished ? 'تم الإخفاء' : 'تم النشر'); refresh();
    },
    onEdit: async (_c, id) => courseModal(courses.find((x) => x.id === id)),
    onDelete: async (_c, id) => {
      const item = courses.find((x) => x.id === id);
      if (await removeIn('courses', id, `الكورس "${item?.title}"`)) refresh();
    },
  });

  await refresh();
}

/* ==================== النتائج (قراءة فقط + بحث) ==================== */
async function initAdminResults() {
  const ctx = await requireAdmin(); if (!ctx) return;
  initAdminShell(ctx);

  let results = [], usersMap = new Map();
  const tbody = document.getElementById('resultsBody');
  const searchEl = document.getElementById('resultsSearch');
  const countEl = document.getElementById('resultsCount');

  async function refresh() {
    try {
      const [rSnap, uSnap] = await Promise.all([
        getDocs(collection(db, 'results')),
        getDocs(collection(db, 'users')),
      ]);
      usersMap = new Map(uSnap.docs.map((d) => [d.id, d.data()]));
      results = rSnap.docs.map((d) => ({ id: d.id, ...d.data() })).sort(byNewest);
      render();
    } catch (err) {
      console.error(err);
      tbody.closest('table').outerHTML = errorState();
    }
  }

  function render() {
    const q = searchEl.value.trim().toLowerCase();
    const list = results.filter((r) => {
      if (!q) return true;
      const u = usersMap.get(r.userId) ?? {};
      return `${u.name ?? ''} ${u.email ?? ''} ${r.quizTitle ?? ''}`.toLowerCase().includes(q);
    });
    countEl.textContent = `(${formatNumber(list.length)} من ${formatNumber(results.length)} نتيجة)`;

    tbody.innerHTML = list.length ? list.map((r) => {
      const u = usersMap.get(r.userId) ?? {};
      return `
      <tr>
        <td data-label="الطالب"><div class="cell-main"><b>${esc(u.name || 'حساب محذوف')}</b>
          <span dir="ltr">${esc(u.email || '—')}</span></div></td>
        <td data-label="الاختبار">${esc(r.quizTitle || '—')}</td>
        <td data-label="الدرجة" dir="ltr">${formatNumber(r.score)} / ${formatNumber(r.total)}</td>
        <td data-label="النسبة"><span class="score-pill ${r.passed ? 'score-pass' : 'score-fail'}">${formatNumber(r.percent)}%</span></td>
        <td data-label="التاريخ">${formatDate(r.createdAt)}</td>
      </tr>`;
    }).join('')
    : `<tr><td colspan="5" style="text-align:center;color:var(--c-ink-2)">لا توجد نتائج مطابقة للبحث.</td></tr>`;
  }

  searchEl.addEventListener('input', render);
  await refresh();
}

/* ---------- التشغيل حسب الصفحة ---------- */
const page = document.body.dataset.page;
if (page === 'adminLessons') initAdminLessons();
if (page === 'adminQuizzes') initAdminQuizzes();
if (page === 'adminCourses') initAdminCourses();
if (page === 'adminResults') initAdminResults();
