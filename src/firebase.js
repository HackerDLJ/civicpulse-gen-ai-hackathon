// Firebase initialization for CivicPulse.
// The Firebase Web `apiKey` is a public identifier (not a secret) — safe to ship to the browser.
// We resolve it in this order:
//   1. `import.meta.env.VITE_FIREBASE_API_KEY` (set as a workspace build secret)
//   2. The literal fallback below (from the Firebase console) so the client boots
//      even when the env var isn't populated at build time.
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const FIREBASE_API_KEY_FALLBACK = "AIzaSyBsOWU_kjz_IwWNseCtaSVJTvuwCRphtz0";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || FIREBASE_API_KEY_FALLBACK,
  authDomain: "civicpulse-gen-ai-hackathon.firebaseapp.com",
  projectId: "civicpulse-gen-ai-hackathon",
  storageBucket: "civicpulse-gen-ai-hackathon.firebasestorage.app",
  messagingSenderId: "849706255134",
  appId: "1:849706255134:web:5d7914a96f66e64ed1bf0f",
  measurementId: "G-T2L4S3H1JD",
};

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app);
