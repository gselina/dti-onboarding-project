// frontend/src/pages/TimeSlots.tsx

import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Container,
  Card,
  Text,
  Button,
  Badge,
  Group,
  Stack,
  Loader,
  Center,
  Alert,
  Modal,
  Tabs,
  ScrollArea,
} from "@mantine/core";
import { Clock, Users, CheckCircle, X } from "lucide-react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "../config/firebase";
import {
  fetchTimeSlots,
  createReservation,
  fetchUserReservations,
  cancelReservation,
} from "../utils/api";
import type { TimeSlot, Reservation } from "@full-stack/types";
import "./TimeSlots.css"; // For your Figma CSS

const TimeSlots = () => {
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [userReservations, setUserReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bookingSlotId, setBookingSlotId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [success, setSuccess] = useState(false);
  const [activeDay, setActiveDay] = useState(0); // 0 = today, 1 = tomorrow, 2 = day after
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Listen for auth state changes
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
      if (!currentUser) {
        navigate("/signin");
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  const userId = user?.uid || "";
  const userName = user?.displayName || user?.email?.split("@")[0] || "User";

  useEffect(() => {
    if (user) {
      loadTimeSlots();
      loadUserReservations();
      // Refresh every 30 seconds
      const interval = setInterval(() => {
        loadTimeSlots();
        loadUserReservations();
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const loadUserReservations = async () => {
    if (!user?.uid) return;
    try {
      const reservations = await fetchUserReservations(user.uid);
      setUserReservations(reservations);
    } catch (err) {
      console.error("Error loading user reservations:", err);
    }
  };

  const loadTimeSlots = async () => {
    try {
      setLoading(true);
      setError(null);
      const slots = await fetchTimeSlots();

      console.log("=== TIME SLOTS DEBUG ===");
      console.log("Total slots fetched:", slots.length);
      console.log("Raw slots data:", slots);

      if (slots.length > 0) {
        console.log("\n--- First 3 slots details ---");
        slots.slice(0, 3).forEach((slot, index) => {
          console.log(`Slot ${index + 1}:`, {
            id: slot.id,
            startTime: slot.startTime,
            startTimeType: typeof slot.startTime,
            hasToDate: typeof slot.startTime?.toDate === "function",
            convertedDate: slot.startTime?.toDate
              ? slot.startTime.toDate()
              : new Date(slot.startTime),
            dateString: slot.startTime?.toDate
              ? slot.startTime.toDate().toLocaleDateString()
              : new Date(slot.startTime).toLocaleDateString(),
          });
        });
      }

      setTimeSlots(slots);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load time slots"
      );
    } finally {
      setLoading(false);
    }
  };

  // Group time slots by day
  const slotsByDay = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Explicit debugging for date calculation
    console.log("\n=== DATE GROUPING DEBUG ===");
    console.log("Today (normalized):", today.toISOString());
    console.log("Today (readable):", today.toLocaleDateString());

    const days: { date: Date; slots: TimeSlot[] }[] = [];

    // Create 3 days: today, tomorrow, day after
    for (let i = 0; i < 3; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      days.push({ date, slots: [] });
    }

    // Group slots by day
    // Group slots by day
    console.log("\n--- Matching slots to days ---");
    let matchedCount = 0;
    let unmatchedCount = 0;
    timeSlots.forEach((slot) => {
      let slotDate: Date;
      if (typeof slot.startTime === "string") {
        // ISO string from backend
        slotDate = new Date(slot.startTime);
      } else if (
        slot.startTime?.toDate &&
        typeof slot.startTime.toDate === "function"
      ) {
        // Firestore Timestamp object (if not serialized)
        slotDate = slot.startTime.toDate();
      } else if (slot.startTime?.seconds) {
        // Serialized Firestore Timestamp (has seconds property)
        slotDate = new Date(slot.startTime.seconds * 1000);
      } else {
        slotDate = new Date(slot.startTime);
      }

      // Validate date
      if (isNaN(slotDate.getTime())) {
        console.warn(`Invalid date for slot ${slot.id}:`, slot.startTime);
        return;
      }

      const slotDay = new Date(slotDate);
      slotDay.setHours(0, 0, 0, 0);
      let matched = false;

      // Find which day this slot belongs to
      for (let i = 0; i < days.length; i++) {
        const dayDate = new Date(days[i].date);
        if (slotDay.getTime() === dayDate.getTime()) {
          days[i].slots.push(slot);
          matched = true;
          matchedCount++;
          break;
        }
      }
      if (!matched) {
        unmatchedCount++;
        console.log(`❌ Unmatched slot:`, {
          slotId: slot.id,
          slotDate: slotDate.toISOString(),
          slotDateReadable: slotDate.toLocaleDateString(),
          slotDayNormalized: slotDay.toISOString(),
          lookingFor: days.map((d) => d.date.toISOString()),
        });
      }
    });

    console.log(`\nMatched: ${matchedCount}, Unmatched: ${unmatchedCount}`);

    // Show final grouping
    console.log("\n--- Final grouped slots ---");
    days.forEach((day, index) => {
      console.log(
        `Day ${index} (${day.date.toLocaleDateString()}): ${day.slots.length} slots`
      );
    });

    // Sort slots within each day by start time
    days.forEach((day) => {
      day.slots.sort((a, b) => {
        const aTime = a.startTime.toDate
          ? a.startTime.toDate()
          : new Date(a.startTime);
        const bTime = b.startTime.toDate
          ? b.startTime.toDate()
          : new Date(b.startTime);
        return aTime.getTime() - bTime.getTime();
      });
    });

    return days;
  }, [timeSlots]);

  const getUserReservationForSlot = (
    slotId: string
  ): Reservation | undefined => {
    return userReservations.find(
      (r) => r.slotId === slotId && r.status === "active"
    );
  };

  const handleBookClick = (slot: TimeSlot) => {
    const reservation = getUserReservationForSlot(slot.id);
    if (reservation) {
      // User has a reservation, cancel it
      handleCancelReservation(reservation.id, slot.id);
    } else {
      // User doesn't have a reservation, create one
      setSelectedSlot(slot);
      setModalOpen(true);
      setSuccess(false);
      setError(null);
    }
  };

  const handleCancelReservation = async (
    reservationId: string,
    slotId: string
  ) => {
    if (!user?.uid) return;

    if (!confirm("Are you sure you want to cancel this reservation?")) {
      return;
    }

    try {
      setBookingSlotId(slotId);
      setError(null);
      await cancelReservation(reservationId, user.uid);
      setSuccess(true);
      // Refresh time slots and reservations after cancellation
      setTimeout(() => {
        loadTimeSlots();
        loadUserReservations();
        setSuccess(false);
      }, 1500);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to cancel reservation"
      );
    } finally {
      setBookingSlotId(null);
    }
  };

  const handleConfirmBooking = async () => {
    if (!selectedSlot || !userId) {
      setError("Please sign in to make a reservation");
      return;
    }

    try {
      setBookingSlotId(selectedSlot.id);
      setError(null);
      await createReservation(userId, userName, selectedSlot.id);
      setSuccess(true);
      // Refresh time slots and reservations after booking
      setTimeout(() => {
        loadTimeSlots();
        loadUserReservations();
        setModalOpen(false);
        setSuccess(false);
      }, 1500);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create reservation"
      );
    } finally {
      setBookingSlotId(null);
    }
  };

  const formatTime = (timestamp: any): string => {
    if (!timestamp) return "N/A";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const formatDate = (date: Date): string => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfter = new Date(today);
    dayAfter.setDate(dayAfter.getDate() + 2);

    const dateToCheck = new Date(date);
    dateToCheck.setHours(0, 0, 0, 0);

    if (dateToCheck.getTime() === today.getTime()) {
      return "Today";
    } else if (dateToCheck.getTime() === tomorrow.getTime()) {
      return "Tomorrow";
    } else if (dateToCheck.getTime() === dayAfter.getTime()) {
      return dateToCheck.toLocaleDateString("en-US", {
        weekday: "long",
        month: "short",
        day: "numeric",
      });
    }
    return dateToCheck.toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
  };

  const currentDaySlots = slotsByDay[activeDay]?.slots || [];

  if (authLoading) {
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

  if (!user) {
    return null; // Will redirect to sign in
  }

  return (
    <div className="time-slots-page">
      <Container fluid py="xl">
        <Stack spacing="xl">
          {/* Day Tabs */}
          <Tabs
            value={activeDay.toString()}
            onTabChange={(value) => setActiveDay(Number(value))}
          >
            <Tabs.List className="day-tabs">
              {slotsByDay.map((day, index) => (
                <Tabs.Tab
                  key={index}
                  value={index.toString()}
                  className="day-tab"
                >
                  <Stack spacing={4} align="center">
                    <Text size="sm" weight={500}>
                      {formatDate(day.date)}
                    </Text>
                    <Text size="xs" color="dimmed">
                      {day.slots.length} slots
                    </Text>
                  </Stack>
                </Tabs.Tab>
              ))}
            </Tabs.List>
          </Tabs>

          {error && !modalOpen && (
            <Alert color="red" title="Error">
              {error}
            </Alert>
          )}

          {/* Scrollable List of Time Slot Cards */}
          <ScrollArea
            h="calc(100vh - 300px)"
            className="time-slots-scroll"
            style={{
              scrollBehavior: "smooth",
            }}
          >
            <Stack spacing="md" className="time-slots-list">
              {loading && currentDaySlots.length === 0 ? (
                <Center h={400}>
                  <Loader size="lg" />
                </Center>
              ) : currentDaySlots.length === 0 ? (
                <Center py="xl">
                  <Text color="dimmed">
                    No time slots available for this day
                  </Text>
                </Center>
              ) : (
                currentDaySlots.map((slot) => (
                  <Card
                    key={slot.id}
                    shadow="sm"
                    padding="lg"
                    radius="md"
                    withBorder
                    className="time-slot-card"
                  >
                    <Group position="apart" align="flex-start">
                      {/* Left: Time and Date Info */}
                      <Stack spacing="xs" style={{ flex: 1 }}>
                        <Group spacing="xs">
                          <Clock size={18} className="time-icon" />
                          <Text size="lg" weight={600} className="time-text">
                            {formatTime(slot.startTime)} -{" "}
                            {formatTime(slot.endTime)}
                          </Text>
                        </Group>
                        <Group spacing="xs">
                          <Users size={16} className="users-icon" />
                          <Text size="sm" className="capacity-text">
                            <span className="current-bookings">
                              {slot.currentBookings}
                            </span>
                            {" / "}
                            <span className="total-capacity">
                              {slot.capacity}
                            </span>
                            {" reserved"}
                          </Text>
                        </Group>
                        <Badge
                          color={
                            slot.status === "full"
                              ? "red"
                              : slot.status === "busy"
                                ? "yellow"
                                : "green"
                          }
                          className="status-badge"
                        >
                          {slot.status}
                        </Badge>
                      </Stack>

                      {/* Right: Reserve/Cancel Button */}
                      {(() => {
                        const reservation = getUserReservationForSlot(slot.id);
                        const isReserved = !!reservation;
                        const isFull = slot.status === "full";
                        const isLoading = bookingSlotId === slot.id;

                        return (
                          <Button
                            disabled={isFull || isLoading}
                            onClick={() => handleBookClick(slot)}
                            loading={isLoading}
                            className="reserve-button"
                            size="md"
                            color={isReserved ? "red" : undefined}
                            variant={isReserved ? "outline" : "filled"}
                            leftIcon={isReserved ? <X size={16} /> : undefined}
                          >
                            {isFull
                              ? "Full"
                              : isReserved
                                ? "Cancel"
                                : "Reserve"}
                          </Button>
                        );
                      })()}
                    </Group>
                  </Card>
                ))
              )}
            </Stack>
          </ScrollArea>
        </Stack>
      </Container>

      {/* Booking Modal */}
      <Modal
        opened={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setError(null);
          setSuccess(false);
        }}
        title="Confirm Reservation"
        className="booking-modal"
      >
        {success ? (
          <Stack spacing="md" align="center" className="success-content">
            <CheckCircle size={48} color="green" />
            <Text weight={500}>Reservation confirmed!</Text>
          </Stack>
        ) : (
          <Stack spacing="md" className="booking-form">
            {selectedSlot && (
              <div className="slot-info">
                <Text size="sm" color="dimmed">
                  Time Slot:
                </Text>
                <Text weight={500} className="slot-time">
                  {formatTime(selectedSlot.startTime)} -{" "}
                  {formatTime(selectedSlot.endTime)}
                </Text>
                <Text size="sm" color="dimmed" mt="xs">
                  {selectedSlot.currentBookings} / {selectedSlot.capacity}{" "}
                  reserved
                </Text>
              </div>
            )}
            <Text size="sm" color="dimmed">
              Reserving as: <strong>{userName}</strong>
            </Text>
            {error && (
              <Alert color="red" className="error-alert">
                {error}
              </Alert>
            )}
            <Group position="right" mt="md" className="modal-actions">
              <Button
                variant="outline"
                onClick={() => setModalOpen(false)}
                className="cancel-button"
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmBooking}
                loading={bookingSlotId === selectedSlot?.id}
                disabled={!userId}
                className="confirm-button"
              >
                Confirm
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </div>
  );
};

export default TimeSlots;
