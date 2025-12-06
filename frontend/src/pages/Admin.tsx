import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Container,
  Title,
  Text,
  Stack,
  Paper,
  Button,
  Loader,
  Center,
  Alert,
  Table,
  Badge,
  Group,
} from "@mantine/core";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "../config/firebase";
import { isAdmin } from "../auth";
import { fetchTimeSlots } from "../utils/api";
import type { TimeSlot } from "@full-stack/types";

const AdminPage = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isUserAdmin, setIsUserAdmin] = useState(false);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Same pattern as Reservations.tsx and TimeSlots.tsx
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      // STEP 1: AUTHENTICATION CHECK (same as your existing pages)
      if (!currentUser) {
        navigate("/signin");
        return;
      }

      // STEP 2: AUTHORIZATION CHECK (new - checks if user is admin)
      try {
        const adminStatus = await isAdmin(currentUser);
        setIsUserAdmin(adminStatus);
        
        if (!adminStatus) {
          // Redirect non-admins to home page
          navigate("/");
          return;
        }

        // STEP 3: Load admin data (only if authenticated AND authorized)
        await loadAdminData();
        setLoading(false);
      } catch (err) {
        console.error("Error checking admin status:", err);
        setError("Failed to verify admin access");
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  const loadAdminData = async () => {
    try {
      const slots = await fetchTimeSlots();
      setTimeSlots(slots);
    } catch (error) {
      console.error("Error loading admin data:", error);
      setError("Failed to load admin data");
    }
  };

  // Show loading state while checking auth/authorization
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
        <Loader size="lg" />
      </div>
    );
  }

  // Show error or access denied
  if (!isUserAdmin) {
    return (
      <Container size="xl" py={80}>
        <Alert color="red" title="Access Denied">
          You do not have permission to access this page. Only administrators can view this content.
        </Alert>
      </Container>
    );
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
          {/* Header */}
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
                Admin Dashboard
              </Title>
              <Text size="lg" style={{ color: "#6B5D4F" }}>
                Manage time slots, reservations, and system settings
              </Text>
              <Text size="sm" style={{ color: "#6B5D4F" }}>
                Logged in as: {user?.email}
              </Text>
            </Stack>
          </Paper>

          {error && (
            <Alert color="red" title="Error">
              {error}
            </Alert>
          )}

          {/* Time Slots Overview */}
          <Paper
            p="lg"
            style={{
              backgroundColor: "#FFFFFF",
              border: "1px solid #E8E3D5",
              borderRadius: "10px",
            }}
          >
            <Title order={2} style={{ color: "#000000", marginBottom: "24px" }}>
              Time Slots Overview
            </Title>
            
            {timeSlots.length === 0 ? (
              <Text color="dimmed">No time slots found</Text>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Capacity</th>
                    <th>Bookings</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {timeSlots.slice(0, 20).map((slot) => (
                    <tr key={slot.id}>
                      <td>
                        {new Date(slot.startTime).toLocaleString("en-US", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </td>
                      <td>{slot.capacity}</td>
                      <td>
                        <Text weight={500}>
                          {slot.currentBookings} / {slot.capacity}
                        </Text>
                      </td>
                      <td>
                        <Badge
                          color={
                            slot.status === "full"
                              ? "red"
                              : slot.status === "busy"
                              ? "yellow"
                              : "green"
                          }
                        >
                          {slot.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Paper>

          {/* Add more admin features here:
              - User management
              - Reservation management
              - System settings
              - Analytics
          */}
        </Stack>
      </Container>
    </div>
  );
};

export default AdminPage;