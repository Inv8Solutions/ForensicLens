// Firebase progress sync (ESM)
// Loads Firebase (v12.3.0), signs in anonymously, and exposes window.ForensicCloud
// Usage: this module attaches a ForensicCloud global with { getUid, saveProgress(state), loadProgress() }

import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js';
import { getAnalytics } from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-analytics.js';
import { getAuth, onAuthStateChanged, signInAnonymously, signInWithCustomToken } from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js';
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

const state = { uid: null, listeners: new Set() };
let __resolveReady;
let pendingProgress = null; // buffer for snapshots saved before auth

// Helper: get custom token from URL if provided (fbct or customToken)
function getTokenFromUrl(){
  try{
    const qs = new URLSearchParams(window.location.search || '');
    return qs.get('fbct') || qs.get('customToken') || null;
  }catch(e){ return null; }
}

// Attempt initial sign-in: prefer custom token if available, else anonymous
async function bootstrapAuth(){
  if(!auth) return false;
  const token = getTokenFromUrl();
  if(token){
    try{ await signInWithCustomToken(auth, token); return true; }
    catch(e){ console.warn('Custom token sign-in failed, falling back to anon', e); }
  }
  try{ await signInAnonymously(auth); return true; }
  catch(e){ console.warn('Anon auth error', e); if (typeof __resolveReady === 'function') __resolveReady(false); return false; }
}

const ready = new Promise((resolve) => {
  __resolveReady = resolve;
  if (!auth) { resolve(false); return; }
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      state.uid = user.uid;
      try{
        // Only auto-restore progress if this is a returning web user (not mobile app)
        const isCustomToken = getTokenFromUrl() !== null;
        let remote = null;
        
        if(!isCustomToken) {
          // Web user - load their existing progress
          try { const ref = doc(db, 'users', state.uid); const snap = await getDoc(ref); remote = snap.exists()? (snap.data()?.progress || null) : null; } catch (_) { /* ignore */ }
        }
        // For mobile app users (custom token), don't auto-restore - let the app decide
        
        // Merge with any pending local snapshot saved before auth
        const merged = pendingProgress ? { ...(remote || {}), ...pendingProgress } : (remote || null);
        
        // Only restore progress automatically for web users
        if(merged && !isCustomToken && window.ForensicFlow && typeof window.ForensicFlow.restore === 'function'){
          window.ForensicFlow.restore(merged);
        }
        
        // If there was pending progress, flush it to Firestore and clear buffer
        if(pendingProgress){
          try{ const ref = doc(db, 'users', state.uid); await setDoc(ref, { progress: merged, updatedAt: serverTimestamp() }, { merge: true }); }catch(_){ /* ignore */ }
          pendingProgress = null;
        }
        // Notify listeners/subscribers
        try{ window.dispatchEvent(new CustomEvent('forensic-auth', { detail: { uid: user.uid, isCustomToken } })); }catch(_){}
        try{ if(merged && !isCustomToken) window.dispatchEvent(new CustomEvent('forensic-progress-restored', { detail: { uid: user.uid, progress: merged } })); }catch(_){ }
      }catch(e){ /* ignore */ }
      resolve(true);
    }
  });
  // kick off first sign-in attempt
  bootstrapAuth().catch(()=>{ try{ __resolveReady && __resolveReady(false); }catch(_){ } });
  // Safety: if nothing happens within 3 seconds, resolve false to allow UI to proceed
  setTimeout(()=>{ try{ __resolveReady && __resolveReady(false); }catch(_){ } }, 3000);
});

async function saveProgress(progress) {
  try {
    const ok = await ready;
    if(!ok || !db || !state.uid){
      // Buffer for later flush after custom-token sign-in
      pendingProgress = { ...(pendingProgress || {}), ...(progress || {}) };
      return false;
    }
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

async function clearProgress() {
  try {
    // Clear local storage
    if(window.ForensicFlow && typeof window.ForensicFlow.snapshot === 'function') {
      const keys = Object.keys(window.ForensicFlow.snapshot());
      keys.forEach(key => {
        try { localStorage.removeItem(key); } catch(_) {}
      });
    }
    
    // Clear Firebase if authenticated
    const ok = await ready; 
    if(ok && db && state.uid) {
      const ref = doc(db, 'users', state.uid);
      await setDoc(ref, { 
        progress: {}, 
        updatedAt: serverTimestamp(),
        clearedAt: serverTimestamp() 
      }, { merge: true });
    }
    
    // Refresh the page to reset UI state
    window.location.reload();
    return true;
  } catch (e) {
    console.warn('clearProgress failed', e); 
    return false;
  }
}

async function forceLoadProgress() {
  try {
    const progress = await loadProgress();
    if(progress && window.ForensicFlow && typeof window.ForensicFlow.restore === 'function') {
      window.ForensicFlow.restore(progress);
      // Trigger UI update
      try{ window.dispatchEvent(new CustomEvent('forensic-progress-restored', { detail: { uid: state.uid, progress } })); }catch(_){ }
      return true;
    }
    return false;
  } catch (e) {
    console.warn('forceLoadProgress failed', e); 
    return false;
  }
}

window.ForensicCloud = {
  getUid: () => state.uid,
  saveProgress,
  loadProgress,
  clearProgress,
  forceLoadProgress,
  // Sign in with a Firebase custom token provided by native app
  signInWithCustomToken: async (token) => {
    try {
      if(!auth) return false;
      await signInWithCustomToken(auth, token);
      return true;
    } catch (e) {
      console.warn('signInWithCustomToken failed', e); return false;
    }
  },
  // Subscribe to auth changes (simple callback registry)
  onAuth: (fn) => { if(typeof fn==='function') state.listeners.add(fn); return () => state.listeners.delete(fn); },
  _ready: ready
};

// Also accept custom token and commands via postMessage from Android WebView
try{
  window.addEventListener('message', async (evt)=>{
    try{
      const data = evt?.data;
      if(!data || typeof data !== 'object') return;
      
      // Handle custom token for authentication
      if(data.type === 'FORNS_CLD_CUSTOM_TOKEN' || data.type === 'FIREBASE_CUSTOM_TOKEN'){
        const token = data.token;
        if(token){ await window.ForensicCloud.signInWithCustomToken(token); }
      }
      
      // Handle progress management commands from mobile app
      else if(data.type === 'FORNS_CLEAR_PROGRESS') {
        await window.ForensicCloud.clearProgress();
      }
      
      else if(data.type === 'FORNS_LOAD_PROGRESS') {
        await window.ForensicCloud.forceLoadProgress();
      }
      
      else if(data.type === 'FORNS_RESET_NEW_USER') {
        // Special command for mobile app to reset everything for a new user
        await window.ForensicCloud.clearProgress();
      }
      
    }catch(e){ console.warn('Message handler error:', e); }
  });
}catch(e){ /* ignore */ }
