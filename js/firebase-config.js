// ============================================================
// إعداد Firebase — منصة «الدكتور في العلوم»
// استبدل قيم PASTE- ببيانات مشروعك من Firebase Console.
// حتى ذلك الحين يعمل الموقع في «وضع العرض» بدون قاعدة بيانات.
// ============================================================
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import * as fbAuthNS from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import * as fbStoreNS from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';
import * as fbStorageNS from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js';

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
let storage = null;

if (isConfigured) {
  const app = initializeApp(firebaseConfig);
  auth = fbAuthNS.getAuth(app);
  db = fbStoreNS.getFirestore(app);
  storage = fbStorageNS.getStorage(app);
} else {
  console.warn(
    '[الدكتور في العلوم] Firebase غير مربوط بعد. ' +
    'استبدل قيم PASTE- في js/firebase-config.js ببيانات مشروعك.'
  );
}

export { firebaseConfig, isConfigured, auth, db, storage, fbAuthNS, fbStoreNS, fbStorageNS };
