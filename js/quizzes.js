// ============================================================
// نظام الاختبارات: quiz.html (حل الاختبار) + quizzes.html (القائمة)
// - قراءة الاختبار وأسئلته (subcollection) من Firestore
// - مؤقّت اختياري من durationMinutes مع تسليم تلقائي عند انتهاء الوقت
// - تصحيح تلقائي + نسبة النجاح من passScore في مستند الاختبار
// - حفظ النتيجة في results (مرتبطة بحساب الطالب)
// - مراجعة الإجابات الصحيحة والخاطئة بعد التسليم
// ============================================================
import { db, isConfigured, fbStoreNS } from './firebase-config.js';
import { initLayout } from './layout.js';
import { waitForAuth } from './auth.js';
import {
  esc, showToast, formatNumber, emptyStateHTML, quizCardHTML,
  getQueryParam, setPageMeta, confirmDialog,
} from './utils.js';

initLayout();

const { doc, getDoc, addDoc, collection, getDocs, serverTimestamp } = fbStoreNS;

const qsEl = (sel, root = document) => root.querySelector(sel);
const byOrder = (a, b) => (a.order ?? 9999) - (b.order ?? 9999);
const byNewest = (a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0);
const ARABIC_LETTERS = ['أ', 'ب', 'ج', 'د', 'هـ', 'و'];
const RING_CIRC = 2 * Math.PI * 52; // محيط حلقة النتيجة

/* ---------- حالة الاختبار الجارية ---------- */
let quiz = null;
let questions = [];
let user = null;
let current = 0;
let selected = [];
let timerId = null;
let remainingSeconds = 0;
let submitted = false;

const root = () => qsEl('#quizRoot');

/* ---------- حالات عامة ---------- */
const configEmptyHTML = () => emptyStateHTML(
  'i-info', 'الاختبارات تظهر هنا بعد ربط Firebase',
  'استبدل قيم PASTE- في js/firebase-config.js ببيانات مشروعك ثم أعد المحاولة.'
);
const notFoundHTML = () => emptyStateHTML(
  'i-info', 'لم يتم العثور على الاختبار',
  'قد يكون الرابط قديمًا أو أن الاختبار غير منشور.',
  { action: '<a href="quizzes.html" class="btn btn-outline btn-sm">تصفح الاختبارات</a>' }
);
const errorHTML = () => emptyStateHTML(
  'i-x-circle', 'تعذر تحميل الاختبار',
  'حدث خطأ أثناء الاتصال بقاعدة البيانات. حدّث الصفحة لإعادة المحاولة.'
);

function breadcrumbHTML(items) {
  return items.map((item, i) =>
    item.href && i < items.length - 1
      ? `<a href="${item.href}">${esc(item.text)}</a>`
      : `<span aria-current="page">${esc(item.text)}</span>`
  ).join('<span class="sep" aria-hidden="true">/</span>');
}

const pointsOf = (q) => (Number(q.points) > 0 ? Number(q.points) : 1);
const pointsWord = (p) => (p === 1 ? 'درجة' : p === 2 ? 'درجتان' : 'درجات');

/* ==================== تهيئة صفحة الاختبار ==================== */
async function initQuiz() {
  const id = getQueryParam('id');
  if (!id) { qsEl('#quizTitle').textContent = 'الاختبار غير متاح'; root().innerHTML = notFoundHTML(); return; }
  if (!isConfigured) { qsEl('#quizTitle').textContent = 'الاختبارات'; root().innerHTML = configEmptyHTML(); return; }

  try {
    const quizSnap = await getDoc(doc(db, 'quizzes', id));
    if (!quizSnap.exists() || quizSnap.data().isPublished !== true) {
      qsEl('#quizTitle').textContent = 'الاختبار غير متاح';
      root().innerHTML = notFoundHTML();
      return;
    }
    quiz = { id, ...quizSnap.data() };

    /* أسئلة الاختبار من المجموعة الفرعية */
    const qSnap = await getDocs(collection(db, 'quizzes', id, 'questions'));
    questions = qSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((q) => Array.isArray(q.options) && q.options.length >= 2
        && Number.isInteger(q.correctIndex)
        && q.correctIndex >= 0 && q.correctIndex < q.options.length)
      .sort(byOrder);

    /* الصف والمادة للمسار */
    const [gradeSnap, subjectSnap] = await Promise.all([
      quiz.gradeId ? getDoc(doc(db, 'grades', quiz.gradeId)) : Promise.resolve(null),
      quiz.subjectId ? getDoc(doc(db, 'subjects', quiz.subjectId)) : Promise.resolve(null),
    ]);
    const grade = gradeSnap?.exists() ? { id: gradeSnap.id, ...gradeSnap.data() } : null;
    const subject = subjectSnap?.exists() ? { id: subjectSnap.id, ...subjectSnap.data() } : null;
    let stageName = null;
    if (grade?.stageId) {
      const st = await getDoc(doc(db, 'stages', grade.stageId));
      if (st.exists()) stageName = st.data().name;
    }

    qsEl('#crumbHere').innerHTML = breadcrumbHTML([
      { text: 'الرئيسية', href: 'index.html' },
      { text: 'الاختبارات', href: 'quizzes.html' },
      ...(grade ? [{ text: grade.name, href: `grade.html?id=${grade.id}` }] : []),
      ...(subject ? [{ text: subject.name, href: `subject.html?id=${subject.id}` }] : []),
      { text: quiz.title },
    ]);
    qsEl('#quizTitle').textContent = quiz.title;
    setPageMeta(quiz.title, quiz.description || `اختبار إلكتروني: ${quiz.title}`);

    const totalPoints = questions.reduce((s, q) => s + pointsOf(q), 0);
    qsEl('#quizMeta').innerHTML = [
      `<span class="meta-chip"><b>${formatNumber(questions.length)}</b> سؤال</span>`,
      quiz.durationMinutes ? `<span class="meta-chip"><b>${formatNumber(quiz.durationMinutes)}</b> دقيقة</span>` : '',
      `<span class="meta-chip">النجاح من <b>${formatNumber(quiz.passScore ?? 50)}%</b></span>`,
      `<span class="meta-chip"><b>${formatNumber(totalPoints)}</b> ${pointsWord(totalPoints)}</span>`,
    ].join('');

    if (!questions.length) {
      root().innerHTML = emptyStateHTML('i-list-check', 'هذا الاختبار لا يحتوي أسئلة بعد',
        'ستتمكن من حله فور إضافة الأسئلة من لوحة التحكم.');
      return;
    }
  } catch (err) {
    console.error('خطأ في تحميل الاختبار:', err);
    root().innerHTML = errorHTML();
    return;
  }

  user = await waitForAuth();
  renderIntro();
}

/* ---------- شاشة البداية ---------- */
function renderIntro() {
  root().innerHTML = `
    <div class="quiz-intro panel">
      <span class="stat-icon big"><svg class="icon"><use href="#i-list-check"/></svg></span>
      <h2>${esc(quiz.title)}</h2>
      ${quiz.description ? `<p>${esc(quiz.description)}</p>` : ''}
      <div class="meta-chips center">
        <span class="meta-chip"><b>${formatNumber(questions.length)}</b> سؤال</span>
        ${quiz.durationMinutes ? `<span class="meta-chip"><svg class="icon"><use href="#i-clock"/></svg> <b>${formatNumber(quiz.durationMinutes)}</b> دقيقة</span>` : ''}
        <span class="meta-chip">النجاح من <b>${formatNumber(quiz.passScore ?? 50)}%</b></span>
      </div>
      ${!user
        ? `<div class="form-banner info"><svg class="icon"><use href="#i-info"/></svg>
             <span>يمكنك حل الاختبار الآن، لكن <b>سجّل الدخول</b> ليتم حفظ نتيجتك في سجل نتائجك.</span></div>`
        : ''}
      <button class="btn btn-primary btn-lg" id="startBtn">ابدأ الاختبار</button>
    </div>`;
}

/* ---------- إدارة المؤقّت ---------- */
function renderTimer() {
  const el = qsEl('#timerText');
  if (!el) return;
  const m = String(Math.floor(remainingSeconds / 60)).padStart(2, '0');
  const s = String(remainingSeconds % 60).padStart(2, '0');
  el.textContent = `${m}:${s}`;
  qsEl('#timerChip')?.classList.toggle('warn', remainingSeconds <= 60);
}

function startTimer() {
  stopTimer();
  renderTimer();
  timerId = setInterval(() => {
    remainingSeconds--;
    renderTimer();
    if (remainingSeconds <= 0) finishQuiz(true);
  }, 1000);
}
function stopTimer() { if (timerId) { clearInterval(timerId); timerId = null; } }

/* ---------- بدء المحاولة ---------- */
function startQuiz() {
  current = 0;
  selected = Array(questions.length).fill(null);
  submitted = false;
  if (quiz.durationMinutes > 0) {
    remainingSeconds = quiz.durationMinutes * 60;
    startTimer();
  }
  renderQuestion();
}

/* ---------- شاشة السؤال ---------- */
function renderQuestion() {
  const q = questions[current];
  root().innerHTML = `
    <div class="quiz-toolbar">
      <span class="quiz-progress">السؤال <b>${current + 1}</b> من ${formatNumber(questions.length)}</span>
      ${quiz.durationMinutes
        ? `<span class="timer-chip" id="timerChip"><svg class="icon"><use href="#i-clock"/></svg> <span dir="ltr" id="timerText">00:00</span></span>`
        : ''}
    </div>
    <div class="progress-track" style="height:6px">
      <span class="progress-fill" style="width:${((current + 1) / questions.length) * 100}%"></span>
    </div>
    <div class="qcard">
      <span class="qnum">السؤال ${current + 1} · ${formatNumber(pointsOf(q))} ${pointsWord(pointsOf(q))}</span>
      <h2 class="qtext">${esc(q.text)}</h2>
      <div class="options">
        ${q.options.map((opt, i) => `
          <button type="button" class="option ${selected[current] === i ? 'is-selected' : ''}" data-opt="${i}">
            <span class="opt-key">${ARABIC_LETTERS[i] ?? i + 1}</span>
            <span>${esc(opt)}</span>
          </button>`).join('')}
      </div>
    </div>
    <div class="quiz-nav">
      <button class="btn btn-ghost" id="prevBtn" ${current === 0 ? 'disabled' : ''}>السابق</button>
      ${current < questions.length - 1
        ? '<button class="btn btn-primary" id="nextBtn">التالي</button>'
        : '<button class="btn btn-success" id="finishBtn"><svg class="icon"><use href="#i-check-circle"/></svg> إنهاء الاختبار</button>'}
    </div>`;
  if (quiz.durationMinutes > 0) renderTimer();
}

/* ---------- التصحيح والتسليم ---------- */
async function finishQuiz(auto = false) {
  if (submitted) return;
  submitted = true;
  stopTimer();

  if (!auto) {
    const unanswered = selected.filter((s) => s === null).length;
    const ok = await confirmDialog({
      title: 'إنهاء الاختبار؟',
      message: unanswered
        ? `لديك ${formatNumber(unanswered)} ${unanswered === 1 ? 'سؤال' : 'أسئلة'} بدون إجابة وستُحسب خطأ. هل تريد التسليم؟`
        : 'سيتم تصحيح اختبارك وعرض النتيجة فورًا.',
      confirmText: 'تسليم الاختبار',
    });
    if (!ok) { submitted = false; return; }
  } else {
    showToast('انتهى الوقت! تم تسليم إجاباتك تلقائيًا', 'info');
  }

  /* التصحيح */
  let score = 0;
  const total = questions.reduce((s, q) => s + pointsOf(q), 0);
  questions.forEach((q, i) => { if (selected[i] === q.correctIndex) score += pointsOf(q); });
  const percent = total ? Math.round((score / total) * 100) : 0;
  const passScore = Number.isFinite(Number(quiz.passScore)) ? Number(quiz.passScore) : 50;
  const passed = percent >= passScore;

  /* حفظ النتيجة (الطالب المسجل فقط) */
  let saved = false;
  if (user) {
    try {
      await addDoc(collection(db, 'results'), {
        userId: user.uid,
        quizId: quiz.id,
        quizTitle: quiz.title,
        gradeId: quiz.gradeId ?? null,
        subjectId: quiz.subjectId ?? null,
        score,
        total,
        percent,
        passed,
        answers: questions.map((q, i) => ({ qid: q.id, sel: selected[i], correct: q.correctIndex })),
        createdAt: serverTimestamp(),
      });
      saved = true;
      showToast('تم حفظ نتيجتك في سجل النتائج');
    } catch (err) {
      console.error('خطأ في حفظ النتيجة:', err);
      showToast('تعذر حفظ النتيجة في حسابك', 'error');
    }
  }

  renderResult({ score, total, percent, passScore, passed, saved, auto });
}

/* ---------- شاشة النتيجة + المراجعة ---------- */
function renderResult({ score, total, percent, passScore, passed, saved }) {
  const offset = RING_CIRC * (1 - Math.min(percent, 100) / 100);
  const correctCount = questions.filter((q, i) => selected[i] === q.correctIndex).length;

  const reviewHTML = questions.map((q, i) => {
    const sel = selected[i];
    const isRight = sel === q.correctIndex;
    return `
    <div class="review-item ${isRight ? 'is-right' : 'is-wrong'}">
      <div class="review-q">
        <svg class="icon"><use href="#${isRight ? 'i-check-circle' : sel === null ? 'i-info' : 'i-x-circle'}"/></svg>
        <b>${esc(q.text)}</b>
      </div>
      <div class="options review-options">
        ${q.options.map((opt, oi) => {
          const cls = oi === q.correctIndex ? 'is-correct' : oi === sel ? 'is-wrong' : '';
          const tag = oi === q.correctIndex
            ? '<span class="opt-tag ok">الإجابة الصحيحة</span>'
            : oi === sel ? '<span class="opt-tag bad">إجابتك</span>' : '';
          return `<div class="option as-static ${cls}">
            <span class="opt-key">${ARABIC_LETTERS[oi] ?? oi + 1}</span>
            <span>${esc(opt)}</span>${tag}
          </div>`;
        }).join('')}
      </div>
      ${sel === null ? '<span class="unanswered-note">لم تُجب على هذا السؤال</span>' : ''}
    </div>`;
  }).join('');

  root().innerHTML = `
    <div class="result-hero panel">
      <div class="ring-wrap">
        <svg class="score-ring" viewBox="0 0 120 120" aria-hidden="true">
          <circle class="ring-track" cx="60" cy="60" r="52"/>
          <circle class="ring-fill ${passed ? '' : 'fail'}" cx="60" cy="60" r="52"
                  stroke-dasharray="${RING_CIRC}" stroke-dashoffset="${offset}"/>
        </svg>
        <b class="ring-num">${formatNumber(percent)}%</b>
      </div>
      <h2>نتيجتك: ${formatNumber(score)} / ${formatNumber(total)}</h2>
      <div><span class="score-pill ${passed ? 'score-pass' : 'score-fail'}">${passed ? 'ناجح' : 'لم تُحقق النجاح هذه المرة'}</span></div>
      <p class="result-note">أجبت بشكل صحيح عن ${formatNumber(correctCount)} من ${formatNumber(questions.length)} أسئلة · نسبة النجاح المطلوبة: ${formatNumber(passScore)}%</p>
      ${!user
        ? `<div class="form-banner info"><svg class="icon"><use href="#i-info"/></svg>
             <span>لم تُحفظ هذه النتيجة — <a href="login.html?next=${encodeURIComponent(`quiz.html?id=${quiz.id}`)}"><b>سجّل الدخول</b></a> ليُسجل تقدمك.</span></div>`
        : (!saved
          ? `<div class="form-banner"><svg class="icon"><use href="#i-x-circle"/></svg><span>تعذر حفظ النتيجة، أعد المحاولة في المرة القادمة.</span></div>`
          : '')}
      <div class="hero-actions">
        <button class="btn btn-outline" id="retakeBtn">إعادة المحاولة</button>
        <a class="btn btn-ghost" href="results.html">سجل نتائجي</a>
      </div>
    </div>
    <h2 class="review-title">مراجعة الإجابات</h2>
    ${reviewHTML}`;
}

/* ---------- تفويض أحداث الشاشة ---------- */
function bindQuizEvents() {
  root().addEventListener('click', (e) => {
    if (submitted) {
      if (e.target.closest('#retakeBtn')) startQuiz();
      return;
    }
    const opt = e.target.closest('.option[data-opt]');
    if (opt) {
      selected[current] = Number(opt.dataset.opt);
      root().querySelectorAll('.option').forEach((o) =>
        o.classList.toggle('is-selected', Number(o.dataset.opt) === selected[current]));
      return;
    }
    if (e.target.closest('#startBtn') || e.target.closest('#retakeBtn')) { startQuiz(); return; }
    if (e.target.closest('#prevBtn') && current > 0) { current--; renderQuestion(); return; }
    if (e.target.closest('#nextBtn') && current < questions.length - 1) { current++; renderQuestion(); return; }
    if (e.target.closest('#finishBtn')) finishQuiz(false);
  });
}

/* ==================== صفحة قائمة الاختبارات ==================== */
async function initQuizList() {
  const listRoot = qsEl('#quizListRoot');
  if (!listRoot) return;
  if (!isConfigured) { listRoot.innerHTML = configEmptyHTML(); return; }

  try {
    const [qSnap, gSnap] = await Promise.all([
      getDocs(collection(db, 'quizzes')),
      getDocs(collection(db, 'grades')),
    ]);
    const gradeNames = {};
    gSnap.forEach((d) => { gradeNames[d.id] = d.data().name; });

    const items = qSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((q) => q.isPublished === true)
      .sort(byNewest)
      .map((q) => ({ ...q, gradeName: gradeNames[q.gradeId] ?? null }));

    listRoot.innerHTML = items.length
      ? `<div class="quiz-list">${items.map(quizCardHTML).join('')}</div>`
      : emptyStateHTML('i-list-check', 'لا توجد اختبارات منشورة بعد',
        'ستظهر الاختبارات هنا فور إضافتها من لوحة التحكم.');

    setPageMeta('الاختبارات الإلكترونية',
      'حل اختبارات العلوم الإلكترونية بتصحيح فوري ونتائج فورية لجميع المراحل الدراسية.');
  } catch (err) {
    console.error('خطأ في تحميل الاختبارات:', err);
    listRoot.innerHTML = errorHTML();
  }
}

/* ---------- التشغيل حسب الصفحة ---------- */
const page = document.body.dataset.page;
if (page === 'quiz') { bindQuizEvents(); initQuiz(); }
if (page === 'quizList') initQuizList();
