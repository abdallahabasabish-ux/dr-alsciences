// ============================================================
// المصادقة: تسجيل/دخول/حماية الصفحات + بيانات الموقع (دولة/محافظة/مدينة)
// ============================================================
import { auth, db, isConfigured, fbAuthNS, fbStoreNS } from './firebase-config.js';
import { injectIcons, mapAuthError, showToast, setBtnLoading } from './utils.js';

injectIcons();

const {
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  updateProfile, signOut, onAuthStateChanged,
} = fbAuthNS;
const { doc, setDoc, getDoc, getDocs, collection, serverTimestamp } = fbStoreNS;

/* ================= بيانات الدول والمحافظات ================= */
export const COUNTRIES = [
  { code: 'EG', dial: '+20', name: 'مصر' }, { code: 'SA', dial: '+966', name: 'السعودية' },
  { code: 'AE', dial: '+971', name: 'الإمارات' }, { code: 'KW', dial: '+965', name: 'الكويت' },
  { code: 'QA', dial: '+974', name: 'قطر' }, { code: 'BH', dial: '+973', name: 'البحرين' },
  { code: 'OM', dial: '+968', name: 'عُمان' }, { code: 'JO', dial: '+962', name: 'الأردن' },
  { code: 'PS', dial: '+970', name: 'فلسطين' }, { code: 'LB', dial: '+961', name: 'لبنان' },
  { code: 'SY', dial: '+963', name: 'سوريا' }, { code: 'IQ', dial: '+964', name: 'العراق' },
  { code: 'YE', dial: '+967', name: 'اليمن' }, { code: 'LY', dial: '+218', name: 'ليبيا' },
  { code: 'SD', dial: '+249', name: 'السودان' }, { code: 'TN', dial: '+216', name: 'تونس' },
  { code: 'DZ', dial: '+213', name: 'الجزائر' }, { code: 'MA', dial: '+212', name: 'المغرب' },
  { code: 'MR', dial: '+222', name: 'موريتانيا' }, { code: 'SO', dial: '+252', name: 'الصومال' },
  { code: 'DJ', dial: '+253', name: 'جيبوتي' }, { code: 'KM', dial: '+269', name: 'جزر القمر' },
];
const GOVS = {
  EG: ['القاهرة','الجيزة','الإسكندرية','القليوبية','بورسعيد','السويس','الإسماعيلية','المنوفية','الدقهلية','الشرقية','الغربية','كفر الشيخ','دمياط','البحيرة','الفيوم','بني سويف','المنيا','أسيوط','سوهاج','قنا','الأقصر','أسوان','البحر الأحمر','مطروح','شمال سيناء','جنوب سيناء','الوادي الجديد'],
  SA: ['الرياض','مكة المكرمة','المدينة المنورة','القصيم','الشرقية','عسير','تبوك','حائل','نجران','جازان','الباحة','الحدود الشمالية','الجوف'],
};

export function populateCountrySelect(sel, selected = 'EG') {
  if (!sel) return;
  sel.innerHTML = COUNTRIES.map((c) =>
    `<option value="${c.code}"${c.code === selected ? ' selected' : ''}>${c.name} (${c.dial})</option>`).join('');
}

/** يربط كود الدولة بقائمة المحافظات — الدول بدون قائمة تتحول لحقل نصي */
export function bindCountryGovernorate(countrySel, govSel, govText) {
  if (!countrySel || !govSel || !govText) return () => '';
  const sync = () => {
    const list = GOVS[countrySel.value];
    if (list) {
      govSel.hidden = false; govText.hidden = true;
      govSel.innerHTML = '<option value="">— اختر المحافظة —</option>'
        + list.map((g) => `<option>${g}</option>`).join('');
    } else {
      govSel.hidden = true; govText.hidden = false; govText.value = '';
    }
  };
  countrySel.addEventListener('change', sync);
  sync();
  return () => (govSel.hidden ? govText.value.trim() : govSel.value);
}

/* ================= أدوات أساسية ================= */
export function waitForAuth() {
  if (!auth) return Promise.resolve(null);
  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (user) => { unsub(); resolve(user); });
  });
}

export async function getUserDoc(uid) {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    return snap.exists() ? snap.data() : null;
  } catch (err) {
    console.warn('تعذر قراءة بيانات الحساب:', err.message);
    return null;
  }
}

export async function getUserRole(user) {
  try {
    const token = await user.getIdTokenResult();
    if (token.claims.admin === true) return 'admin';
  } catch { /* لا توجد claims */ }
  const userDoc = await getUserDoc(user.uid);
  return userDoc?.role === 'admin' ? 'admin' : 'student';
}

export async function homeFor(user) {
  return (await getUserRole(user)) === 'admin' ? 'admin/index.html' : 'student-dashboard.html';
}

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

export async function redirectIfAuthenticated() {
  if (!isConfigured) return;
  const user = await waitForAuth();
  if (user) location.replace(await homeFor(user));
}

/* ================= العمليات ================= */
export async function registerUser({ name, phone, countryCode, governorate, city, email, password, gradeId = '' }) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName: name });
  await setDoc(doc(db, 'users', cred.user.uid), {
    name, phone, countryCode, governorate, city: city || null,
    email, role: 'student', gradeId: gradeId || null,
    photoUrl: null, isBlocked: false,
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
export async function populateGradeSelect(selectEl, selectedId = '') {
  if (!isConfigured || !selectEl) return;
  try {
    const snap = await getDocs(collection(db, 'grades'));
    const grades = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      .filter((g) => g.isPublished !== false).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    grades.forEach((g) => selectEl.add(new Option(g.name, g.id)));
    if (selectedId) selectEl.value = selectedId;
  } catch (err) { console.warn('تعذر تحميل الصفوف:', err.message); }
}

/* ================= صفحة الدخول ================= */
function safeNextParam() {
  const next = new URLSearchParams(location.search).get('next');
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

/* ================= صفحة التسجيل ================= */
async function initRegisterPage() {
  redirectIfAuthenticated();
  bindPasswordToggle('togglePassword', 'password');
  populateGradeSelect(document.getElementById('grade'));
  populateCountrySelect(document.getElementById('country'));
  const getGovernorate = bindCountryGovernorate(
    document.getElementById('country'),
    document.getElementById('governorate'),
    document.getElementById('governorateText'),
  );
  if (!isConfigured) showBanner(CONFIG_MSG, 'info');

  const form = document.getElementById('registerForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearFieldErrors(form);
    const name = form.elements.name.value.trim();
    const countryCode = form.elements.country.value;
    const phone = form.elements.phone.value.trim();
    const governorate = getGovernorate();
    const city = form.elements.city.value.trim();
    const email = form.elements.email.value.trim();
    const password = form.elements.password.value;
    const confirm = form.elements.confirm.value;
    const gradeId = form.elements.grade.value;

    let valid = true;
    if (name.length < 3) { setFieldError(form.elements.name, 'يرجى إدخال الاسم كاملًا (3 أحرف على الأقل).'); valid = false; }
    if (!/^\d{7,12}$/.test(phone)) { setFieldError(form.elements.phone, 'أدخل رقم الهاتف بدون كود الدولة (7-12 رقمًا).'); valid = false; }
    if (!governorate) { setFieldError(form.elements.governorateText || form.elements.governorate, 'يرجى تحديد المحافظة.'); valid = false; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setFieldError(form.elements.email, 'صيغة البريد الإلكتروني غير صحيحة.'); valid = false; }
    if (password.length < 6) { setFieldError(form.elements.password, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل.'); valid = false; }
    if (password !== confirm) { setFieldError(form.elements.confirm, 'كلمتا المرور غير متطابقتين.'); valid = false; }
    if (!valid) return;
    if (!isConfigured) { showBanner(CONFIG_MSG, 'info'); return; }

    const btn = document.getElementById('registerBtn');
    setBtnLoading(btn, true);
    try {
      await registerUser({ name, phone, countryCode, governorate, city, email, password, gradeId });
      showToast('تم إنشاء حسابك بنجاح، أهلًا بك!');
      location.replace('student-dashboard.html');
    } catch (err) {
      showBanner(mapAuthError(err));
    } finally {
      setBtnLoading(btn, false);
    }
  });
}

const page = document.body.dataset.page;
if (page === 'login') initLoginPage();
if (page === 'register') initRegisterPage();
