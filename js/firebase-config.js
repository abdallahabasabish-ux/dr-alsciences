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
  apiKey: 'PASTE-YOUR-API-KEY',
  authDomain: 'PASTE-YOUR-PROJECT.firebaseapp.com',
  projectId: 'PASTE-YOUR-PROJECT',
  storageBucket: 'PASTE-YOUR-PROJECT.appspot.com',
  messagingSenderId: 'PASTE-YOUR-SENDER-ID',
  appId: 'PASTE-YOUR-APP-ID',
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
