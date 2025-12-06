import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Container,
  Title,
  Text,
  Button,
  Stack,
  Paper,
  Group,
  Badge,
  Loader,
  Center,
  Alert,
} from "@mantine/core";
import { Clock, X } from "lucide-react";
import { signOut, onAuthStateChanged, User } from "firebase/auth";
import { auth } from "../config/firebase";
import { fetchUserReservations, cancelReservation } from "../utils/api";
import type { Reservation } from "@full-stack/types";

type ReservationWithTimeSlot = Reservation & {
  timeSlot?: {
    id: string;
    startTime: string | Date | { toDate?: () => Date; seconds?: number };
    endTime: string | Date | { toDate?: () => Date; seconds?: number };
    capacity: number;
    currentBookings: number;
    status: string;
  };
};

const ReservationsPage = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [reservations, setReservations] = useState<ReservationWithTimeSlot[]>(
    []
  );
  const [reservationsLoading, setReservationsLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Listen for auth state changes
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setLoading(false);

      // Redirect to sign in if not authenticated
      if (!currentUser) {
        navigate("/signin");
      } else {
        // Fetch user's reservations
        loadReservations(currentUser.uid);
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  const loadReservations = async (userId: string) => {
    try {
      setReservationsLoading(true);
      setError(null);
      console.log("Loading reservations for userId:", userId);
      const userReservations = await fetchUserReservations(userId);
      console.log("Loaded reservations:", userReservations);
      setReservations(userReservations);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load reservations";
      setError(errorMessage);
      console.error("Error loading reservations:", err);
      // Set empty array on error so UI shows the error message
      setReservations([]);
    } finally {
      setReservationsLoading(false);
    }
  };

  const handleCancelReservation = async (reservationId: string) => {
    if (!user) return;

    if (!confirm("Are you sure you want to cancel this reservation?")) {
      return;
    }

    try {
      setCancellingId(reservationId);
      setError(null);
      await cancelReservation(reservationId, user.uid);
      // Reload reservations after cancellation
      await loadReservations(user.uid);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to cancel reservation"
      );
      console.error("Error cancelling reservation:", err);
    } finally {
      setCancellingId(null);
    }
  };

  const formatTime = (
    timestamp:
      | string
      | Date
      | { toDate?: () => Date; seconds?: number }
      | undefined
  ): string => {
    if (!timestamp) return "N/A";
    let date: Date;
    if (timestamp instanceof Date) {
      date = timestamp;
    } else if (typeof timestamp === "string") {
      date = new Date(timestamp);
    } else if (
      timestamp &&
      typeof timestamp === "object" &&
      "toDate" in timestamp &&
      timestamp.toDate
    ) {
      date = timestamp.toDate();
    } else if (
      timestamp &&
      typeof timestamp === "object" &&
      "seconds" in timestamp &&
      timestamp.seconds
    ) {
      date = new Date(timestamp.seconds * 1000);
    } else {
      return "N/A";
    }
    if (isNaN(date.getTime())) return "N/A";
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  };

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

            {error && (
              <Alert color="red" title="Error" mb="md">
                {error}
              </Alert>
            )}

            {reservationsLoading ? (
              <Center py="xl">
                <Loader />
              </Center>
            ) : reservations.length === 0 ? (
              <Text style={{ color: "#6B5D4F" }}>
                You don't have any active reservations.{" "}
                <Button
                  component="a"
                  href="/time-slots"
                  variant="link"
                  style={{ padding: 0, height: "auto" }}
                >
                  Make a reservation
                </Button>
              </Text>
            ) : (
              <Stack spacing="md">
                {reservations.map((reservation) => (
                  <Paper
                    key={reservation.id}
                    p="md"
                    style={{
                      backgroundColor: "#FAF7F2",
                      border: "1px solid #ECE5E2",
                      borderRadius: "8px",
                    }}
                  >
                    <Group position="apart" align="flex-start">
                      <Stack spacing="xs" style={{ flex: 1 }}>
                        <Group spacing="xs">
                          <Clock size={18} color="#7A5848" />
                          <Text weight={600} style={{ color: "#000000" }}>
                            Reservation #{reservation.id.slice(0, 8)}
                          </Text>
                          <Badge color="green" variant="light">
                            {reservation.status}
                          </Badge>
                        </Group>
                        {reservation.timeSlot ? (
                          <Text size="sm" style={{ color: "#6B5D4F" }}>
                            {formatTime(reservation.timeSlot.startTime)} -{" "}
                            {formatTime(reservation.timeSlot.endTime)}
                          </Text>
                        ) : (
                          <Text size="sm" style={{ color: "#6B5D4F" }}>
                            Slot ID: {reservation.slotId}
                          </Text>
                        )}
                      </Stack>
                      <Button
                        onClick={() => handleCancelReservation(reservation.id)}
                        loading={cancellingId === reservation.id}
                        disabled={cancellingId !== null}
                        color="red"
                        variant="outline"
                        leftIcon={<X size={16} />}
                        sx={{
                          "&:hover": {
                            backgroundColor: "#FFE5E5",
                          },
                        }}
                      >
                        Cancel
                      </Button>
                    </Group>
                  </Paper>
                ))}
              </Stack>
            )}
          </Paper>
        </Stack>
      </Container>
    </div>
  );
};

export default ReservationsPage;
