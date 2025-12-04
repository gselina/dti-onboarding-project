import path from "path";
import express, { Express } from "express";
import cors from "cors";
import { WeatherResponse } from "@full-stack/types";
import fetch from "node-fetch";
import { db } from "./firebaseUtils";
import * as admin from "firebase-admin";
import { isWithinRPCCHours } from "./rpccHours";

const app: Express = express();

const hostname = "0.0.0.0";
const port = 8080;

app.use(cors());
app.use(express.json());

// Crowd data endpoints
type CrowdDataPoint = {
    time: string;
    value: number;
};

type CrowdStats = {
    currentCrowdLevel: "Low" | "Medium" | "High";
    estimatedWaitTime: string;
    historicalData: CrowdDataPoint[];
};

app.get("/api/crowd-levels", async (req, res) => {
    console.log("GET /api/crowd-levels was called");
    try {
        let currentData = null;
        let historicalData: CrowdDataPoint[] = [];

        // Try to get data from Firebase
        try {
            const currentDoc = await db.collection("crowdLevels").doc("current").get();
            currentData = currentDoc.data();

            // Get historical data for the past 24 hours (to ensure we get operation hours data)
            const now = new Date();
            const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            const oneDayAgoTimestamp = admin.firestore.Timestamp.fromDate(oneDayAgo);

            const readingsSnapshot = await db
                .collection("crowdReadings")
                .where("timestamp", ">=", oneDayAgoTimestamp)
                .orderBy("timestamp", "asc")
                .limit(50) // Get more to filter down to operation hours
                .get();

            // Filter to only operation hours and get the most recent ones
            const operationHoursData: CrowdDataPoint[] = [];
            readingsSnapshot.forEach((doc) => {
                const data = doc.data();
                const timestamp = data.timestamp.toDate();
                // Only include data within RPCC operation hours
                if (isWithinRPCCHours(timestamp)) {
                    operationHoursData.push({
                        time: timestamp.toLocaleTimeString("en-US", {
                            hour: "numeric",
                            minute: "2-digit",
                        }),
                        value: data.value,
                    });
                }
            });
            
            // Get the most recent operation hours data (up to 7-11 points depending on day)
            historicalData = operationHoursData.slice(-11); // Max 11 hours in a day (8am-7pm on weekdays)
        } catch (firebaseError) {
            console.log("Firebase query failed, using mock data:", firebaseError);
        }

        // If no data in Firebase, fall back to mock data
        if (!currentData || historicalData.length === 0) {
            console.log("No Firebase data found, using mock data");
            const now = new Date();
            const mockHistoricalData: CrowdDataPoint[] = [];
            
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
            });
        }

        const output: CrowdStats = {
            currentCrowdLevel: currentData.currentCrowdLevel,
            estimatedWaitTime: currentData.estimatedWaitTime,
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
