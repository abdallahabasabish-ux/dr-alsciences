// ============================================================
// لوحة الإدارة — منطق الصفحات (الجزء 1):
// admin/index (إحصائيات) / stages (مراحل + صفوف) / subjects / students
// الصفحات المتبقية (دروس/اختبارات/كورسات/نتائج) في js/admin-content.js
// ============================================================
import { db, fbStoreNS } from './firebase-config.js';
import {
  requireAdmin, initAdminShell, field, textareaField, selectField, opt,
  checkboxField, openFormModal, createIn, updateIn, removeIn,
  pubPill, actionBtns, errorState,
} from './admin-core.js';
import { esc, showToast, formatNumber, formatDate } from './utils.js';

const { collection, getDocs, getCountFromServer, query, where } = fbStoreNS;

const byOrder = (a, b) => (a.order ?? 9999) - (b.order ?? 9999);
const byNewest = (a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0);

/** تفويض أحداث صفوف الجدول: نشر/تعديل/حذف — المفتاح "collection:id" */
function bindRowActions(container, handlers) {
  container.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-toggle],[data-edit],[data-del]');
    if (!btn) return;
    const key = btn.dataset.toggle || btn.dataset.edit || btn.dataset.del;
    const [coll, id] = key.split(':');
    if (btn.dataset.toggle && handlers.onToggle) await handlers.onToggle(coll, id);
    if (btn.dataset.edit && handlers.onEdit) await handlers.onEdit(coll, id);
    if (btn.dataset.del && handlers.onDelete) await handlers.onDelete(coll, id);
  });
}

/* ==================== admin/index.html — الإحصائيات ==================== */
async function initAdminHome() {
  const ctx = await requireAdmin(); if (!ctx) return;
  initAdminShell(ctx);

  document.getElementById('adminWelcome').textContent = ctx.userDoc?.name || 'الأدمن';

  const defs = [
    ['lessons', 'statLessons'], ['quizzes', 'statQuizzes'],
    ['courses', 'statCourses'], ['subjects', 'statSubjects'],
    ['grades', 'statGrades'], ['users', 'statStudents'],
  ];
  await Promise.all(defs.map(async ([coll, id]) => {
    const el = document.getElementById(id);
    try {
      const snap = await getCountFromServer(collection(db, coll));
      el.textContent = formatNumber(snap.data().count);
    } catch {
      el.textContent = '—';
    }
  }));
}

/* ==================== admin/stages.html — المراحل + الصفوف ==================== */
async function initAdminStages() {
  const ctx = await requireAdmin(); if (!ctx) return;
  initAdminShell(ctx);

  let stages = [], grades = [];
  const stagesBody = document.getElementById('stagesBody');
  const gradesBody = document.getElementById('gradesBody');
  const stageFilter = document.getElementById('stageFilter');

  const stageName = (id) => stages.find((s) => s.id === id)?.name || '—';

  async function refresh() {
    try {
      const [sSnap, gSnap] = await Promise.all([
        getDocs(collection(db, 'stages')), getDocs(collection(db, 'grades')),
      ]);
      stages = sSnap.docs.map((d) => ({ id: d.id, ...d.data() })).sort(byOrder);
      grades = gSnap.docs.map((d) => ({ id: d.id, ...d.data() })).sort(byOrder);
      renderStages(); renderGrades(); fillFilter();
    } catch (err) {
      console.error(err);
      stagesBody.closest('table').outerHTML = errorState();
      gradesBody.closest('table').outerHTML = errorState();
    }
  }

  function renderStages() {
    stagesBody.innerHTML = stages.length ? stages.map((s) => `
      <tr>
        <td data-label="المرحلة"><div class="cell-main"><b>${esc(s.name)}</b></div></td>
        <td data-label="الترتيب">${formatNumber(s.order ?? 0)}</td>
        <td data-label="الحالة">${pubPill(s.isPublished)}</td>
        <td data-label="إجراءات">${actionBtns(`stages:${s.id}`, s.isPublished)}</td>
      </tr>`).join('')
      : `<tr><td colspan="4" style="text-align:center;color:var(--c-ink-2)">لا توجد مراحل — أضف أول مرحلة.</td></tr>`;
  }

  function renderGrades() {
    const filter = stageFilter.value;
    const list = filter ? grades.filter((g) => g.stageId === filter) : grades;
    gradesBody.innerHTML = list.length ? list.map((g) => `
      <tr>
        <td data-label="الصف"><div class="cell-main"><b>${esc(g.name)}</b>
          ${g.description ? `<span>${esc(g.description)}</span>` : ''}</div></td>
        <td data-label="المرحلة">${esc(stageName(g.stageId))}</td>
        <td data-label="الترتيب">${formatNumber(g.order ?? 0)}</td>
        <td data-label="الحالة">${pubPill(g.isPublished)}</td>
        <td data-label="إجراءات">${actionBtns(`grades:${g.id}`, g.isPublished)}</td>
      </tr>`).join('')
      : `<tr><td colspan="5" style="text-align:center;color:var(--c-ink-2)">لا توجد صفوف مطابقة.</td></tr>`;
  }

  function fillFilter() {
    const current = stageFilter.value;
    stageFilter.innerHTML = '<option value="">كل المراحل</option>'
      + stages.map((s) => opt(s.id, s.name, s.id === current)).join('');
  }

  function stageModal(stage = null) {
    openFormModal({
      title: stage ? 'تعديل المرحلة' : 'إضافة مرحلة',
      bodyHTML:
        field('name', 'اسم المرحلة', stage?.name ?? '', { required: true, placeholder: 'مثال: المرحلة الابتدائية' })
        + field('order', 'الترتيب', stage?.order ?? 0, { type: 'number', hint: 'يحدد ترتيب الظهور' })
        + checkboxField('isPublished', 'منشورة للطلاب', stage?.isPublished ?? true),
      onSubmit: async (f) => {
        const name = f.name.value.trim();
        if (name.length < 2) throw new Error('يرجى إدخال اسم المرحلة');
        const data = { name, order: Number(f.order.value) || 0, isPublished: f.isPublished.checked };
        stage ? await updateIn('stages', stage.id, data) : await createIn('stages', data);
        showToast(stage ? 'تم تحديث المرحلة' : 'تمت إضافة المرحلة');
        refresh();
      },
    });
  }

  function gradeModal(grade = null) {
    if (!stages.length) { showToast('أضف مرحلة واحدة على الأقل أولًا', 'info'); return; }
    openFormModal({
      title: grade ? 'تعديل الصف' : 'إضافة صف',
      bodyHTML:
        field('name', 'اسم الصف', grade?.name ?? '', { required: true, placeholder: 'مثال: الصف الرابع الابتدائي' })
        + selectField('stageId', 'المرحلة', stages.map((s) => opt(s.id, s.name, grade?.stageId === s.id)).join(''))
        + textareaField('description', 'وصف مختصر', grade?.description ?? '')
        + field('order', 'الترتيب', grade?.order ?? 0, { type: 'number' })
        + checkboxField('isPublished', 'منشور للطلاب', grade?.isPublished ?? true),
      onSubmit: async (f) => {
        const name = f.name.value.trim();
        if (name.length < 2) throw new Error('يرجى إدخال اسم الصف');
        if (!f.stageId.value) throw new Error('يرجى اختيار المرحلة');
        const data = {
          name, stageId: f.stageId.value,
          description: f.description.value.trim(),
          order: Number(f.order.value) || 0,
          isPublished: f.isPublished.checked,
        };
        grade ? await updateIn('grades', grade.id, data) : await createIn('grades', data);
        showToast(grade ? 'تم تحديث الصف' : 'تمت إضافة الصف');
        refresh();
      },
    });
  }

  document.getElementById('addStageBtn').addEventListener('click', () => stageModal());
  document.getElementById('addGradeBtn').addEventListener('click', () => gradeModal());
  stageFilter.addEventListener('change', renderGrades);

  bindRowActions(document.getElementById('stagesSection'), {
    onToggle: async (coll, id) => {
      const item = (coll === 'stages' ? stages : grades).find((x) => x.id === id);
      await updateIn(coll, id, { isPublished: !item.isPublished });
      showToast(item.isPublished ? 'تم الإخفاء' : 'تم النشر'); refresh();
    },
    onEdit: async (coll, id) => {
      coll === 'stages' ? stageModal(stages.find((x) => x.id === id))
                        : gradeModal(grades.find((x) => x.id === id));
    },
    onDelete: async (coll, id) => {
      const item = (coll === 'stages' ? stages : grades).find((x) => x.id === id);
      if (coll === 'stages' && grades.some((g) => g.stageId === id)) {
        showToast('لا يمكن حذف مرحلة بها صفوف — احذف صفوفها أولًا', 'error');
        return;
      }
      if (await removeIn(coll, id, `"${item?.name}"`)) refresh();
    },
  });

  await refresh();
}

/* ==================== admin/subjects.html — المواد ==================== */
async function initAdminSubjects() {
  const ctx = await requireAdmin(); if (!ctx) return;
  initAdminShell(ctx);

  let stages = [], grades = [], subjects = [];
  const gradeMap = new Map();
  const tbody = document.getElementById('subjectsBody');

  async function refresh() {
    try {
      const [sS, gS, subS] = await Promise.all([
        getDocs(collection(db, 'stages')), getDocs(collection(db, 'grades')),
        getDocs(collection(db, 'subjects')),
      ]);
      stages = sS.docs.map((d) => ({ id: d.id, ...d.data() })).sort(byOrder);
      grades = gS.docs.map((d) => ({ id: d.id, ...d.data() })).sort(byOrder);
      gradeMap.clear();
      grades.forEach((g) => gradeMap.set(g.id, g));
      subjects = subS.docs.map((d) => ({ id: d.id, ...d.data() })).sort(byNewest);
      render();
    } catch (err) {
      console.error(err);
      tbody.closest('table').outerHTML = errorState();
    }
  }

  function gradeOptions(selectedId) {
    return '<option value="">— اختر الصف —</option>' + stages.map((st) => {
      const list = grades.filter((g) => g.stageId === st.id);
      if (!list.length) return '';
      return `<optgroup label="${esc(st.name)}">`
        + list.map((g) => opt(g.id, g.name, g.id === selectedId)).join('')
        + '</optgroup>';
    }).join('');
  }

  function render() {
    tbody.innerHTML = subjects.length ? subjects.map((s) => {
      const g = gradeMap.get(s.gradeId);
      return `
      <tr>
        <td data-label="المادة"><div class="cell-main"><b>${esc(s.name)}</b>
          ${s.description ? `<span>${esc(s.description)}</span>` : ''}</div></td>
        <td data-label="الصف">${esc(g?.name ?? '—')}</td>
        <td data-label="الدروس">${formatNumber(s.lessonsCount ?? 0)}</td>
        <td data-label="الاختبارات">${formatNumber(s.quizzesCount ?? 0)}</td>
        <td data-label="الحالة">${pubPill(s.isPublished)}</td>
        <td data-label="إجراءات">${actionBtns(`subjects:${s.id}`, s.isPublished)}</td>
      </tr>`;
    }).join('')
    : `<tr><td colspan="6" style="text-align:center;color:var(--c-ink-2)">لا توجد مواد — أضف أول مادة.</td></tr>`;
  }

  function subjectModal(subject = null) {
    if (!grades.length) { showToast('أضف صفًا دراسيًا واحدًا على الأقل أولًا', 'info'); return; }
    openFormModal({
      title: subject ? 'تعديل المادة' : 'إضافة مادة',
      bodyHTML:
        field('name', 'اسم المادة', subject?.name ?? '', {
          required: true, placeholder: 'مثال: العلوم',
          hint: 'الاسم يظهر للطلاب كما هو — يمكن أن يختلف بين المراحل (علوم / كيمياء…)',
        })
        + selectField('gradeId', 'الصف الدراسي', gradeOptions(subject?.gradeId))
        + textareaField('description', 'وصف المادة', subject?.description ?? '')
        + field('imageUrl', 'رابط صورة المادة', subject?.imageUrl ?? '', { dir: 'ltr', placeholder: 'https://…', hint: 'اختياري' })
        + `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">`
          + field('lessonsCount', 'عدد الدروس', subject?.lessonsCount ?? 0, { type: 'number', hint: 'يُحدَّث تلقائيًا عند إدارة الدروس' })
          + field('quizzesCount', 'عدد الاختبارات', subject?.quizzesCount ?? 0, { type: 'number' })
          + `</div>`
        + checkboxField('isPublished', 'منشورة للطلاب', subject?.isPublished ?? true),
      onSubmit: async (f) => {
        const name = f.name.value.trim();
        if (name.length < 2) throw new Error('يرجى إدخال اسم المادة');
        if (!f.gradeId.value) throw new Error('يرجى اختيار الصف الدراسي');
        const grade = gradeMap.get(f.gradeId.value);
        const data = {
          name, gradeId: grade.id, stageId: grade.stageId ?? null,
          description: f.description.value.trim(),
          imageUrl: f.imageUrl.value.trim(),
          lessonsCount: Number(f.lessonsCount.value) || 0,
          quizzesCount: Number(f.quizzesCount.value) || 0,
          isPublished: f.isPublished.checked,
        };
        subject ? await updateIn('subjects', subject.id, data) : await createIn('subjects', data);
        showToast(subject ? 'تم تحديث المادة' : 'تمت إضافة المادة');
        refresh();
      },
    });
  }

  document.getElementById('addSubjectBtn').addEventListener('click', () => subjectModal());

  bindRowActions(document.getElementById('subjectsSection'), {
    onToggle: async (_c, id) => {
      const item = subjects.find((x) => x.id === id);
      await updateIn('subjects', id, { isPublished: !item.isPublished });
      showToast(item.isPublished ? 'تم الإخفاء' : 'تم النشر'); refresh();
    },
    onEdit: async (_c, id) => subjectModal(subjects.find((x) => x.id === id)),
    onDelete: async (_c, id) => {
      const item = subjects.find((x) => x.id === id);
      if (await removeIn('subjects', id, `مادة "${item?.name}"`)) refresh();
    },
  });

  await refresh();
}

/* ==================== admin/students.html — الطلاب ==================== */
async function initAdminStudents() {
  const ctx = await requireAdmin(); if (!ctx) return;
  initAdminShell(ctx);

  let students = [];
  const gradeMap = new Map();
  const tbody = document.getElementById('studentsBody');
  const searchEl = document.getElementById('studentSearch');
  const countEl = document.getElementById('studentsCount');

  async function refresh() {
    try {
      const [uSnap, gSnap] = await Promise.all([
        getDocs(collection(db, 'users')), getDocs(collection(db, 'grades')),
      ]);
      gradeMap.clear();
      gSnap.forEach((d) => gradeMap.set(d.id, d.data().name));
      students = uSnap.docs.map((d) => ({ id: d.id, ...d.data() })).sort(byNewest);
      render();
    } catch (err) {
      console.error(err);
      tbody.closest('table').outerHTML = errorState();
    }
  }

  function render() {
    const q = searchEl.value.trim().toLowerCase();
    const list = students.filter((s) =>
      !q || (s.name || '').toLowerCase().includes(q) || (s.email || '').toLowerCase().includes(q));
    countEl.textContent = `(${formatNumber(list.length)} حساب)`;

    tbody.innerHTML = list.length ? list.map((s) => {
      const isAdminRow = s.role === 'admin';
      return `
      <tr>
        <td data-label="الحساب"><div class="cell-main"><b>${esc(s.name || 'بدون اسم')}</b>
          <span dir="ltr">${esc(s.email || '')}</span></div></td>
        <td data-label="الهاتف" dir="ltr">${esc(s.phone || '—')}</td>
        <td data-label="الصف">${esc(s.gradeId ? gradeMap.get(s.gradeId) ?? '—' : '—')}</td>
        <td data-label="الدور"><span class="pill ${isAdminRow ? 'pill-admin' : 'pill-student'}">${isAdminRow ? 'أدمن' : 'طالب'}</span></td>
        <td data-label="التسجيل">${formatDate(s.createdAt)}</td>
        <td data-label="الحالة">${s.isBlocked
          ? '<span class="pill pill-blocked">معطّل</span>'
          : '<span class="pill pill-on">مفعّل</span>'}</td>
        <td data-label="إجراءات">
          ${isAdminRow
            ? '<span class="item-meta">—</span>'
            : `<button class="btn btn-sm ${s.isBlocked ? 'btn-outline' : 'btn-ghost'}" data-block="${s.id}">
                 ${s.isBlocked ? 'تفعيل' : 'تعطيل'}</button>`}
        </td>
      </tr>`;
    }).join('')
    : `<tr><td colspan="7" style="text-align:center;color:var(--c-ink-2)">لا توجد حسابات مطابقة للبحث.</td></tr>`;
  }

  searchEl.addEventListener('input', render);

  tbody.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-block]');
    if (!btn) return;
    const student = students.find((s) => s.id === btn.dataset.block);
    const blocking = !student.isBlocked;
    const ok = await confirmDialog({
      title: blocking ? 'تعطيل الحساب؟' : 'تفعيل الحساب؟',
      message: blocking
        ? `لن يستطيع "${student?.name}" تسجيل الدخول أو استخدام المنصة حتى إعادة التفعيل.`
        : `سيتمكن "${student?.name}" من استخدام المنصة مجددًا.`,
      confirmText: blocking ? 'تعطيل' : 'تفعيل',
      danger: blocking,
    });
    if (!ok) return;
    try {
      await updateIn('users', student.id, { isBlocked: blocking });
      showToast(blocking ? 'تم تعطيل الحساب' : 'تم تفعيل الحساب');
      refresh();
    } catch (err) {
      console.error(err);
      showToast('تعذر تنفيذ العملية', 'error');
    }
  });

  await refresh();
}

/* ---------- التشغيل حسب الصفحة ---------- */
const page = document.body.dataset.page;
if (page === 'adminHome') initAdminHome();
if (page === 'adminStages') initAdminStages();
if (page === 'adminSubjects') initAdminSubjects();
if (page === 'adminStudents') initAdminStudents();
