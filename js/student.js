// ============================================================
// لوحة الطالب / الملف الشخصي (مع رفع صورة) / سجل النتائج
// مصدر البيانات: Firestore فقط — يعمل حسب data-page في <body>.
// ============================================================
import { auth, db, storage, fbAuthNS, fbStoreNS, fbStorageNS } from './firebase-config.js';
import { initLayout, refreshHeaderUser } from './layout.js';
import { requireAuth, getUserDoc, populateGradeSelect, populateCountrySelect, bindCountryGovernorate } from './auth.js';
import { esc, showToast, setBtnLoading, formatNumber, formatDate, emptyStateHTML } from './utils.js';

initLayout();

const { doc, getDoc, updateDoc, collection, query, where, getDocs } = fbStoreNS;
const { updateProfile } = fbAuthNS;
const { ref, uploadBytes, getDownloadURL } = fbStorageNS;

const $id = (id) => document.getElementById(id);
const byNewest = (a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0);

/* ==================== لوحة الطالب ==================== */
async function initDashboard() {
  const user = await requireAuth();
  if (!user) return;
  const userDoc = await getUserDoc(user.uid);
  $id('welcomeName').textContent = userDoc?.name || user.displayName || 'طالبنا';
  await loadDashboardData(user.uid, userDoc);
}

async function loadDashboardData(uid, userDoc) {
  const gradeId = userDoc?.gradeId || null;

  let gradeName = null;
  let totalLessons = 0;
  if (gradeId) {
    try {
      const [gradeSnap, lessonsSnap] = await Promise.all([
        getDoc(doc(db, 'grades', gradeId)),
        getDocs(query(collection(db, 'lessons'), where('gradeId', '==', gradeId), where('isPublished', '==', true))),
      ]);
      if (gradeSnap.exists()) gradeName = gradeSnap.data().name;
      totalLessons = lessonsSnap.size;
    } catch (err) { console.warn('تعذر حساب تقدم الصف:', err.message); }
  }

  let results = [], progress = [];
  try {
    const [resultsSnap, progressSnap] = await Promise.all([
      getDocs(query(collection(db, 'results'), where('userId', '==', uid))),
      getDocs(query(collection(db, 'progress'), where('userId', '==', uid))),
    ]);
    results = resultsSnap.docs.map((d) => ({ id: d.id, ...d.data() })).sort(byNewest);
    progress = progressSnap.docs.map((d) => ({ id: d.id, ...d.data() })).sort(byNewest);
  } catch (err) { console.warn('تعذر تحميل بياناتك:', err.message); }

  const avg = results.length
    ? Math.round(results.reduce((s, r) => s + (Number(r.percent) || 0), 0) / results.length) : null;
  const completedInGrade = gradeId ? progress.filter((p) => p.gradeId === gradeId).length : 0;
  const percent = totalLessons ? Math.round((completedInGrade / totalLessons) * 100) : null;

  $id('statLessons').textContent = formatNumber(progress.length);
  $id('statQuizzes').textContent = formatNumber(results.length);
  $id('statAvg').textContent = avg === null ? '—' : `${avg}%`;
  $id('statProgress').textContent = percent === null ? '—' : `${percent}%`;

  const progressPanel = $id('progressPanel');
  if (!gradeId) {
    progressPanel.innerHTML = `
      <div class="panel-head"><h2>متابعة التعلم</h2></div>
      ${emptyStateHTML('i-cap', 'حدد صفك الدراسي',
        'اختر صفك من ملفك الشخصي لتتبع نسبة تقدمك في الدروس.',
        { action: '<a href="profile.html" class="btn btn-outline btn-sm">تحديد الصف الآن</a>' })}`;
  } else {
    progressPanel.innerHTML = `
      <div class="panel-head"><h2>متابعة التعلم</h2><a href="stages.html">استكشف الدروس</a></div>
      <p class="progress-grade">تقدمك في ${esc(gradeName || 'صفك الدراسي')}</p>
      <div class="progress-row">
        <b class="progress-num">${percent ?? 0}%</b>
        <span class="item-meta">${formatNumber(completedInGrade)} من ${formatNumber(totalLessons)} درس</span>
      </div>
      <div class="progress-track"><span class="progress-fill" style="width:${percent ?? 0}%"></span></div>`;
  }

  $id('recentLessons').innerHTML = progress.length
    ? progress.slice(0, 5).map((p) => `
      <a class="item-row" href="lesson.html?id=${encodeURIComponent(p.lessonId)}">
        <span class="item-icon"><svg class="icon"><use href="#i-book"/></svg></span>
        <span class="item-text"><b>${esc(p.lessonTitle || 'درس')}</b>
          <span class="item-meta">${esc([p.subjectName, p.gradeName].filter(Boolean).join(' · '))}</span>
        </span>
        <span class="item-end">${formatDate(p.completedAt)}</span>
      </a>`).join('')
    : emptyStateHTML('i-book', 'لم تكمل أي درس بعد', 'ابدأ أول درس اليوم وستظهر دروسك المكتملة هنا.');

  $id('recentResults').innerHTML = results.length
    ? results.slice(0, 5).map((r) => `
      <a class="item-row" href="quiz.html?id=${encodeURIComponent(r.quizId)}">
        <span class="item-icon"><svg class="icon"><use href="#i-award"/></svg></span>
        <span class="item-text"><b>${esc(r.quizTitle || 'اختبار')}</b>
          <span class="item-meta">${formatNumber(r.score)} / ${formatNumber(r.total)} · ${formatDate(r.createdAt)}</span>
        </span>
        <span class="item-end"><span class="score-pill ${r.passed ? 'score-pass' : 'score-fail'}">${formatNumber(r.percent)}%</span></span>
      </a>`).join('')
    : emptyStateHTML('i-list-check', 'لم تحل أي اختبار بعد', 'اختبارات صفك ستظهر هنا مع درجاتك فور حلّها.');
}

/* ==================== الملف الشخصي ==================== */

function showAvatar(photoUrl, name) {
  const img = $id('avatarImg'), init = $id('profileInitial');
  if (photoUrl) {
    img.src = photoUrl; img.hidden = false; init.hidden = true;
  } else {
    img.hidden = true; init.hidden = false;
    init.textContent = (name || 'ب').charAt(0);
  }
}

async function initProfile() {
  const user = await requireAuth();
  if (!user) return;

  const userDoc = await getUserDoc(user.uid);
  const name = userDoc?.name || user.displayName || '';
  const email = userDoc?.email || user.email || '';

  $id('profileName').textContent = name || 'بدون اسم';
  $id('profileEmail').textContent = email;
  $id('profileLocation').textContent = userDoc?.governorate
    ? `${userDoc.governorate}${userDoc.city ? ' - ' + userDoc.city : ''}` : '';
  $id('profileSince').textContent = userDoc?.createdAt ? `عضو منذ ${formatDate(userDoc.createdAt)}` : '';
  showAvatar(userDoc?.photoUrl, name);

  const form = $id('profileForm');
  form.elements.name.value = name;
  form.elements.phone.value = userDoc?.phone || '';
  form.elements.city.value = userDoc?.city || '';
  $id('emailField').value = email;
  populateGradeSelect($id('grade'), userDoc?.gradeId || '');
  populateCountrySelect($id('country'), userDoc?.countryCode || 'EG');
  const getGovernorate = bindCountryGovernorate($id('country'), $id('governorate'), $id('governorateText'));
  /* ضبط المحافظة المحفوظة بعد تعبئة القائمة */
  setTimeout(() => {
    if (userDoc?.governorate) {
      const sel = $id('governorate');
      if (!sel.hidden && [...sel.options].some((o) => o.value === userDoc.governorate)) {
        sel.value = userDoc.governorate;
      } else if (!$id('governorateText').hidden) {
        $id('governorateText').value = userDoc.governorate;
      }
    }
  }, 0);

  /* ---- رفع صورة الملف الشخصي ---- */
  $id('avatarBtn').addEventListener('click', () => $id('avatarInput').click());
  $id('avatarInput').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    if (!file.type.startsWith('image/')) { showToast('اختر ملف صورة صحيح', 'error'); return; }
    if (file.size > 2 * 1024 * 1024) { showToast('حجم الصورة يجب أن يكون أقل من 2 ميجابايت', 'error'); return; }

    $id('avatarBtn').disabled = true;
    try {
      const r = ref(storage, `avatars/${user.uid}`);
      await uploadBytes(r, file, { contentType: file.type });
      const url = await getDownloadURL(r);
      await updateDoc(doc(db, 'users', user.uid), { photoUrl: url });
      showAvatar(url, name);
      refreshHeaderUser();
      showToast('تم تحديث صورتك الشخصية');
    } catch (err) {
      console.error('خطأ في رفع الصورة:', err);
      showToast(err?.message || 'تعذر رفع الصورة، حاول مرة أخرى', 'error');
    } finally {
      $id('avatarBtn').disabled = false;
    }
  });

  /* ---- حفظ البيانات ---- */
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newName = form.elements.name.value.trim();
    const newPhone = form.elements.phone.value.trim();
    const newGov = getGovernorate();
    const newCity = form.elements.city.value.trim();
    const newGrade = form.elements.grade.value;

    if (newName.length < 3) { showToast('يرجى إدخال الاسم كاملًا', 'error'); return; }
    if (!/^\d{7,12}$/.test(newPhone)) { showToast('أدخل رقم هاتف صحيح بدون كود الدولة', 'error'); return; }
    if (!newGov) { showToast('يرجى تحديد المحافظة', 'error'); return; }

    const btn = $id('saveBtn');
    setBtnLoading(btn, true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        name: newName,
        phone: newPhone,
        countryCode: form.elements.country.value,
        governorate: newGov,
        city: newCity || null,
        gradeId: newGrade || null,
      });
      if (newName !== user.displayName) {
        await updateProfile(auth.currentUser, { displayName: newName });
      }
      $id('profileName').textContent = newName;
      $id('profileLocation').textContent = `${newGov}${newCity ? ' - ' + newCity : ''}`;
      refreshHeaderUser();
      showToast('تم حفظ التغييرات بنجاح');
    } catch (err) {
      console.error(err);
      showToast('تعذر حفظ التغييرات، حاول مرة أخرى', 'error');
    } finally {
      setBtnLoading(btn, false);
    }
  });
}

/* ==================== سجل النتائج ==================== */
async function initResults() {
  const user = await requireAuth();
  if (!user) return;
  const list = $id('resultsList');
  try {
    const snap = await getDocs(query(collection(db, 'results'), where('userId', '==', user.uid)));
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort(byNewest);
    list.innerHTML = items.length
      ? items.map((r) => `
        <a class="item-row" href="quiz.html?id=${encodeURIComponent(r.quizId)}">
          <span class="item-icon"><svg class="icon"><use href="#i-award"/></svg></span>
          <span class="item-text"><b>${esc(r.quizTitle || 'اختبار')}</b>
            <span class="item-meta">${formatNumber(r.score)} / ${formatNumber(r.total)} · ${formatDate(r.createdAt)}</span>
          </span>
          <span class="item-end"><span class="score-pill ${r.passed ? 'score-pass' : 'score-fail'}">${formatNumber(r.percent)}%</span></span>
        </a>`).join('')
      : emptyStateHTML('i-list-check', 'لا توجد نتائج بعد', 'حل أول اختبار وستظهر نتيجتك هنا فورًا.');
  } catch (err) {
    console.error('خطأ في تحميل النتائج:', err);
    list.innerHTML = emptyStateHTML('i-x-circle', 'تعذر تحميل النتائج',
      'حدث خطأ أثناء الاتصال، حدّث الصفحة لإعادة المحاولة.');
  }
}

/* ---------- التشغيل حسب الصفحة ---------- */
const page = document.body.dataset.page;
if (page === 'dashboard') initDashboard();
if (page === 'profile') initProfile();
if (page === 'results') initResults();
