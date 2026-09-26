// ============================================================
// لوحة الإدارة — صفحة الرسائل:
// قراءة رسائل "تواصل معنا" + البحث + الرد (يُحفظ في Firestore)
// + زر mailto يفتح بريد الأدمن بالرد جاهزًا للإرسال
// ============================================================
import { fbStoreNS } from './firebase-config.js';
import { requireAdmin, initAdminShell, updateIn, errorState } from './admin-core.js';
import { esc, showToast, formatNumber, formatDate, confirmDialog, setBtnLoading } from './utils.js';

const { collection, getDocs, serverTimestamp } = fbStoreNS;

const $id = (id) => document.getElementById(id);
const byNewest = (a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0);

let messages = [];
const listEl = () => $id('messagesList');

function statusPill(m) {
  return m.reply
    ? '<span class="pill pill-on">تم الرد</span>'
    : '<span class="pill pill-admin">جديدة</span>';
}

function mailtoHref(m) {
  const subject = encodeURIComponent(`رد بخصوص رسالتك — الدكتور في العلوم`);
  const body = encodeURIComponent(
    (m.reply ? m.reply + '\n\n' : '') +
    '—\nأصل رسالتك:\n' + (m.message || '')
  );
  return `mailto:${encodeURIComponent(m.email || '')}?subject=${subject}&body=${body}`;
}

function cardHTML(m) {
  return `
  <article class="msg-card ${m.reply ? 'is-replied' : ''}">
    <div class="msg-head">
      <div class="msg-who">
        <b>${esc(m.name || 'بدون اسم')}</b>
        <span dir="ltr">${esc(m.email || '—')}</span>
        ${m.phone ? `<span> · <span dir="ltr">${esc(m.phone)}</span></span>` : ''}
      </div>
      ${statusPill(m)}
    </div>
    <p class="msg-body">${esc(m.message || '')}</p>
    ${m.reply
      ? `<div class="msg-reply"><b>رد الإدارة</b><p>${esc(m.reply)}</p></div>`
      : ''}
    <div class="msg-foot">
      <span class="item-meta">${formatDate(m.createdAt)}</span>
      <div class="row-actions">
        <a class="icon-btn" href="${mailtoHref(m)}" title="إرسال الرد بالبريد">
          <svg class="icon"><use href="#i-mail"/></svg></a>
        <button class="icon-btn" data-reply="${m.id}" title="${m.reply ? 'تعديل الرد' : 'الرد على الرسالة'}">
          <svg class="icon"><use href="#i-pen"/></svg></button>
      </div>
    </div>
  </article>`;
}

function render() {
  const q = ($id('messagesSearch')?.value || '').trim().toLowerCase();
  const list = messages.filter((m) =>
    !q || `${m.name ?? ''} ${m.email ?? ''} ${m.message ?? ''}`.toLowerCase().includes(q));

  const newCount = messages.filter((m) => !m.reply).length;
  $id('messagesCount').textContent =
    `${formatNumber(list.length)} من ${formatNumber(messages.length)} رسالة` +
    (newCount ? ` · ${formatNumber(newCount)} جديدة بانتظار الرد` : '');

  listEl().innerHTML = list.length
    ? list.map(cardHTML).join('')
    : (messages.length
      ? `<div class="empty-state"><svg class="icon"><use href="#i-search"/></svg>
           <h3>لا توجد رسائل مطابقة للبحث</h3><p>جرّب كلمة أخرى.</p></div>`
      : `<div class="empty-state"><svg class="icon"><use href="#i-mail"/></svg>
           <h3>لا توجد رسائل بعد</h3>
           <p>ستظهر هنا رسائل الزوار والطلاب فور وصولها من صفحة «تواصل معنا».</p></div>`);
}

function replyModal(m) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal modal-lg" role="dialog" aria-modal="true" aria-label="الرد على الرسالة">
      <h3>الرد على: ${esc(m.name || 'زائر')}</h3>
      <p class="form-hint">من: <span dir="ltr">${esc(m.email || '—')}</span></p>
      <div class="msg-body" style="background:var(--c-paper);border-radius:10px;padding:12px 14px;margin-top:10px">${esc(m.message || '')}</div>
      <div class="form-group" style="margin-top:14px">
        <label class="form-label" for="replyText">نص الرد</label>
        <textarea class="form-textarea" id="replyText" rows="6"
          placeholder="اكتب ردك هنا…">${esc(m.reply ?? '')}</textarea>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-primary" data-save>حفظ الرد</button>
        ${m.reply ? '' : `<a class="btn btn-outline" href="${mailtoHref(m)}">
          <svg class="icon"><use href="#i-mail"/></svg> إرسال بالبريد</a>`}
        <button type="button" class="btn btn-ghost" data-cancel>إلغاء</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || e.target.closest('[data-cancel]')) close();
  });

  overlay.querySelector('[data-save]').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const text = overlay.querySelector('#replyText').value.trim();
    if (text.length < 2) { showToast('اكتب نص الرد أولًا', 'error'); return; }

    if (m.reply) {
      const ok = await confirmDialog({
        title: 'تعديل الرد؟',
        message: 'سيتم استبدال الرد المحفوظ السابق بهذا النص.',
        confirmText: 'تحديث الرد',
      });
      if (!ok) return;
    }

    setBtnLoading(btn, true);
    try {
      await updateIn('messages', m.id, {
        reply: text,
        repliedAt: serverTimestamp(),
      });
      showToast('تم حفظ الرد — يمكنك إرساله بالبريد بزر البريد');
      close();
      await refresh();
    } catch (err) {
      console.error('خطأ في حفظ الرد:', err);
      showToast('تعذر حفظ الرد — تأكد من نشر قواعد messages المحدثة', 'error');
      setBtnLoading(btn, false);
    }
  });
}

async function refresh() {
  try {
    const snap = await getDocs(collection(db(), 'messages'));
    messages = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort(byNewest);
    render();
  } catch (err) {
    console.error('خطأ في تحميل الرسائل:', err);
    listEl().innerHTML = errorState();
  }
}

/* db() عبر الاستيراد المباشر */
import { db } from './firebase-config.js';

async function initAdminMessages() {
  const ctx = await requireAdmin();
  if (!ctx) return;
  initAdminShell(ctx);

  $id('messagesSearch').addEventListener('input', render);
  listEl().addEventListener('click', (e) => {
    const btn = e.target.closest('[data-reply]');
    if (!btn) return;
    const m = messages.find((x) => x.id === btn.dataset.reply);
    if (m) replyModal(m);
  });

  await refresh();
}

initAdminMessages();
