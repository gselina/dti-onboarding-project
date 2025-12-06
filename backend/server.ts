import path from "path";
import express, { Express } from "express";
import cors from "cors";
import fetch from "node-fetch";
import { db } from "./firebaseUtils";
import * as admin from "firebase-admin";
import { isWithinRPCCHours, getRPCCOperationHours } from "./rpccHours";
import { TimeSlot, Reservation } from "@full-stack/types";

const app: Express = express();

const hostname = "0.0.0.0";
const port = 8080;

app.use(cors());
app.use(express.json());

// Helper function to get current time with test override support
function getCurrentTime(req?: express.Request): Date {
    // Check query parameter first (for easy testing via URL)
    if (req?.query.testTime) {
        const testTime = new Date(req.query.testTime as string);
        if (!isNaN(testTime.getTime())) {
            console.log("Using test time from query:", testTime.toISOString());
            return testTime;
        }
    }
    // Check environment variable (for persistent testing)
    if (process.env.TEST_TIME) {
        const testTime = new Date(process.env.TEST_TIME);
        if (!isNaN(testTime.getTime())) {
            console.log("Using test time from env:", testTime.toISOString());
            return testTime;
        }
    }
    // Default to actual current time
    return new Date();
}

// Crowd data endpoints
type CrowdDataPoint = {
        time: string;
    value: number;
};

type CrowdStats = {
    currentCrowdLevel: "Low" | "Medium" | "High";
    estimatedWaitTime: string;
    historicalData: CrowdDataPoint[];
    previousDayData?: CrowdDataPoint[];
};

app.get("/api/crowd-levels", async (req, res) => {
    console.log("GET /api/crowd-levels was called");
    try {
        let historicalData: CrowdDataPoint[] = [];

        // Get current time (with test override support)
        const now = getCurrentTime(req);

        // Try to get data from Firebase
        try {
            // Get historical data for the past 24 hours (to ensure we get operation hours data)
            const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            const oneDayAgoTimestamp = admin.firestore.Timestamp.fromDate(oneDayAgo);

            const readingsSnapshot = await db
                .collection("crowdReadings")
                .where("timestamp", ">=", oneDayAgoTimestamp)
                .orderBy("timestamp", "asc")
                .limit(100) // Get more to filter down to operation hours and previous day
                .get();

            // Filter to only operation hours and get the most recent ones
            const operationHoursData: CrowdDataPoint[] = [];
            const previousDayData: CrowdDataPoint[] = [];
            const yesterday = new Date(now);
            yesterday.setDate(yesterday.getDate() - 1);
            yesterday.setHours(0, 0, 0, 0);
            const yesterdayEnd = new Date(yesterday);
            yesterdayEnd.setHours(23, 59, 59, 999);

            readingsSnapshot.forEach((doc) => {
                const data = doc.data();
                const timestamp = data.timestamp.toDate();
                // Only include data within RPCC operation hours
                if (isWithinRPCCHours(timestamp)) {
                    const dataPoint = {
                        time: timestamp.toLocaleTimeString("en-US", {
                            hour: "numeric",
                            minute: "2-digit",
                        }),
                        value: data.value,
                    };
                    
                    // Check if this data point is from yesterday
                    if (timestamp >= yesterday && timestamp <= yesterdayEnd) {
                        previousDayData.push(dataPoint);
                    } else if (timestamp > yesterdayEnd) {
                        // Today's data
                        operationHoursData.push(dataPoint);
                    }
                }
            });
            
            // Get the most recent operation hours data (up to 7-11 points depending on day)
            historicalData = operationHoursData.slice(-11); // Max 11 hours in a day (8am-7pm on weekdays)
            
            // Sort previous day data by time and limit to same number of points
            previousDayData.sort((a, b) => {
                const timeA = new Date(`2000-01-01 ${a.time}`);
                const timeB = new Date(`2000-01-01 ${b.time}`);
                return timeA.getTime() - timeB.getTime();
            });
            
            // Store previous day data for prediction
            const previousDayDataForPrediction = previousDayData.slice(-11); // Use up to 11 points (max hours in a day)
            
            // Always return data, even if today's data is empty (for when closed)
            const output: CrowdStats = {
                currentCrowdLevel: "Low", // Not used by frontend, kept for API compatibility
                estimatedWaitTime: "0-10 minutes", // Not used by frontend, kept for API compatibility
                historicalData: historicalData.length > 0 ? historicalData : [],
                previousDayData: previousDayDataForPrediction.length > 0 ? previousDayDataForPrediction : undefined,
            };
            return res.json(output);
        } catch (firebaseError) {
            console.log("Firebase query failed, using mock data:", firebaseError);
        }

        // If no data in Firebase, fall back to mock data
        if (historicalData.length === 0) {
            console.log("No Firebase data found, using mock data");
            const mockHistoricalData: CrowdDataPoint[] = [];
            const mockPreviousDayData: CrowdDataPoint[] = [];
            
            // Generate mock data only for operation hours
            for (let i = 6; i >= 0; i--) {
                const hour = new Date(now);
                hour.setHours(now.getHours() - i);
                
                // Only include data within RPCC operation hours
                if (!isWithinRPCCHours(hour)) {
                    continue;
                }
                
                const hourValue = hour.getHours();
                
                let crowdValue: number;
                if (hourValue >= 12 && hourValue <= 14) {
                    crowdValue = 30 + Math.random() * 10;
                } else if (hourValue >= 15 && hourValue <= 17) {
                    crowdValue = 10 + Math.random() * 10;
                } else {
                    crowdValue = 1 + Math.random() * 9;
                }
                
                mockHistoricalData.push({
                    time: hour.toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                    }),
                    value: Math.round(crowdValue),
                });
            }
            
            // Generate mock previous day data (yesterday at same times)
            const yesterday = new Date(now);
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayDayOfWeek = yesterday.getDay();
            let prevStartHour: number, prevEndHour: number;
            
            if (yesterdayDayOfWeek >= 1 && yesterdayDayOfWeek <= 5) {
                prevStartHour = 8;
                prevEndHour = 19;
            } else if (yesterdayDayOfWeek === 6) {
                prevStartHour = 11;
                prevEndHour = 19;
            } else {
                prevStartHour = 12;
                prevEndHour = 19;
            }
            
            // Generate previous day data for the same number of hours as today
            for (let hour = prevStartHour; hour < prevEndHour && mockPreviousDayData.length < mockHistoricalData.length; hour++) {
                let prevCrowdValue: number;
                if (hour >= 12 && hour <= 14) {
                    prevCrowdValue = 30 + Math.random() * 10;
                } else if (hour >= 15 && hour <= 17) {
                    prevCrowdValue = 10 + Math.random() * 10;
                } else {
                    prevCrowdValue = 1 + Math.random() * 9;
                }
                
                const prevHourDate = new Date(yesterday);
                prevHourDate.setHours(hour, 0, 0, 0);
                
                mockPreviousDayData.push({
                    time: prevHourDate.toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                    }),
                    value: Math.round(prevCrowdValue),
                });
            }
            
            // If we still don't have data, generate data for today's operation hours
            if (mockHistoricalData.length === 0) {
                const today = new Date();
                const dayOfWeek = today.getDay();
                let startHour: number, endHour: number;
                
                if (dayOfWeek >= 1 && dayOfWeek <= 5) {
                    // Monday - Friday: 8 am - 7 pm
                    startHour = 8;
                    endHour = 19;
                } else if (dayOfWeek === 6) {
                    // Saturday: 11 am - 7 pm
                    startHour = 11;
                    endHour = 19;
                } else {
                    // Sunday: 12 pm - 7 pm
                    startHour = 12;
                    endHour = 19;
                }
                
                for (let hour = startHour; hour < endHour; hour++) {
                    const hourDate = new Date(today);
                    hourDate.setHours(hour, 0, 0, 0);
                    
                    let crowdValue: number;
                    if (hour >= 12 && hour <= 14) {
                        crowdValue = 30 + Math.random() * 10;
                    } else if (hour >= 15 && hour <= 17) {
                        crowdValue = 10 + Math.random() * 10;
                    } else {
                        crowdValue = 1 + Math.random() * 9;
                    }
                    
                    mockHistoricalData.push({
                        time: hourDate.toLocaleTimeString("en-US", {
                            hour: "numeric",
                            minute: "2-digit",
                        }),
                        value: Math.round(crowdValue),
                    });
                }
            }
            
            const currentValue = mockHistoricalData[mockHistoricalData.length - 1]?.value || 30;
            const currentCrowdLevel: "Low" | "Medium" | "High" =
                currentValue >= 30 ? "High" : currentValue >= 10 ? "Medium" : "Low";
            const estimatedWaitTime =
                currentValue >= 30 ? "15-30 minutes" : currentValue >= 10 ? "10-15 minutes" : "0-10 minutes";
            
            return res.json({
                currentCrowdLevel,
                estimatedWaitTime,
                historicalData: mockHistoricalData,
                previousDayData: mockPreviousDayData.length > 0 ? mockPreviousDayData : undefined,
            });
        }

        const output: CrowdStats = {
            currentCrowdLevel: "Low", // Not used by frontend, kept for API compatibility
            estimatedWaitTime: "0-10 minutes", // Not used by frontend, kept for API compatibility
            historicalData: historicalData.length > 0 ? historicalData : [],
        };
        
        res.json(output);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Something went wrong" });
    }
});

type PackageStats = {
    packagesToday: number;
    packagesChange: number; // percentage change
    averageWaitTime: number; // in minutes
    waitTimeChange: number; // percentage change
};

app.get("/api/package-stats", async (req, res) => {
    console.log("GET /api/package-stats was called");
    try {
        let currentData = null;

        // Try to get data from Firebase
        try {
            const currentDoc = await db.collection("packageStats").doc("current").get();
            currentData = currentDoc.data();
        } catch (firebaseError) {
            console.log("Firebase query failed, using mock data:", firebaseError);
        }

        // If no data in Firebase, fall back to mock data
        if (!currentData) {
            console.log("No Firebase data found, using mock data");
            return res.json({
                packagesToday: 86,
                packagesChange: 12,
                averageWaitTime: 8,
                waitTimeChange: -17,
            });
        }

        const output: PackageStats = {
            packagesToday: currentData.packagesToday,
            packagesChange: currentData.packagesChange,
            averageWaitTime: currentData.averageWaitTime,
            waitTimeChange: currentData.waitTimeChange,
        };
        
        res.json(output);
    } catch (error) {
        console.error("Error in /api/package-stats:", error);
        // Return mock data as fallback even on error
        res.json({
            packagesToday: 86,
            packagesChange: 12,
            averageWaitTime: 8,
            waitTimeChange: -17,
        });
    }
});

app.listen(port, hostname, () => {
    console.log("Listening");
});

// GET /api/timeSlots - Get time slots with reservation counts (only next 3 days to reduce reads)
app.get("/api/timeSlots", async (req, res) => {
    console.log("GET /api/timeSlots was called");
    try {
        const now = new Date();
        const threeDaysFromNow = new Date(now);
        threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
        threeDaysFromNow.setHours(23, 59, 59, 999);
        
        const nowTimestamp = admin.firestore.Timestamp.fromDate(now);
        const threeDaysTimestamp = admin.firestore.Timestamp.fromDate(threeDaysFromNow);
        
        // Only get time slots for the next 3 days (reduces reads significantly)
        const slotsSnapshot = await db
            .collection("timeSlots")
            .where("startTime", ">=", nowTimestamp)
            .where("startTime", "<=", threeDaysTimestamp)
            .orderBy("startTime", "asc")
            .get();
        
        console.log(`Found ${slotsSnapshot.size} time slots in next 3 days`);
        
        if (slotsSnapshot.size === 0) {
            return res.json([]);
        }
        
        // Get slot IDs to query reservations for only these slots
        const slotIds = slotsSnapshot.docs.map(doc => doc.id);
        
        // Get reservations only for these specific slots (much more efficient)
        // Firestore 'in' query limit is 10, so we need to batch if more than 10 slots
        const reservationCounts: { [slotId: string]: number } = {};
        
        if (slotIds.length > 0) {
            // Process in batches of 10 (Firestore 'in' query limit)
            for (let i = 0; i < slotIds.length; i += 10) {
                const batch = slotIds.slice(i, i + 10);
                const reservationsSnapshot = await db
                    .collection("reservations")
                    .where("slotId", "in", batch)
                    .where("status", "==", "active")
                    .get();
                
                reservationsSnapshot.forEach((doc) => {
                    const reservation = doc.data();
                    const slotId = reservation.slotId;
                    reservationCounts[slotId] = (reservationCounts[slotId] || 0) + 1;
                });
            }
        }
        
        // Combine time slots with reservation counts, filtering to only RPCC operation hours
        const timeSlots: TimeSlot[] = [];
        slotsSnapshot.forEach((doc) => {
            const slotData = doc.data();
            
            // Get the start time as a Date object
            const startTime = slotData.startTime?.toDate 
                ? slotData.startTime.toDate() 
                : new Date(slotData.startTime);
            
            // Only include slots within RPCC operation hours
            if (!isWithinRPCCHours(startTime)) {
                return; // Skip this slot
            }
            
            const reservationCount = reservationCounts[doc.id] || 0;
            const capacity = slotData.capacity || 0;
            
            // Determine status based on capacity
            let status: "available" | "busy" | "full";
            if (reservationCount >= capacity) {
                status = "full";
            } else if (reservationCount >= capacity * 0.8) {
                status = "busy";
            } else {
                status = "available";
            }
            
            timeSlots.push({
                id: doc.id,
                startTime: slotData.startTime?.toDate ? slotData.startTime.toDate().toISOString() : slotData.startTime,
                endTime: slotData.endTime?.toDate ? slotData.endTime.toDate().toISOString() : slotData.endTime,
                capacity: capacity,
                currentBookings: reservationCount,
                status: status,
            });
        });
        
        // Already sorted by startTime from query
        console.log(`Returning ${timeSlots.length} time slots within RPCC operation hours`);
        res.json(timeSlots);
    } catch (error) {
        console.error("Error fetching time slots:", error);
        res.status(500).json({ error: "Failed to fetch time slots" });
    }
            });
// POST /api/reservations - Create a reservation
app.post("/api/reservations", async (req, res) => {
    console.log("POST /api/reservations was called");
    try {
        const { userId, userName, slotId } = req.body;
        
        // Validate input
        if (!userId || !userName || !slotId) {
            return res.status(400).json({ error: "Missing required fields: userId, userName, slotId" });
        }
        
        // Check if time slot exists
        const slotDoc = await db.collection("timeSlots").doc(slotId).get();
        if (!slotDoc.exists) {
            return res.status(404).json({ error: "Time slot not found" });
        }
        
        const slotData = slotDoc.data();
        const capacity = slotData?.capacity || 0;
    
        
         // Count current active reservations for this slot
         const existingReservations = await db
         .collection("reservations")
         .where("slotId", "==", slotId)
         .where("status", "==", "active")
         .get();
        
         const currentBookings = existingReservations.size;
            // Check if slot is full
            if (currentBookings >= capacity) {
                return res.status(400).json({ error: "Time slot is full" });
            }
            
            // Check if user already has an active reservation for this slot
            const userReservations = await db
                .collection("reservations")
                .where("userId", "==", userId)
                .where("slotId", "==", slotId)
                .where("status", "==", "active")
                .get();
            
            if (!userReservations.empty) {
                return res.status(400).json({ error: "You already have a reservation for this time slot" });
            }
            
            // Get the slot's start time for pickupTime
            const startTime = slotData?.startTime;
            
            // Create reservation
            const reservationRef = await db.collection("reservations").add({
                userId,
                userName,
                slotId,
                status: "active",
                createdAt: admin.firestore.Timestamp.now(),
            });
            
            res.json({          
                id: reservationRef.id,
            userId,
            userName,
            slotId,
            status: "active",
            success: true,
        });
    } catch (error) {
        console.error("Error creating reservation:", error);
        res.status(500).json({ error: "Failed to create reservation" });
    }
});

// GET /api/timeSlots/:slotId - Get a single time slot by ID
app.get("/api/timeSlots/:slotId", async (req, res) => {
    console.log(`GET /api/timeSlots/${req.params.slotId} was called`);
    try {
        const { slotId } = req.params;
        const slotDoc = await db.collection("timeSlots").doc(slotId).get();
        
        if (!slotDoc.exists) {
            return res.status(404).json({ error: "Time slot not found" });
        }
        
        const slotData = slotDoc.data();
        const timeSlot: TimeSlot = {
            id: slotDoc.id,
            startTime: slotData?.startTime?.toDate ? slotData.startTime.toDate().toISOString() : slotData?.startTime,
            endTime: slotData?.endTime?.toDate ? slotData.endTime.toDate().toISOString() : slotData?.endTime,
            capacity: slotData?.capacity || 0,
            currentBookings: 0, // Will be calculated if needed
            status: "available",
        };
        
        res.json(timeSlot);
    } catch (error) {
        console.error("Error fetching time slot:", error);
        res.status(500).json({ error: "Failed to fetch time slot" });
    }
});

// POST /api/timeSlots - Create a new time slot (admin only)
app.post("/api/timeSlots", async (req, res) => {
    console.log("POST /api/timeSlots was called");
    try {
        const { startTime, endTime, capacity } = req.body;
        
        // Validate input
        if (!startTime || !endTime) {
            return res.status(400).json({ error: "Missing required fields: startTime, endTime" });
        }
        
        const startDate = new Date(startTime);
        const endDate = new Date(endTime);
        
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            return res.status(400).json({ error: "Invalid date format" });
        }
        
        if (startDate >= endDate) {
            return res.status(400).json({ error: "End time must be after start time" });
        }
        
        // Check if time slot is within RPCC operation hours
        if (!isWithinRPCCHours(startDate)) {
            return res.status(400).json({ 
                error: "Time slot start time is outside RPCC operation hours. Please check the operating hours for this day." 
            });
        }
        
        // Also check if end time is within operation hours (or at least the slot doesn't extend too far)
        // The end time should be within the same day's operation hours
        if (!isWithinRPCCHours(endDate) && endDate.getDate() === startDate.getDate()) {
            // If end time is on the same day but outside hours, check if it's just past closing
            const endHour = endDate.getHours();
            const dayOfWeek = endDate.getDay();
            const { end: closingHour } = getRPCCOperationHours(dayOfWeek);
            
            // Allow if end time is exactly at closing (7pm = 19:00)
            if (endHour > closingHour) {
                return res.status(400).json({ 
                    error: "Time slot end time extends beyond RPCC operation hours. Please ensure the slot ends before closing time." 
                });
            }
        }
        
        const slotCapacity = capacity || 40; // Default to 40 if not provided
        
        // Create time slot
        const slotRef = await db.collection("timeSlots").add({
            startTime: admin.firestore.Timestamp.fromDate(startDate),
            endTime: admin.firestore.Timestamp.fromDate(endDate),
            capacity: slotCapacity,
            currentBookings: 0,
            status: "available",
        });
        
        res.json({
            id: slotRef.id,
            startTime: startDate.toISOString(),
            endTime: endDate.toISOString(),
            capacity: slotCapacity,
            currentBookings: 0,
            status: "available",
        });
    } catch (error) {
        console.error("Error creating time slot:", error);
        res.status(500).json({ error: "Failed to create time slot" });
    }
});

// DELETE /api/timeSlots/:slotId - Delete a time slot (admin only)
app.delete("/api/timeSlots/:slotId", async (req, res) => {
    console.log(`DELETE /api/timeSlots/${req.params.slotId} was called`);
    try {
        const { slotId } = req.params;
        
        // Check if time slot exists
        const slotDoc = await db.collection("timeSlots").doc(slotId).get();
        if (!slotDoc.exists) {
            return res.status(404).json({ error: "Time slot not found" });
        }
        
        // Check if there are any active reservations for this slot
        const activeReservations = await db
            .collection("reservations")
            .where("slotId", "==", slotId)
            .where("status", "==", "active")
            .get();
        
        if (!activeReservations.empty) {
            return res.status(400).json({ 
                error: `Cannot delete time slot with ${activeReservations.size} active reservation(s). Please cancel all reservations first.` 
            });
        }
        
        // Delete the time slot
        await db.collection("timeSlots").doc(slotId).delete();
        
        res.json({ success: true, message: "Time slot deleted successfully" });
    } catch (error) {
        console.error("Error deleting time slot:", error);
        res.status(500).json({ error: "Failed to delete time slot" });
    }
});

// GET /api/reservations/:userId - Get user's reservations with time slot info
app.get("/api/reservations/:userId", async (req, res) => {
    console.log(`GET /api/reservations/${req.params.userId} was called`);
    try {
        const { userId } = req.params;
        
        // First, get all reservations for the user (without orderBy to avoid index requirement)
        const reservationsSnapshot = await db
            .collection("reservations")
            .where("userId", "==", userId)
            .where("status", "==", "active")
            .get();
        
        console.log(`Found ${reservationsSnapshot.size} active reservations for user ${userId}`);
        
        const reservations: (Reservation & { timeSlot?: TimeSlot })[] = [];
        
        // Fetch time slot info for each reservation
        for (const doc of reservationsSnapshot.docs) {
            const data = doc.data();
            const reservation: Reservation & { timeSlot?: TimeSlot } = {
                id: doc.id,
                userId: data.userId,
                userName: data.userName,
                slotId: data.slotId,
                status: data.status,
                createdAt: data.createdAt,
            };
            
            // Fetch the time slot details
            try {
                const slotDoc = await db.collection("timeSlots").doc(data.slotId).get();
                if (slotDoc.exists) {
                    const slotData = slotDoc.data();
                    reservation.timeSlot = {
                        id: slotDoc.id,
                        startTime: slotData?.startTime?.toDate ? slotData.startTime.toDate().toISOString() : slotData?.startTime,
                        endTime: slotData?.endTime?.toDate ? slotData.endTime.toDate().toISOString() : slotData?.endTime,
                        capacity: slotData?.capacity || 0,
                        currentBookings: 0,
                        status: "available",
                    };
                }
            } catch (slotError) {
                console.error(`Error fetching time slot ${data.slotId}:`, slotError);
            }
            
            reservations.push(reservation);
        }
        
        // Sort in memory by createdAt (descending)
        reservations.sort((a, b) => {
            const aTime = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 
                         a.createdAt?.seconds ? a.createdAt.seconds * 1000 :
                         new Date(a.createdAt as any).getTime();
            const bTime = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 
                         b.createdAt?.seconds ? b.createdAt.seconds * 1000 :
                         new Date(b.createdAt as any).getTime();
            return bTime - aTime; // Descending order
        });
        
        console.log(`Returning ${reservations.length} reservations`);
        res.json(reservations);
    } catch (error) {
        console.error("Error fetching reservations:", error);
        // Log more details about the error
        if (error instanceof Error) {
            console.error("Error message:", error.message);
            console.error("Error stack:", error.stack);
        }
        res.status(500).json({ error: "Failed to fetch reservations: " + (error instanceof Error ? error.message : "Unknown error") });
    }
});

// DELETE /api/reservations/:reservationId - Cancel a reservation
app.delete("/api/reservations/:reservationId", async (req, res) => {
    console.log(`DELETE /api/reservations/${req.params.reservationId} was called`);
    try {
        const { reservationId } = req.params;
        const { userId } = req.body; // User ID to verify ownership
        
        if (!userId) {
            return res.status(400).json({ error: "Missing userId in request body" });
        }
        
        // Get the reservation
        const reservationRef = db.collection("reservations").doc(reservationId);
        const reservationDoc = await reservationRef.get();
        
        if (!reservationDoc.exists) {
            return res.status(404).json({ error: "Reservation not found" });
        }
        
        const reservationData = reservationDoc.data();
        
        // Verify the reservation belongs to the user
        if (reservationData?.userId !== userId) {
            return res.status(403).json({ error: "You can only cancel your own reservations" });
        }
        
        // Update reservation status to cancelled
        await reservationRef.update({
            status: "cancelled",
        });
        
        res.json({ success: true, message: "Reservation cancelled successfully" });
    } catch (error) {
        console.error("Error cancelling reservation:", error);
        res.status(500).json({ error: "Failed to cancel reservation" });
    }
});