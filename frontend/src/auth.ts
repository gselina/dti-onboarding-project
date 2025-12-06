import { User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { db } from "./config/firebase";

/**
 * Checks if the current user has admin role
 * Uses the authenticated user's UID to look up their role in Firestore
 * 
 * @param user - Firebase Auth user object (from onAuthStateChanged)
 * @returns Promise<boolean> - true if user is admin, false otherwise
 */
export async function isAdmin(user: User | null): Promise<boolean> {
  // First check: user must be authenticated
  if (!user) return false;
  
  try {
    // Look up user document in Firestore using their UID from Firebase Auth
    const userDoc = await getDoc(doc(db, "users", user.uid));
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      // Check if role field is set to "admin"
      return userData.role === "admin";
    }
    
    // If no user document exists, default to not admin
    return false;
  } catch (error) {
    console.error("Error checking admin status:", error);
    return false;
  }
}

/**
 * Gets the user's role from Firestore
 * 
 * @param user - Firebase Auth user object
 * @returns Promise<"admin" | "user" | null> - User's role or null if error
 */
export async function getUserRole(user: User | null): Promise<"admin" | "user" | null> {
  if (!user) return null;
  
  try {
    const userDoc = await getDoc(doc(db, "users", user.uid));
    if (userDoc.exists()) {
      return userDoc.data().role || "user";
    }
    return "user"; // Default role
  } catch (error) {
    console.error("Error getting user role:", error);
    return null;
  }
}