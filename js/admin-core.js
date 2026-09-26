// ============================================================
// لوحة الإدارة — البنية المشتركة (النسخة المؤمّنة):
// - الصلاحية من Custom Claims (request.auth.token.admin)
//   مع شاشة ترحيل واضحة لحساب role بلا Claim
// - التوب بار والشريط الجانبي يُولَّدان تلقائيًا (صفر تكرار HTML)
// - تحقق عميل من نوع/حجم الملفات قبل الرفع + قواعد Storage خادمية
// ============================================================
import { auth, db, storage, isConfigured, fbAuthNS, fbStoreNS, fbStorageNS } from './firebase-config.js';
import { injectIcons, esc, showToast, confirmDialog, setBtnLoading, hidePreloader } from './utils.js';

const { doc, getDoc, addDoc, updateDoc, deleteDoc, collection, serverTimestamp } = fbStoreNS;
const { signOut, onAuthStateChanged } = fbAuthNS;
const { ref, uploadBytesResumable, getDownloadURL } = fbStorageNS;

/* ---------- بنية قائمة الإدارة (الرابط النشط يُحتسب تلقائيًا) ---------- */
const ADMIN_NAV = [
  { key: 'adminHome',     href: 'index.html',    icon: 'i-chart',       label: 'لوحة التحكم', group: 'main' },
  { key: 'adminStudents', href: 'students.html', icon: 'i-users',       label: 'الطلاب',      group: 'main' },
  { sep: 'المحتوى التعليمي' },
  { key: 'adminStages',   href: 'stages.html',   icon: 'i-layers',      label: 'المراحل والصفوف' },
  { key: 'adminSubjects', href: 'subjects.html', icon: 'i-flask',       label: 'المواد' },
  { key: 'adminLessons',  href: 'lessons.html',  icon: 'i-book',        label: 'الدروس' },
  { key: 'adminQuizzes',  href: 'quizzes.html',  icon: 'i-list-check',  label: 'الاختبارات' },
  { key: 'adminCourses',  href: 'courses.html',  icon: 'i-cap',         label: 'الكورسات' },
  { sep: 'التقارير' },
  { key: 'adminResults',  href: 'results.html',  icon: 'i-award',       label: 'النتائج' },
  { key: 'adminMessages', href: 'messages.html', icon: 'i-mail',        label: 'الرسائل' },
  { sep: 'عام' },
  { key: '__site',        href: '../index.html', icon: 'i-atom',        label: 'عرض الموقع' },
];

/* ---------- حماية صفحات الأدمن ----------
   الصلاحية: Custom Claim أو role=admin في users
   (القواعد الخادمية تفرض الحماية — الواجهة تعرض فقط)
   الصفحة كلها داخل <div id="adminRoot" hidden> ولا تُكشف قبل التحقق */
export async function requireAdmin() {
  const reveal = () => {
    const root = document.getElementById('adminRoot');
    if (root) root.hidden = false;
  };

  if (!isConfigured) {
    reveal();
    document.querySelector('.admin-main').innerHTML =
      `<div class="empty-state"><svg class="icon"><use href="#i-info"/></svg>
        <h3>لوحة الإدارة تحتاج ربط Firebase</h3>
        <p>استبدل قيم PASTE- في js/firebase-config.js ببيانات مشروعك.</p></div>`;
    hidePreloader();
    return null;
  }

  const user = await waitForAuth();
  if (!user) {
    location.replace(`../login.html?next=${encodeURIComponent('admin/' + location.pathname.split('/').pop())}`);
    return null;
  }

  /* قراءة مستند المستخدم: الدور + حالة الحساب */
  let userDoc = null;
  try {
    const snap = await getDoc(doc(db, 'users', user.uid));
    userDoc = snap.exists() ? snap.data() : null;
  } catch { /* القواعد هي الحارس الحقيقي */ }

  if (userDoc?.isBlocked) {
    await signOut(auth);
    location.replace('../index.html');
    return null;
  }

  /* الصلاحية: Claim (الأقوى) أو role=admin (يديره الأدمن من صفحة الطلاب) */
  let hasClaim = false;
  try {
    const token = await user.getIdTokenResult();
    hasClaim = token.claims.admin === true;
  } catch { /* يكمل بفحص الدور */ }

  if (hasClaim || userDoc?.role === 'admin') {
    reveal();
    return { user, userDoc };
  }

  /* مستخدم عادي: خارج اللوحة فورًا — بلا تحميل أي بيانات إدارية */
  location.replace('../student-dashboard.html');
  return null;
}
/* ---------- توليد هيكل اللوحة (توب بار + شريط جانبي) ---------- */
function topbarHTML(name, initial) {
  return `
  <div class="admin-topbar">
    <div class="admin-topbar-inner">
      <button class="menu-btn" id="adminMenuBtn" aria-label="فتح القائمة">
        <svg class="icon"><use href="#i-menu"/></svg>
      </button>
      <a class="admin-brand" href="index.html">
        <span class="brand-mark"><svg class="icon"><use href="#i-atom"/></svg></span>
        لوحة الإدارة
      </a>
      <div class="admin-user">
        <span class="avatar" id="adminInitial">${esc(initial)}</span>
        <span id="adminName">${esc(name)}</span>
        <button class="btn btn-ghost btn-sm" id="adminLogoutBtn">
          <svg class="icon"><use href="#i-logout"/></svg> خروج
        </button>
      </div>
    </div>
  </div>`;
}

function sidebarHTML(activeKey) {
  const items = ADMIN_NAV.map((n) => {
    if (n.sep) return `<span class="sep">${esc(n.sep)}</span>`;
    const active = n.key === activeKey;
    return `<a href="${n.href}" class="${active ? 'is-active' : ''}"${active ? ' aria-current="page"' : ''}>
      <svg class="icon"><use href="#${n.icon}"/></svg> ${esc(n.label)}</a>`;
  }).join('');
  return `
  <aside class="admin-sidebar" id="adminSidebar">
    <nav aria-label="قائمة الإدارة">${items}</nav>
  </aside>
  <div class="admin-backdrop" id="adminBackdrop"></div>`;
}

export function initAdminShell(ctx) {
  injectIcons();
  const { user, userDoc } = ctx;
  const fullName = userDoc?.name || user.displayName || 'الأدمن';
  const name = fullName.trim().split(/\s+/).filter(Boolean).slice(0, 2).join(' ') || fullName;
  
  const topRoot = document.getElementById('adminTopbarRoot');
  const sideRoot = document.getElementById('adminSidebarRoot');
  if (topRoot) topRoot.innerHTML = topbarHTML(name, name.charAt(0));
  if (sideRoot) sideRoot.innerHTML = sidebarHTML(document.body.dataset.page);

  const y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();

  document.getElementById('adminLogoutBtn')?.addEventListener('click', async () => {
    try { await signOut(auth); location.replace('../index.html'); }
    catch { showToast('تعذر تسجيل الخروج', 'error'); }
  });

  /* درج الإدارة (≤1024) — تفويض أحداث محصّن */
  const isOpen = () => document.body.classList.contains('admin-nav-open');
  const setNav = (open) => {
    document.body.classList.toggle('admin-nav-open', open);
    document.documentElement.classList.toggle('nav-locked', open);
  };
  document.addEventListener('click', (e) => {
    if (e.target.closest('#adminMenuBtn')) { e.preventDefault(); setNav(!isOpen()); return; }
    if (isOpen() && e.target.closest('#adminBackdrop')) setNav(false);
    if (isOpen() && e.target.closest('.admin-sidebar a')) setNav(false);
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isOpen()) setNav(false); });
  window.addEventListener('resize', () => { if (window.innerWidth > 1024 && isOpen()) setNav(false); });

  hidePreloader();
}

/* ---------- بناة حقول النماذج ---------- */
export function field(name, label, value = '', o = {}) {
  const { type = 'text', required = false, dir = '', placeholder = '', hint = '' } = o;
  return `<div class="form-group">
    <label class="form-label" for="f-${name}">${esc(label)}${required ? ' <span class="req">*</span>' : ''}</label>
    <input class="form-input" id="f-${name}" name="${name}" type="${type}"
      value="${esc(value)}"${dir ? ` dir="${dir}"` : ''}${placeholder ? ` placeholder="${esc(placeholder)}"` : ''}>
    ${hint ? `<p class="form-hint">${esc(hint)}</p>` : ''}
  </div>`;
}

export function textareaField(name, label, value = '', o = {}) {
  const { required = false, rows = 3, hint = '' } = o;
  return `<div class="form-group">
    <label class="form-label" for="f-${name}">${esc(label)}${required ? ' <span class="req">*</span>' : ''}</label>
    <textarea class="form-textarea" id="f-${name}" name="${name}" rows="${rows}">${esc(value)}</textarea>
    ${hint ? `<p class="form-hint">${esc(hint)}</p>` : ''}
  </div>`;
}

export function selectField(name, label, optionsHTML) {
  return `<div class="form-group">
    <label class="form-label" for="f-${name}">${esc(label)}</label>
    <select class="form-select" id="f-${name}" name="${name}">${optionsHTML}</select>
  </div>`;
}

export const opt = (value, text, selected = false) =>
  `<option value="${esc(value)}"${selected ? ' selected' : ''}>${esc(text)}</option>`;

export function checkboxField(name, label, checked = false) {
  return `<label class="check-row"><input type="checkbox" name="${name}"${checked ? ' checked' : ''}> <span>${esc(label)}</span></label>`;
}

/* ---------- مودال النماذج ---------- */
export function openFormModal({ title, bodyHTML, submitText = 'حفظ', onSubmit }) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal modal-lg" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <h3>${esc(title)}</h3>
      <div class="form-banner" hidden><svg class="icon"><use href="#i-x-circle"/></svg><span></span></div>
      <form novalidate>
        ${bodyHTML}
        <div class="modal-actions">
          <button type="submit" class="btn btn-primary">${esc(submitText)}</button>
          <button type="button" class="btn btn-ghost" data-cancel>إلغاء</button>
        </div>
      </form>
    </div>`;
  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || e.target.closest('[data-cancel]')) close();
  });
  overlay.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('[type="submit"]');
    setBtnLoading(btn, true);
    try {
      await onSubmit(e.target);
      close();
    } catch (err) {
      console.error(err);
      const banner = overlay.querySelector('.form-banner');
      banner.hidden = false;
      banner.querySelector('span').textContent = err?.message || 'حدث خطأ غير متوقع، حاول مرة أخرى';
      setBtnLoading(btn, false);
    }
  });
  overlay.querySelector('input,select,textarea')?.focus();
}

/* ---------- عمليات Firestore ---------- */
export const createIn = (coll, data) =>
  addDoc(collection(db, coll), { ...data, createdAt: serverTimestamp() });

export const updateIn = (coll, id, data) => updateDoc(doc(db, coll, id), data);

export async function removeIn(coll, id, label = 'هذا العنصر') {
  const ok = await confirmDialog({
    title: 'تأكيد الحذف',
    message: `سيتم حذف ${label} نهائيًا ولا يمكن التراجع عن ذلك.`,
    confirmText: 'حذف نهائي',
    danger: true,
  });
  if (!ok) return false;
  try {
    await deleteDoc(doc(db, coll, id));
    showToast('تم الحذف بنجاح');
    return true;
  } catch (err) {
    console.error(err);
    showToast('تعذر الحذف، حاول مرة أخرى', 'error');
    return false;
  }
}

/* ---------- رفع الملفات: تحقق عميل + قواعد Storage خادمية ---------- */
const FILE_RULES = {
  'uploads/images': { types: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'], maxMB: 5 },
  'uploads/pdf':    { types: ['application/pdf'], maxMB: 10 },
};

export function uploadFile(file, path, onProgress) {
  return new Promise((resolve, reject) => {
    const task = uploadBytesResumable(ref(storage, path), file);
    task.on('state_changed',
      (snap) => onProgress?.(Math.round((snap.bytesTransferred / snap.totalBytes) * 100) || 0),
      (err) => reject(new Error(
        err.code === 'storage/unauthorized'
          ? 'تعذر رفع الملف — تحقق من تفعيل Storage وقواعده'
          : 'تعذر رفع الملف، حاول مرة أخرى'
      )),
      async () => resolve(await getDownloadURL(task.snapshot.ref)),
    );
  });
}

export async function uploadFormFile(form, fieldName, folder) {
  const input = form.elements[fieldName];
  const file = input?.files?.[0];
  if (!file) return '';

  /* تحقق عميل (التحقق الخادمي في storage.rules إجباري إضافةً لهذا) */
  const rule = FILE_RULES[folder];
  if (rule) {
    if (!rule.types.includes(file.type)) {
      throw new Error('نوع الملف غير مسموح — الصور (jpg/png/webp/gif) أو PDF فقط');
    }
    if (file.size > rule.maxMB * 1024 * 1024) {
      throw new Error(`حجم الملف يتجاوز الحد المسموح (${rule.maxMB} ميجابايت)`);
    }
  }

  const safeName = Date.now() + '_' + file.name.replace(/[^\w.\-]/g, '_');
  const wrap = input.closest('.form-group')?.querySelector('[data-progress]');
  const bar = wrap?.querySelector('.progress-fill');
  wrap?.removeAttribute('hidden');
  const url = await uploadFile(file, `${folder}/${safeName}`,
    (p) => { if (bar) bar.style.width = p + '%'; });
  if (wrap) wrap.hidden = true;
  return url;
}

export function fileField(name, label, { hint = '', accept = '', currentUrl = '' } = {}) {
  const current = currentUrl
    ? `<p class="form-hint">الحالي: <a href="${esc(currentUrl)}" target="_blank" rel="noopener" dir="ltr">فتح الملف</a></p>`
    : '';
  return `<div class="form-group">
    <label class="form-label" for="f-${name}">${esc(label)}</label>
    <input class="form-input" id="f-${name}" name="${name}" type="file"${accept ? ` accept="${accept}"` : ''}>
    <div class="progress-track" style="height:8px;margin-top:8px" data-progress hidden><span class="progress-fill"></span></div>
    ${current}
    ${hint ? `<p class="form-hint">${esc(hint)}</p>` : ''}
  </div>`;
}

export function bindRowActions(container, handlers) {
  container.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-questions],[data-toggle],[data-edit],[data-del]');
    if (!btn) return;
    const key = btn.dataset.questions || btn.dataset.toggle || btn.dataset.edit || btn.dataset.del;
    const [coll, id] = key.split(':');
    if (btn.dataset.questions && handlers.onQuestions) return handlers.onQuestions(coll, id);
    if (btn.dataset.toggle && handlers.onToggle) await handlers.onToggle(coll, id);
    if (btn.dataset.edit && handlers.onEdit) await handlers.onEdit(coll, id);
    if (btn.dataset.del && handlers.onDelete) await handlers.onDelete(coll, id);
  });
}

export const pubPill = (v) =>
  v ? '<span class="pill pill-on">منشور</span>' : '<span class="pill pill-off">مخفي</span>';

export function actionBtns(key, published) {
  return `<div class="row-actions">
    <button class="icon-btn" data-toggle="${key}" title="${published ? 'إخفاء' : 'نشر'}">
      <svg class="icon"><use href="#i-eye"/></svg></button>
    <button class="icon-btn" data-edit="${key}" title="تعديل">
      <svg class="icon"><use href="#i-pen"/></svg></button>
    <button class="icon-btn danger" data-del="${key}" title="حذف">
      <svg class="icon"><use href="#i-trash"/></svg></button>
  </div>`;
}

export const errorState = () =>
  `<div class="empty-state"><svg class="icon"><use href="#i-x-circle"/></svg>
    <h3>تعذر تحميل البيانات</h3><p>حدّث الصفحة لإعادة المحاولة.</p></div>`;
