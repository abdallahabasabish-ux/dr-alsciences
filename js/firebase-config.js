// ============================================================
// إعداد Firebase — منصة «الدكتور في العلوم»
// خطوات الربط:
//   1) أنشئ مشروعًا على https://console.firebase.google.com
//   2) Project Settings → Your apps → أضف تطبيق ويب (</>) وانسخ القيم أدناه
//   3) Authentication → Sign-in method → فعّل Email/Password
//   4) Firestore Database → Create database
// حتى تستبدل قيم PASTE- يعمل الموقع في «وضع العرض» بدون قاعدة بيانات.
// ملاحظة أمان: هذه القيم ليست سرية بذاتها، لكن الحماية الحقيقية تتم
// عبر Firestore Security Rules (تُسلّم في المرحلة 13) — لا تضع مفاتيح
// خدمة (Service Account) في كود الواجهة أبدًا.
// ============================================================
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import * as fbAuthNS from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import * as fbStoreNS from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyDS8rJsB1PgB3oxJ6X2XU2WcI0TpO8bryk',
  authDomain: 'master-prompt-5cb85.firebaseapp.com',
  projectId: 'master-prompt-5cb85',
  storageBucket: 'master-prompt-5cb85.firebasestorage.app',
  messagingSenderId: '111755994926',
  appId: '1:111755994926:web:055b776f8b49501d7d7cbf',
};

const isConfigured = !Object.values(firebaseConfig).some(v => String(v).startsWith('PASTE-'));

let auth = null;
let db = null;

if (isConfigured) {
  const app = initializeApp(firebaseConfig);
  auth = fbAuthNS.getAuth(app);
  db = fbStoreNS.getFirestore(app);
} else {
  console.warn(
    '[الدكتور في العلوم] Firebase غير مربوط بعد. ' +
    'استبدل قيم PASTE- في js/firebase-config.js ببيانات مشروعك.'
  );
}

export { firebaseConfig, isConfigured, auth, db, fbAuthNS, fbStoreNS };
