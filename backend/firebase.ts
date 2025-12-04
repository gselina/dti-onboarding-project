// backend/firebase.ts

import * as dotenv from "dotenv";
import * as admin from "firebase-admin";
import { readFileSync } from "fs";
import { join } from "path";

// Load environment variables
dotenv.config();

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  try {
    // Load service account key
    const serviceAccountPath = join(__dirname, "serviceAccountKey.json");
    const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, "utf8"));
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    
    console.log("Firebase Admin initialized successfully");
  } catch (error) {
    console.error("Error initializing Firebase Admin:", error);
    throw error;
  }
}

// Export Firestore instance (bypasses security rules)
export const db = admin.firestore();