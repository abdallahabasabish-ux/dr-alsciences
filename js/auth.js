// ============================================================
// المصادقة: إنشاء الحساب، تسجيل الدخول، حماية الصفحات، الصلاحيات
// هذا الملف يعمل تلقائيًا حسب data-page في وسم <body>.
// ============================================================
import { auth, db, isConfigured, fbAuthNS, fbStoreNS } from './firebase-config.js';
import { injectIcons, mapAuthError, showToast, setBtnLoading } from './utils.js';

injectIcons();

const {
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  updateProfile, signOut, onAuthStateChanged,
} = fbAuthNS;
const { doc, setDoc, getDoc, getDocs, collection, serverTimestamp } = fbStoreNS;

/* ================= أدوات أساسية ================= */

/** ينتظر تحديد حالة المصادقة الأولية مرة واحدة */
export function waitForAuth() {
  if (!auth) return Promise.resolve(null);
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => { unsubscribe(); resolve(user); });
  });
}

/** بيانات مستند الطالب من Firestore (أو null) */
export async function getUserDoc(uid) {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    return snap.exists() ? snap.data() : null;
  } catch (err) {
    console.warn('تعذر قراءة بيانات الحساب:', err.message);
    return null;
  }
}

/** دور المستخدم — Custom Claims أولًا ثم حقل role في مستند users */
export async function getUserRole(user) {
  try {
    const token = await user.getIdTokenResult();
    if (token.claims.admin === true) return 'admin';
  } catch { /* لا توجد claims — نكمل بمستند users */ }
  const userDoc = await getUserDoc(user.uid);
  return userDoc?.role === 'admin' ? 'admin' : 'student';
}

/** الصفحة الرئيسية المناسبة حسب الدور */
export async function homeFor(user) {
  return (await getUserRole(user)) === 'admin' ? 'admin/index.html' : 'student-dashboard.html';
}

/* ================= حماية الصفحات ================= */

/** صفحات الطالب: يعيد المستخدم أو يحوّل لصفحة الدخول مع حفظ الوجهة */
export async function requireAuth() {
  const user = await waitForAuth();
  if (!user) {
    const next = encodeURIComponent(location.pathname.split('/').pop() + location.search);
    location.replace(`login.html?next=${next}`);
    return null;
  }
  const userDoc = await getUserDoc(user.uid);
  if (userDoc?.isBlocked) {
    await logoutUser();
    showToast('تم تعطيل حسابك. تواصل مع إدارة المنصة.', 'error');
    setTimeout(() => { location.replace('index.html'); }, 1400);
    return null;
  }
  return user;
}

/** صفحات الدخول/التسجيل: منع عرضها لمن سجّل دخوله مسبقًا */
export async function redirectIfAuthenticated() {
  if (!isConfigured) return;
  const user = await waitForAuth();
  if (user) location.replace(await homeFor(user));
}

/* ================= العمليات ================= */

/** إنشاء حساب جديد + مستند المستخدم في Firestore */
export async function registerUser({ name, phone, email, password, gradeId = '' }) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName: name });
  await setDoc(doc(db, 'users', cred.user.uid), {
    name,
    phone,
    email,
    role: 'student',
    gradeId: gradeId || null,
    createdAt: serverTimestamp(),
  });
  return cred.user;
}

export async function loginUser(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function logoutUser() {
  await signOut(auth);
}

/* ================= أدوات النماذج ================= */

export function setFieldError(input, message) {
  const group = input.closest('.form-group');
  if (!group) return;
  group.classList.add('has-error');
  const err = group.querySelector('.form-error');
  if (err) err.textContent = message;
}

export function clearFieldErrors(form) {
  form.querySelectorAll('.form-group.has-error').forEach((g) => g.classList.remove('has-error'));
}

export function bindPasswordToggle(btnId, inputId) {
  const btn = document.getElementById(btnId);
  const input = document.getElementById(inputId);
  if (!btn || !input) return;
  btn.addEventListener('click', () => {
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    btn.setAttribute('aria-label', show ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور');
    btn.innerHTML = `<svg class="icon"><use href="#${show ? 'i-eye-off' : 'i-eye'}"/></svg>`;
  });
}

export function showBanner(message, type = 'error') {
  const banner = document.getElementById('formBanner');
  if (!banner) return;
  banner.hidden = false;
  banner.classList.toggle('info', type === 'info');
  banner.querySelector('span').textContent = message;
}

/** تعبئة قائمة الصفوف من Firestore (الاسم ديناميكي من قاعدة البيانات) */
export async function populateGradeSelect(selectEl, selectedId = '') {
  if (!isConfigured || !selectEl) return;
  try {
    const snap = await getDocs(collection(db, 'grades'));
    const grades = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((g) => g.isPublished !== false)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    grades.forEach((g) => selectEl.add(new Option(g.name, g.id)));
    if (selectedId) selectEl.value = selectedId;
  } catch (err) {
    console.warn('تعذر تحميل الصفوف:', err.message);
  }
}

/* ================= صفحة تسجيل الدخول ================= */

function safeNextParam() {
  const next = new URLSearchParams(location.search).get('next');
  // حماية من فتح روابط خارجية عبر next
  return next && /^[\w\-./]+\.html/.test(next) && !next.includes('//') ? next : null;
}

const CONFIG_MSG = 'لم يتم ربط Firebase بعد — استبدل قيم PASTE- في ملف js/firebase-config.js ببيانات مشروعك ثم أعد المحاولة.';

async function initLoginPage() {
  redirectIfAuthenticated();
  bindPasswordToggle('togglePassword', 'password');
  if (!isConfigured) showBanner(CONFIG_MSG, 'info');

  const form = document.getElementById('loginForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearFieldErrors(form);
    const email = form.elements.email.value.trim();
    const password = form.elements.password.value;

    let valid = true;
    if (!email) { setFieldError(form.elements.email, 'يرجى إدخال البريد الإلكتروني.'); valid = false; }
    if (!password) { setFieldError(form.elements.password, 'يرجى إدخال كلمة المرور.'); valid = false; }
    if (!valid) return;

    if (!isConfigured) { showBanner(CONFIG_MSG, 'info'); return; }

    const btn = document.getElementById('loginBtn');
    setBtnLoading(btn, true);
    try {
      const user = await loginUser(email, password);
      const uDoc = await getUserDoc(user.uid);
      if (uDoc?.isBlocked) {
        await logoutUser();
        showBanner('تم تعطيل هذا الحساب. تواصل مع إدارة المنصة.');
        return;
      }
      showToast(`مرحبًا بك مجددًا${user.displayName ? '، ' + user.displayName : ''}`);
      location.replace(safeNextParam() || await homeFor(user));
    } catch (err) {
      showBanner(mapAuthError(err));
    } finally {
      setBtnLoading(btn, false);
    }
  });
}

/* ================= صفحة إنشاء الحساب ================= */

async function initRegisterPage() {
  redirectIfAuthenticated();
  bindPasswordToggle('togglePassword', 'password');
  populateGradeSelect(document.getElementById('grade'));
  if (!isConfigured) showBanner(CONFIG_MSG, 'info');

  const form = document.getElementById('registerForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearFieldErrors(form);
    const name = form.elements.name.value.trim();
    const phone = form.elements.phone.value.trim();
    const email = form.elements.email.value.trim();
    const password = form.elements.password.value;
    const confirm = form.elements.confirm.value;
    const gradeId = form.elements.grade.value;

    let valid = true;
    if (name.length < 3) { setFieldError(form.elements.name, 'يرجى إدخال الاسم كاملًا (3 أحرف على الأقل).'); valid = false; }
    if (!/^[+\d][\d\s-]{7,15}$/.test(phone)) { setFieldError(form.elements.phone, 'يرجى إدخال رقم هاتف صحيح.'); valid = false; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setFieldError(form.elements.email, 'صيغة البريد الإلكتروني غير صحيحة.'); valid = false; }
    if (password.length < 6) { setFieldError(form.elements.password, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل.'); valid = false; }
    if (password !== confirm) { setFieldError(form.elements.confirm, 'كلمتا المرور غير متطابقتين.'); valid = false; }
    if (!valid) return;

    if (!isConfigured) { showBanner(CONFIG_MSG, 'info'); return; }

    const btn = document.getElementById('registerBtn');
    setBtnLoading(btn, true);
    try {
      await registerUser({ name, phone, email, password, gradeId });
      showToast('تم إنشاء حسابك بنجاح، أهلًا بك!');
      location.replace('student-dashboard.html');
    } catch (err) {
      showBanner(mapAuthError(err));
    } finally {
      setBtnLoading(btn, false);
    }
  });
}

/* ---------- التشغيل حسب الصفحة ---------- */
const page = document.body.dataset.page;
if (page === 'login') initLoginPage();
if (page === 'register') initRegisterPage();
