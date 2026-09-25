// ============================================================
// لوحة الإدارة — البنية المشتركة:
// حماية الصفحات بالدور، هيكل الشل (شريط جانبي محصّن + توب بار)،
// مودال النماذج، حقول جاهزة، رفع الملفات، وعمليات Firestore
// ============================================================
import { auth, db, storage, isConfigured, fbAuthNS, fbStoreNS, fbStorageNS } from './firebase-config.js';
import { injectIcons, esc, showToast, confirmDialog, setBtnLoading, hidePreloader } from './utils.js';

const { doc, getDoc, addDoc, updateDoc, deleteDoc, collection, serverTimestamp } = fbStoreNS;
const { signOut, onAuthStateChanged } = fbAuthNS;
const { ref, uploadBytesResumable, getDownloadURL } = fbStorageNS;

/* ---------- حماية صفحات الأدمن ---------- */
export async function requireAdmin() {
  if (!isConfigured) {
    document.querySelector('.admin-main').innerHTML =
      `<div class="empty-state"><svg class="icon"><use href="#i-info"/></svg>
        <h3>لوحة الإدارة تحتاج ربط Firebase</h3>
        <p>استبدل قيم PASTE- في js/firebase-config.js ببيانات مشروعك.</p></div>`;
    hidePreloader();
    return null;
  }
  const user = await new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (u) => { unsub(); resolve(u); });
  });
  if (!user) {
    location.replace(`../login.html?next=${encodeURIComponent('admin/' + location.pathname.split('/').pop())}`);
    return null;
  }
  const snap = await getDoc(doc(db, 'users', user.uid));
  const userDoc = snap.exists() ? snap.data() : null;
  if (userDoc?.isBlocked) { await signOut(auth); location.replace('../index.html'); return null; }
  if (userDoc?.role !== 'admin') { location.replace('../student-dashboard.html'); return null; }
  return { user, userDoc };
}

/* ---------- هيكل الشل (الشريط الجانبي + التوب بار) ---------- */
export function initAdminShell(ctx) {
  injectIcons();
  const { user, userDoc } = ctx;
  document.getElementById('adminName').textContent = userDoc?.name || user.displayName || 'الأدمن';
  document.getElementById('adminInitial').textContent = (userDoc?.name || user.displayName || 'أ').charAt(0);

  const y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();

  document.getElementById('adminLogoutBtn')?.addEventListener('click', async () => {
    try { await signOut(auth); location.replace('../index.html'); }
    catch { showToast('تعذر تسجيل الخروج', 'error'); }
  });

  /* قائمة الإدارة (موبايل) — تفويض أحداث محصّن */
  const adminNavOpen = () => document.body.classList.contains('admin-nav-open');
  const setAdminNav = (open) => {
    document.body.classList.toggle('admin-nav-open', open);
    document.documentElement.classList.toggle('nav-locked', open);
  };
  document.addEventListener('click', (e) => {
    if (e.target.closest('#adminMenuBtn')) { e.preventDefault(); setAdminNav(!adminNavOpen()); return; }
    if (adminNavOpen() && e.target.closest('#adminBackdrop')) setAdminNav(false);
    if (adminNavOpen() && e.target.closest('.admin-sidebar a')) setAdminNav(false);
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && adminNavOpen()) setAdminNav(false); });
  window.addEventListener('resize', () => { if (window.innerWidth > 1024 && adminNavOpen()) setAdminNav(false); });

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

/* ---------- مودال النماذج (إضافة/تعديل) ---------- */
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

/* ---------- رفع الملفات إلى Firebase Storage ---------- */

/** يرفع ملفًا ويعيد رابط التحميل — مع تقارير تقدم */
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

/** يقرأ حقل ملف من نموذج مودال — يعيد '' إذا لم يُختر ملف */
export async function uploadFormFile(form, fieldName, folder) {
  const input = form.elements[fieldName];
  const file = input?.files?.[0];
  if (!file) return '';
  const safeName = Date.now() + '_' + file.name.replace(/[^\w.\-]/g, '_');
  const wrap = input.closest('.form-group')?.querySelector('[data-progress]');
  const bar = wrap?.querySelector('.progress-fill');
  wrap?.removeAttribute('hidden');
  const url = await uploadFile(file, `${folder}/${safeName}`,
    (p) => { if (bar) bar.style.width = p + '%'; });
  if (wrap) wrap.hidden = true;
  return url;
}

/** حقل رفع ملف داخل المودال — مع عرض رابط الملف الحالي إن وجد */
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

/** تفويض أحداث صفوف الجدول: أسئلة/نشر/تعديل/حذف — المفتاح "collection:id" */
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

/* ---------- مكوّنات عرض ---------- */
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
