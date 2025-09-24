// Firebase progress sync (ESM)
// Loads Firebase (v12.3.0), signs in anonymously, and exposes window.ForensicCloud
// Usage: this module attaches a ForensicCloud global with { getUid, saveProgress(state), loadProgress() }

import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js';
import { getAnalytics } from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-analytics.js';
import { getAuth, onAuthStateChanged, signInAnonymously } from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyA88DkCUQk-IOztsCD4h2iBgf85sHpxA9s',
  authDomain: 'forensiclens-8f082.firebaseapp.com',
  projectId: 'forensiclens-8f082',
  storageBucket: 'forensiclens-8f082.firebasestorage.app',
  messagingSenderId: '270323881158',
  appId: '1:270323881158:web:3ed9616501400cfaefb3c7',
  measurementId: 'G-WXGXJL4RB7'
};

let app, analytics, auth, db;
try {
  app = initializeApp(firebaseConfig);
  try { analytics = getAnalytics(app); } catch (e) { /* analytics optional in some environments */ }
  auth = getAuth(app);
  db = getFirestore(app);
} catch (e) {
  console.warn('Firebase init failed', e);
}

const state = { uid: null };
const ready = new Promise((resolve) => {
  if (!auth) { resolve(false); return; }
  onAuthStateChanged(auth, (user) => {
    if (user) {
      state.uid = user.uid;
      resolve(true);
    }
  });
  // Kick off anonymous auth if not signed in
  signInAnonymously(auth).catch((e) => console.warn('Anon auth error', e));
});

async function saveProgress(progress) {
  try {
    const ok = await ready; if (!ok || !db || !state.uid) return false;
    const ref = doc(db, 'users', state.uid);
    const payload = {
      progress: progress || {},
      updatedAt: serverTimestamp()
    };
    await setDoc(ref, payload, { merge: true });
    return true;
  } catch (e) {
    console.warn('saveProgress failed', e); return false;
  }
}

async function loadProgress() {
  try {
    const ok = await ready; if (!ok || !db || !state.uid) return null;
    const ref = doc(db, 'users', state.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const data = snap.data();
    return (data && data.progress) ? data.progress : null;
  } catch (e) {
    console.warn('loadProgress failed', e); return null;
  }
}

window.ForensicCloud = {
  getUid: () => state.uid,
  saveProgress,
  loadProgress,
  _ready: ready
};
