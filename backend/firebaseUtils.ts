import * as admin from "firebase-admin";
import * as dotenv from "dotenv";
import * as path from "path";
import { readFileSync } from "fs";
import { join } from "path";

dotenv.config();

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  // Clean up PROJECT_ID (remove quotes and spaces)
  const projectId = process.env.PROJECT_ID?.trim().replace(/^["']|["'],?$/g, '');
  
  if (!projectId) {
    throw new Error(
      "PROJECT_ID is not set in environment variables. Please add PROJECT_ID to your .env file."
    );
  }

  // Try service account key from file first
  let serviceAccount;
  try {
    const keyPath = join(__dirname, "serviceAccountKey.json");
    serviceAccount = JSON.parse(readFileSync(keyPath, "utf8"));
    console.log("Loaded service account from serviceAccountKey.json");
  } catch (e) {
    console.warn("Could not load serviceAccountKey.json:", (e as Error).message);
  }

  // Try service account key from env variable
  if (!serviceAccount && process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    try {
      const keyString = process.env.FIREBASE_SERVICE_ACCOUNT_KEY.trim().replace(/^["']|["']$/g, '');
      serviceAccount = JSON.parse(keyString);
    } catch (e) {
      console.warn("Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY from env, trying file path...");
    }
  }
  // Try service account key from file path
  if (!serviceAccount && process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    try {
      const keyPath = path.resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS);
      serviceAccount = require(keyPath);
    } catch (e) {
      console.warn("Failed to load service account from file path");
    }
  }

  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: projectId,
    });
    console.log("Firebase Admin SDK initialized with service account");
  } else {
    // Try using Application Default Credentials
    try {
      admin.initializeApp({
        projectId: projectId,
      });
      console.log("Firebase Admin SDK initialized with Application Default Credentials");
    } catch (error) {
      throw new Error(
        `Firebase Admin SDK initialization failed. Please set FIREBASE_SERVICE_ACCOUNT_KEY in .env or use 'gcloud auth application-default login'. See FIREBASE_SETUP.md for details.`
      );
    }
  }
}

export const db = admin.firestore();