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
  Alert,
  Table,
  Badge,
  Group,
  Modal,
  TextInput,
  NumberInput,
  ActionIcon,
} from "@mantine/core";
import { Trash2, Plus } from "lucide-react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "../config/firebase";
import { isAdmin } from "../auth";
import { fetchTimeSlots, createTimeSlot, deleteTimeSlot } from "../utils/api";
import type { TimeSlot } from "@full-stack/types";

const AdminPage = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isUserAdmin, setIsUserAdmin] = useState(false);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [newSlotDate, setNewSlotDate] = useState("");
  const [newSlotStartTime, setNewSlotStartTime] = useState("");
  const [newSlotEndTime, setNewSlotEndTime] = useState("");
  const [newSlotCapacity, setNewSlotCapacity] = useState<number>(40);
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
      setError(null);
      const slots = await fetchTimeSlots();
      setTimeSlots(slots);
    } catch (error) {
      console.error("Error loading admin data:", error);
      setError("Failed to load admin data");
    }
  };

  const handleAddTimeSlot = async () => {
    if (!newSlotDate || !newSlotStartTime || !newSlotEndTime) {
      setError("Please fill in all required fields");
      return;
    }

    try {
      setError(null);
      // Combine date and time
      const startDateTime = new Date(`${newSlotDate}T${newSlotStartTime}`);
      const endDateTime = new Date(`${newSlotDate}T${newSlotEndTime}`);

      if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
        setError("Invalid date or time format");
        return;
      }

      await createTimeSlot(
        startDateTime.toISOString(),
        endDateTime.toISOString(),
        newSlotCapacity
      );

      // Reset form and reload data
      setNewSlotDate("");
      setNewSlotStartTime("");
      setNewSlotEndTime("");
      setNewSlotCapacity(40);
      setAddModalOpen(false);
      await loadAdminData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create time slot"
      );
    }
  };

  const handleDeleteTimeSlot = async (slotId: string) => {
    if (
      !confirm(
        "Are you sure you want to delete this time slot? This action cannot be undone."
      )
    ) {
      return;
    }

    try {
      setDeletingId(slotId);
      setError(null);
      await deleteTimeSlot(slotId);
      await loadAdminData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete time slot"
      );
    } finally {
      setDeletingId(null);
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
          You do not have permission to access this page. Only administrators
          can view this content.
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
            <Group position="apart" align="center" mb="md">
              <Title order={2} style={{ color: "#000000" }}>
                Time Slots Overview
              </Title>
              <Button
                leftIcon={<Plus size={16} />}
                onClick={() => setAddModalOpen(true)}
                sx={{
                  backgroundColor: "#000000",
                  color: "#FFFFFF",
                  "&:hover": {
                    backgroundColor: "#333333",
                  },
                }}
              >
                Add Time Slot
              </Button>
            </Group>

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
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {timeSlots.map((slot) => (
                    <tr key={slot.id}>
                      <td>
                        {new Date(slot.startTime).toLocaleString("en-US", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                        {" - "}
                        {new Date(slot.endTime).toLocaleTimeString("en-US", {
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
                      <td>
                        <ActionIcon
                          color="red"
                          variant="light"
                          onClick={() => handleDeleteTimeSlot(slot.id)}
                          loading={deletingId === slot.id}
                          disabled={deletingId !== null}
                        >
                          <Trash2 size={16} />
                        </ActionIcon>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Paper>

          {/* Add Time Slot Modal */}
          <Modal
            opened={addModalOpen}
            onClose={() => {
              setAddModalOpen(false);
              setNewSlotDate("");
              setNewSlotStartTime("");
              setNewSlotEndTime("");
              setNewSlotCapacity(40);
              setError(null);
            }}
            title="Add New Time Slot"
          >
            <Stack spacing="md">
              {error && (
                <Alert color="red" title="Error">
                  {error}
                </Alert>
              )}
              <TextInput
                label="Date"
                type="date"
                value={newSlotDate}
                onChange={(e) => setNewSlotDate(e.target.value)}
                required
              />
              <TextInput
                label="Start Time"
                type="time"
                value={newSlotStartTime}
                onChange={(e) => setNewSlotStartTime(e.target.value)}
                required
              />
              <TextInput
                label="End Time"
                type="time"
                value={newSlotEndTime}
                onChange={(e) => setNewSlotEndTime(e.target.value)}
                required
              />
              <NumberInput
                label="Capacity"
                value={newSlotCapacity}
                onChange={(val) => setNewSlotCapacity(val || 40)}
                min={1}
                max={100}
                required
              />
              <Group position="right" mt="md">
                <Button
                  variant="outline"
                  onClick={() => {
                    setAddModalOpen(false);
                    setNewSlotDate("");
                    setNewSlotStartTime("");
                    setNewSlotEndTime("");
                    setNewSlotCapacity(40);
                    setError(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAddTimeSlot}
                  sx={{
                    backgroundColor: "#000000",
                    color: "#FFFFFF",
                    "&:hover": {
                      backgroundColor: "#333333",
                    },
                  }}
                >
                  Create
                </Button>
              </Group>
            </Stack>
          </Modal>

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
