import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Container, Title, Text, Button, Stack, Paper } from "@mantine/core";
import { signOut, onAuthStateChanged, User } from "firebase/auth";
import { auth } from "../config/firebase";

const ReservationsPage = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Listen for auth state changes
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);

      // Redirect to sign in if not authenticated
      if (!currentUser) {
        navigate("/signin");
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      console.log("User signed out successfully");
      navigate("/signin");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  // Get user's display name or email
  const getUserName = () => {
    if (!user) return "Guest";
    return user.displayName || user.email?.split("@")[0] || "User";
  };

  if (loading) {
    return (
      <div
        style={{
          backgroundColor: "#FFFFFF",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text>Loading...</Text>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect to sign in
  }

  return (
    <div
      style={{
        backgroundColor: "#FFFFFF",
        minHeight: "100vh",
        minWidth: "100vw",
      }}
    >
      <Container size="xl" py={80}>
        <Stack spacing="xl">
          <Paper
            p="lg"
            style={{
              backgroundColor: "#FAF7F2",
              border: "1px solid #ECE5E2",
              borderRadius: "10px",
            }}
          >
            <Stack spacing="md">
              <Title order={1} style={{ color: "#000000" }}>
                Hi {getUserName()}!
              </Title>
              <Text size="lg" style={{ color: "#6B5D4F" }}>
                Welcome to your reservations page
              </Text>
              <Button
                onClick={handleSignOut}
                sx={{
                  backgroundColor: "#000000",
                  color: "#FFFFFF",
                  width: "fit-content",
                  "&:hover": {
                    backgroundColor: "#333333",
                  },
                }}
              >
                Sign Out
              </Button>
            </Stack>
          </Paper>

          <Paper
            p="lg"
            style={{
              backgroundColor: "#FFFFFF",
              border: "1px solid #E8E3D5",
              borderRadius: "10px",
            }}
          >
            <Title order={2} style={{ color: "#000000", marginBottom: "16px" }}>
              My Reservations
            </Title>
            <Text style={{ color: "#6B5D4F" }}>
              Your reservations will appear here.
            </Text>
          </Paper>
        </Stack>
      </Container>
    </div>
  );
};

export default ReservationsPage;
