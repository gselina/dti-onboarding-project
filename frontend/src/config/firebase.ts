import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore"; // ADD THIS IMPORT

// Firebase configuration
// Note: Vite requires VITE_ prefix for environment variables to be accessible in frontend
// Add these to your frontend/.env file with VITE_ prefix:
// VITE_FIREBASE_API_KEY, VITE_AUTH_DOMAIN, VITE_PROJECT_ID, VITE_STORAGE_BUCKET, VITE_MESSAGING_SENDER_ID, VITE_APP_ID
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_AUTH_DOMAIN || "",
  projectId: import.meta.env.VITE_PROJECT_ID || "",
  storageBucket: import.meta.env.VITE_STORAGE_BUCKET || "",
  messagingSenderId: import.meta.env.VITE_MESSAGING_SENDER_ID || "",
  appId: import.meta.env.VITE_APP_ID || "",
};

// Debug: Log config (without sensitive data)
if (!firebaseConfig.apiKey) {
  console.error("Firebase API Key is missing! Check your .env file for VITE_FIREBASE_API_KEY");
  console.log("Available env vars:", Object.keys(import.meta.env).filter(key => key.startsWith('VITE_')));
}

// Validate required fields
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  throw new Error(
    "Firebase configuration is incomplete. Please check your .env file and ensure VITE_FIREBASE_API_KEY and VITE_PROJECT_ID are set."
  );
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

// ADD THIS: Export Firestore instance for role checking
export const db = getFirestore(app);

export default app;