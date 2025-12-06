import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Container,
  Paper,
  Button,
  Title,
  Text,
  Stack,
  Alert,
} from "@mantine/core";
import {
  signInWithPopup,
  GoogleAuthProvider,
  getAdditionalUserInfo,
} from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore"; // ADD THIS
import { auth, db } from "../config/firebase"; // UPDATE: Add db import

const SignInPage = () => {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleGoogleSignIn = async () => {
    setError(null);
    setLoading(true);

    try {
      // Create an instance of the Google provider object
      const provider = new GoogleAuthProvider();

      // Sign in with popup (for web apps)
      const result = await signInWithPopup(auth, provider);

      // This gives you a Google Access Token. You can use it to access the Google API.
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const token = credential?.accessToken;

      // The signed-in user info
      const user = result.user;

      // IdP data available using getAdditionalUserInfo(result)
      const additionalUserInfo = getAdditionalUserInfo(result);

      console.log("User signed in with Google successfully:", user);
      console.log("Google Access Token:", token);
      console.log("Additional user info:", additionalUserInfo);

      // Define admin email whitelist - UPDATE THIS WITH YOUR ADMIN EMAILS
      const ADMIN_EMAILS = [
        "ei83@cornell.edu",
        "sg2626@cornell.edu",
        // Add more admin emails here
      ];

      // Optional: Use email domain for all staff emails
      // Uncomment if you want all @university.edu emails to be admins
      // const ADMIN_EMAIL_DOMAIN = "@university.edu";

      const userEmail = user.email || "";

      // Check if user is in admin whitelist
      const isAdminEmail = ADMIN_EMAILS.some(
        (email) => userEmail.toLowerCase() === email.toLowerCase()
      );
      const isAdmin = isAdminEmail;
      // Create or update user document in Firestore with role
      await setDoc(
        doc(db, "users", user.uid),
        {
          email: user.email,
          displayName: user.displayName,
          role: isAdmin ? "admin" : "user", // Auto-assign role
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      ); // merge: true prevents overwriting existing data

      console.log(
        `User ${user.email} assigned role: ${isAdmin ? "admin" : "user"}`
      );

      // Redirect to home page after successful authentication
      navigate("/");
    } catch (err) {
      console.error("Authentication error:", err);

      // Handle Errors here
      const error = err as { code?: string; message?: string };
      const errorCode = error.code;
      const errorMessage = error.message;

      // Handle account-exists-with-different-credential errors
      if (errorCode === "auth/account-exists-with-different-credential") {
        setError(
          "An account already exists with the same email address but different sign-in credentials."
        );
      } else if (errorCode === "auth/popup-closed-by-user") {
        setError("Sign-in popup was closed. Please try again.");
      } else {
        setError(
          errorMessage ||
            "An error occurred during authentication. Please try again."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        backgroundColor: "#FFFFFF",
        maxHeight: "100vh",
        minWidth: "100vw",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Container size={420} my={40}>
        <Stack spacing="md">
          <Title
            order={2}
            align="center"
            style={{ color: "#000000", fontWeight: 700 }}
          >
            Sign In to BearBox
          </Title>
          <Text size="sm" align="center" style={{ color: "#6B5D4F" }}>
            Sign in with your Google account to access your packages and
            reservations
          </Text>

          <Paper
            withBorder
            shadow="md"
            p={30}
            radius="md"
            style={{ backgroundColor: "#FFFFFF" }}
          >
            <Stack spacing="md">
              {error && (
                <Alert color="red" title="Error">
                  {error}
                </Alert>
              )}

              <Button
                onClick={handleGoogleSignIn}
                fullWidth
                loading={loading}
                size="lg"
                sx={{
                  backgroundColor: "#FFFFFF",
                  color: "#000000",
                  border: "1px solid #E8E3D5",
                  "&:hover": {
                    backgroundColor: "#FAF7F2",
                  },
                }}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  style={{ marginRight: "12px" }}
                >
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Sign in with Google
              </Button>
            </Stack>
          </Paper>
        </Stack>
      </Container>
    </div>
  );
};

export default SignInPage;
