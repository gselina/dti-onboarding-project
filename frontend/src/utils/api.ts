import { BACKEND_BASE_PATH } from "../constants/Navigation";
import type { TimeSlot, Reservation } from "@full-stack/types";

export type CrowdDataPoint = {
  time: string;
  value: number;
};

export type CrowdStats = {
  currentCrowdLevel: "Low" | "Medium" | "High";
  estimatedWaitTime: string;
  historicalData: CrowdDataPoint[];
  previousDayData?: CrowdDataPoint[];
};

export type PackageStats = {
  packagesToday: number;
  packagesChange: number;
  averageWaitTime: number;
  waitTimeChange: number;
};

export async function fetchCrowdLevels(): Promise<CrowdStats> {
  const url = `${BACKEND_BASE_PATH}/crowd-levels`;
  console.log("Fetching crowd levels from:", url);
  const response = await fetch(url);
  if (!response.ok) {
    const errorText = await response.text();
    console.error("Failed to fetch crowd levels:", response.status, errorText);
    throw new Error(`Failed to fetch crowd levels: ${response.status}`);
  }
  const data = await response.json();
  console.log("Crowd levels data received:", data);
  return data;
}

export async function fetchPackageStats(): Promise<PackageStats> {
  const url = `${BACKEND_BASE_PATH}/package-stats`;
  console.log("Fetching package stats from:", url);
  const response = await fetch(url);
  if (!response.ok) {
    const errorText = await response.text();
    console.error("Failed to fetch package stats:", response.status, errorText);
    throw new Error(`Failed to fetch package stats: ${response.status}`);
  }
  const data = await response.json();
  console.log("Package stats data received:", data);
  return data;
}


// Fetch all time slots with reservation counts
export async function fetchTimeSlots(): Promise<TimeSlot[]> {
  const url = `${BACKEND_BASE_PATH}/timeSlots`;
  console.log("Fetching time slots from:", url);
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch time slots: ${response.status}`);
    }
    const data = await response.json();
    console.log("Time slots data received:", data);
    return data;
  } catch (error) {
    console.error("Error fetching time slots:", error);
    return [];
  }
}

export async function createReservation(
  userId: string,
  userName: string,
  slotId: string
): Promise<Reservation> {
  const url = `${BACKEND_BASE_PATH}/reservations`;
  console.log("Creating reservation:", { userId, userName, slotId });
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId,
        userName,
        slotId,
      }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `Failed to create reservation: ${response.status}`);
    }
    
    const data = await response.json();
    console.log("Reservation created:", data);
    return data;
  } catch (error) {
    console.error("Error creating reservation:", error);
    throw error;
  }
}

export async function fetchUserReservations(userId: string): Promise<Reservation[]> {
  const url = `${BACKEND_BASE_PATH}/reservations/${userId}`;
  console.log("Fetching reservations for user:", userId);
  console.log("API URL:", url);
  try {
    const response = await fetch(url);
    console.log("Response status:", response.status);
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error response:", errorText);
      throw new Error(`Failed to fetch reservations: ${response.status} - ${errorText}`);
    }
    const data = await response.json();
    console.log("User reservations received:", data);
    console.log("Number of reservations:", Array.isArray(data) ? data.length : "Not an array");
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("Error fetching reservations:", error);
    if (error instanceof Error) {
      console.error("Error message:", error.message);
    }
    throw error; // Re-throw so the UI can show the error
  }
}

export async function cancelReservation(
  reservationId: string,
  userId: string
): Promise<void> {
  const url = `${BACKEND_BASE_PATH}/reservations/${reservationId}`;
  console.log("Cancelling reservation:", { reservationId, userId });
  try {
    const response = await fetch(url, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `Failed to cancel reservation: ${response.status}`);
    }
    
    console.log("Reservation cancelled successfully");
  } catch (error) {
    console.error("Error cancelling reservation:", error);
    throw error;
  }
}
