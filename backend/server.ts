import path from "path";
import express, { Express } from "express";
import cors from "cors";
import fetch from "node-fetch";
import { db } from "./firebaseUtils";
import * as admin from "firebase-admin";
import { isWithinRPCCHours } from "./rpccHours";

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
            const previousDayDataForPrediction = previousDayData.slice(-historicalData.length);
            
            // If we have previous day data, include it in the response
            if (previousDayDataForPrediction.length > 0) {
                const output: CrowdStats = {
                    currentCrowdLevel: "Low", // Not used by frontend, kept for API compatibility
                    estimatedWaitTime: "0-10 minutes", // Not used by frontend, kept for API compatibility
                    historicalData: historicalData.length > 0 ? historicalData : [],
                    previousDayData: previousDayDataForPrediction,
                };
                return res.json(output);
            }
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
