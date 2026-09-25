// ============================================================
// أدوات مشتركة: أيقونات، توست، مودال تأكيد، أخطاء عربية، تنسيقات
// ============================================================

// نفس Sprite الموجود في index.html — يُحقن تلقائيًا في باقي الصفحات
const SPRITE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" style="display:none" id="icon-sprite">
  <symbol id="i-menu" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M4 12h16M4 17h16"/></symbol>
  <symbol id="i-close" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></symbol>
  <symbol id="i-chevron-down" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></symbol>
  <symbol id="i-arrow-left" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5m0 0 6-6m-6 6 6 6"/></symbol>
  <symbol id="i-atom" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><ellipse cx="12" cy="12" rx="10" ry="4.2"/><ellipse cx="12" cy="12" rx="10" ry="4.2" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4.2" transform="rotate(120 12 12)"/></symbol>
  <symbol id="i-flask" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 3h5M10.5 3v5.3L5.3 17.4a2.2 2.2 0 0 0 2 3.1h9.4a2.2 2.2 0 0 0 2-3.1L13.5 8.3V3M7.5 14.5h9"/></symbol>
  <symbol id="i-book" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/></symbol>
  <symbol id="i-cap" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10 12 5 2 10l10 5 10-5Z"/><path d="M6 12.5V17c0 1.7 2.7 3 6 3s6-1.3 6-3v-4.5"/><path d="M22 10v5"/></symbol>
  <symbol id="i-layers" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="M3 13l9 5 9-5"/></symbol>
  <symbol id="i-video" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10.5 5-3v9l-5-3"/></symbol>
  <symbol id="i-file" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></symbol>
  <symbol id="i-list-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6.5 5.5 8 8 5.5M11 7h9M4 14.5 5.5 16 8 13.5M11 15h9"/></symbol>
  <symbol id="i-chart" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16M7 16v-4M12 16V8M17 16v-6"/></symbol>
  <symbol id="i-award" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="9" r="5"/><path d="M9.5 13.4 8 21l4-2.2L16 21l-1.5-7.6"/></symbol>
  <symbol id="i-users" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c1.2-3.2 3.6-4.8 6.5-4.8s5.3 1.6 6.5 4.8M16 4.6a3.5 3.5 0 0 1 0 6.8M17 15.2c2.1.6 3.6 2.2 4.3 4.8"/></symbol>
  <symbol id="i-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></symbol>
  <symbol id="i-check-circle" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m8.5 12.5 2.3 2.3 4.7-4.8"/></symbol>
  <symbol id="i-x-circle" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5l5 5M14.5 9.5l-5 5"/></symbol>
  <symbol id="i-info" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></symbol>
  <symbol id="i-alert" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4 3 19h18L12 4Z"/><path d="M12 10.5V14M12 16.5h.01"/></symbol>
  <symbol id="i-user" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4.5 20c1.4-3.4 4.2-5 7.5-5s6.1 1.6 7.5 5"/></symbol>
  <symbol id="i-logout" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 8l-4 4 4 4M6 12h10"/></symbol>
  <symbol id="i-phone" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h3.5L10 8.5 8 10a12 12 0 0 0 6 6l1.5-2 4.5 1.5V19a2 2 0 0 1-2 2A15 15 0 0 1 3 6a2 2 0 0 1 2-2Z"/></symbol>
  <symbol id="i-mail" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></symbol>
  <symbol id="i-map-pin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-5.8-7-11a7 7 0 0 1 14 0c0 5.2-7 11-7 11Z"/><circle cx="12" cy="10" r="2.5"/></symbol>
  <symbol id="i-play" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 8.3 15.8 12 10 15.7Z"/></symbol>
  <symbol id="i-download" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v10m0 0-4-4m4 4 4-4M5 19h14"/></symbol>
  <symbol id="i-pen" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3Z"/></symbol>
  <symbol id="i-trash" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M6.5 7l.9 13h9.2l.9-13"/></symbol>
  <symbol id="i-plus" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></symbol>
  <symbol id="i-lock" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="10.5" width="16" height="9.5" rx="2"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/></symbol>
  <symbol id="i-eye" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/></symbol>
  <symbol id="i-eye-off" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m4 4 16 16M9.9 5.9A9.9 9.9 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17.6 17.6 0 0 1-3.2 4M6.1 8.3A16.9 16.9 0 0 0 2.5 12S6 18.5 12 18.5a9.6 9.6 0 0 0 3.5-.7"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></symbol>
</svg>`;

export function injectIcons() {
  if (document.getElementById('icon-sprite')) return;
  document.body.insertAdjacentHTML('afterbegin', SPRITE_SVG);
}

/* ---------- أدوات DOM ---------- */
export const qs = (sel, root = document) => root.querySelector(sel);
export const qsa = (sel, root = document) => [...root.querySelectorAll(sel)];

/** حماية من حقن HTML عند عرض بيانات قادمة من قاعدة البيانات */
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g,
  (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

/* ---------- تنسيقات ---------- */
export const CURRENCY = 'ج.م'; // عدّل رمز العملة حسب بلدك

export function formatNumber(n) {
  try {
    return new Intl.NumberFormat('ar', { numberingSystem: 'latn' }).format(Number(n) || 0);
  } catch {
    return String(n || 0);
  }
}

export function formatDate(ts) {
  if (!ts) return '';
  const d = ts?.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
  return d.toLocaleDateString('ar', { numberingSystem: 'latn', year: 'numeric', month: 'long', day: 'numeric' });
}

/* ---------- إشعارات التوست ---------- */
export function showToast(message, type = 'success') {
  let wrap = qs('.toast-wrap');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.className = 'toast-wrap';
    document.body.appendChild(wrap);
  }
  const icons = { success: 'i-check-circle', error: 'i-x-circle', info: 'i-info' };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<svg class="icon"><use href="#${icons[type] || icons.info}"/></svg><div>${esc(message)}</div>`;
  wrap.appendChild(el);
  setTimeout(() => {
    el.classList.add('hide');
    setTimeout(() => el.remove(), 350);
  }, 3600);
}

/* ---------- حالة تحميل الأزرار (منع الإرسال المزدوج) ---------- */
export function setBtnLoading(btn, on) {
  if (!btn) return;
  if (on) {
    btn.dataset.label = btn.innerHTML;
    btn.classList.add('loading');
    btn.innerHTML = '<span class="spinner"></span> جارٍ التنفيذ…';
    btn.disabled = true;
  } else {
    btn.classList.remove('loading');
    btn.innerHTML = btn.dataset.label ?? btn.innerHTML;
    btn.disabled = false;
  }
}

/* ---------- ترجمة أخطاء Firebase Authentication إلى العربية ---------- */
export function mapAuthError(err) {
  const map = {
    'auth/email-already-in-use': 'هذا البريد الإلكتروني مسجل بالفعل. جرّب تسجيل الدخول.',
    'auth/invalid-email': 'صيغة البريد الإلكتروني غير صحيحة.',
    'auth/weak-password': 'كلمة المرور ضعيفة — استخدم 6 أحرف على الأقل.',
    'auth/missing-password': 'يرجى إدخال كلمة المرور.',
    'auth/wrong-password': 'كلمة المرور غير صحيحة.',
    'auth/user-not-found': 'لا يوجد حساب بهذا البريد الإلكتروني.',
    'auth/invalid-credential': 'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
    'auth/too-many-requests': 'محاولات كثيرة — انتظر قليلًا ثم أعد المحاولة.',
    'auth/network-request-failed': 'تعذر الاتصال بالشبكة، تحقق من اتصالك بالإنترنت.',
  };
  return map[err?.code] || 'حدث خطأ غير متوقع، يرجى المحاولة مرة أخرى.';
}

/* ---------- مودال تأكيد (بديل confirm) — يرجع Promise<boolean> ---------- */
export function confirmDialog({ title = 'تأكيد', message = '', confirmText = 'تأكيد', danger = false } = {}) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}">
        <div class="modal-icon ${danger ? 'danger' : ''}">
          <svg class="icon"><use href="#${danger ? 'i-alert' : 'i-info'}"/></svg>
        </div>
        <h3>${esc(title)}</h3>
        <p>${esc(message)}</p>
        <div class="modal-actions">
          <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-yes>${esc(confirmText)}</button>
          <button class="btn btn-ghost" data-no>إلغاء</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    const close = (val) => { overlay.remove(); resolve(val); };
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close(false);
      if (e.target.closest('[data-yes]')) close(true);
      if (e.target.closest('[data-no]')) close(false);
    });
  });
}
/* ---------- قراءة معاملات الرابط ---------- */
export function getQueryParam(name) {
  return new URLSearchParams(location.search).get(name);
}

/* ---------- تحديث عنوان الصفحة ووصفها (SEO) ---------- */
export function setPageMeta(title, description) {
  document.title = title ? `${title} | الدكتور في العلوم` : 'الدكتور في العلوم';
  if (description) {
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', description);
  }
}

/* ---------- حالة فراغ جاهزة (تُستخدم في كل الصفحات) ----------
   ملاحظة: action يُحقن كما هو (HTML نتحكم فيه نحن)، أما النصوص فمحمية */
export function emptyStateHTML(icon, title, text, { action = '', compact = false } = {}) {
  return `<div class="empty-state ${compact ? 'empty-compact' : ''}">
    <svg class="icon"><use href="#${icon}"/></svg>
    <h3>${esc(title)}</h3>
    <p>${esc(text)}</p>
    ${action}
  </div>`;
}

/* ---------- بطاقة كورس (مشتركة: الرئيسية + صفحة الصف) ---------- */
export function courseCardHTML(course) {
  const meta = [course.stageName, course.gradeName].filter(Boolean).join(' · ');
  const badge = course.isFree
    ? '<span class="badge badge-free">مجاني</span>'
    : '<span class="badge badge-paid">مدفوع</span>';
  const price = course.isFree
    ? ''
    : `<span class="course-price">${esc(course.price ?? '')} ${esc(CURRENCY)}</span>`;
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
