// ============================================================
// نموذج التواصل — يكتب في مجموعة messages في Firestore
// (إنشاء عام مُحقَّن من القواعد — القراءة للأدمن فقط)
// ============================================================
import { db, isConfigured, fbStoreNS } from './firebase-config.js';
import { initLayout } from './layout.js';
import { waitForAuth, getUserDoc } from './auth.js';
import { showToast, setBtnLoading } from './utils.js';

initLayout();

const { collection, addDoc, serverTimestamp } = fbStoreNS;

function setFieldError(input, message) {
  const group = input.closest('.form-group');
  if (!group) return;
  group.classList.add('has-error');
  const err = group.querySelector('.form-error');
  if (err) err.textContent = message;
}

async function initContact() {
  const form = document.getElementById('contactForm');
  if (!form) return;

  /* تعبئة مسبقة لمن سجّل الدخول */
  if (isConfigured) {
    const user = await waitForAuth();
    if (user) {
      const uDoc = await getUserDoc(user.uid);
      if (uDoc?.name) form.elements.name.value = uDoc.name;
      if (uDoc?.email) form.elements.email.value = uDoc.email;
      if (uDoc?.phone) form.elements.phone.value = uDoc.phone;
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    form.querySelectorAll('.form-group.has-error').forEach((g) => g.classList.remove('has-error'));

    const name = form.elements.name.value.trim();
    const email = form.elements.email.value.trim();
    const phone = form.elements.phone.value.trim();
    const message = form.elements.message.value.trim();

    let valid = true;
    if (name.length < 2) { setFieldError(form.elements.name, 'يرجى إدخال اسمك.'); valid = false; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setFieldError(form.elements.email, 'صيغة البريد الإلكتروني غير صحيحة.'); valid = false; }
    if (message.length < 10) { setFieldError(form.elements.message, 'اكتب رسالتك (10 أحرف على الأقل).'); valid = false; }
    if (!valid) return;

    if (!isConfigured) {
      showToast('لم يتم ربط Firebase بعد — استبدل قيم PASTE- في js/firebase-config.js', 'info');
      return;
    }

    const btn = document.getElementById('sendBtn');
    setBtnLoading(btn, true);
    try {
      await addDoc(collection(db, 'messages'), {
        name, email, phone, message,
        createdAt: serverTimestamp(),
      });
      showToast('وصلتنا رسالتك، سنرد عليك في أسرع وقت');
      form.reset();
    } catch (err) {
      console.error('خطأ في إرسال الرسالة:', err);
      showToast('تعذر إرسال الرسالة، حاول مرة أخرى', 'error');
    } finally {
      setBtnLoading(btn, false);
    }
  });
}

initContact();
