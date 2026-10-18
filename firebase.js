// Import the functions you need from the SDKs you need
import { getApp, getApps, initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCD-WrJUhESKLkBwqkvjWm5BcO159oNVSM",
  authDomain: "coustom-chat-app.firebaseapp.com",
  projectId: "coustom-chat-app",
  storageBucket: "coustom-chat-app.firebasestorage.app",
  messagingSenderId: "610388854199",
  appId: "1:610388854199:web:20bf23c0f4a0c222ac9432",
  measurementId: "G-THFNRTZ6NL",
};

// Reuse the existing app instance across hot reloads to avoid
// "Firebase App named '[DEFAULT]' already exists" errors.
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

// Firebase Analytics is browser-only — getAnalytics() throws during server
// rendering, so initialize it on the client and fail softly if unavailable.
function initAnalytics() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return getAnalytics(app);
  } catch (error) {
    console.warn("Firebase Analytics failed to initialize:", error);
    return null;
  }
}

export const analytics = initAnalytics();

export default app;
