// Firebase initialization for CivicPulse.
// NOTE: The Firebase Web `apiKey` is a public identifier (not a secret) — safe to ship to the browser.
// Add your real value as a workspace build secret named VITE_FIREBASE_API_KEY, or replace the fallback
// below with the literal string from your Firebase console.
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? "REPLACE_WITH_FIREBASE_WEB_API_KEY",
  authDomain: "civicpulse-gen-ai-hackathon.firebaseapp.com",
  projectId: "civicpulse-gen-ai-hackathon",
  storageBucket: "civicpulse-gen-ai-hackathon.firebasestorage.app",
  messagingSenderId: "849706255134",
  appId: "1:849706255134:web:5d7914a96f66e64ed1bf0f",
  measurementId: "G-T2L4S3H1JD",
};

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app);
