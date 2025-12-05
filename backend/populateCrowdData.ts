import { db } from "./firebaseUtils";
import * as admin from "firebase-admin";
import { isWithinRPCCHours, getRPCCOperationHours } from "./rpccHours";

type CrowdReading = {
  timestamp: admin.firestore.Timestamp;
  value: number; // 0-100 percentage
  hour: number; // 0-23
};

async function populateCrowdData() {
  console.log("Starting to populate crowd data...");

  const now = new Date();
  const readings: CrowdReading[] = [];

  // Generate crowd readings for the past 7 days, only during operation hours
  for (let day = 6; day >= 0; day--) {
    const date = new Date(now);
    date.setDate(now.getDate() - day);
    const dayOfWeek = date.getDay();
    const { start, end } = getRPCCOperationHours(dayOfWeek);

    // Only generate data for operation hours
    for (let hour = start; hour < end; hour++) {
      const timestamp = new Date(date);
      timestamp.setHours(hour, 0, 0, 0);

      if (!isWithinRPCCHours(timestamp)) {
        continue;
      }

      // Simulate crowd levels based on time of day
      let crowdValue: number;
      if (hour >= 12 && hour <= 14) {
        // Lunch hours: higher crowd
        crowdValue = 30 + Math.random() * 10; // 30-40
      } else if (hour >= 15 && hour <= 17) {
        // Afternoon: medium crowd
        crowdValue = 10 + Math.random() * 10; // 10-20
      } else {
        // Other hours: low crowd
        crowdValue = 1 + Math.random() * 9; // 1-10
      }

      readings.push({
        timestamp: admin.firestore.Timestamp.fromDate(timestamp),
        value: Math.round(crowdValue),
        hour: hour,
      });
    }
  }

  // Batch write to Firestore
  const batch = db.batch();
  const collectionRef = db.collection("crowdReadings");

  readings.forEach((reading) => {
    const docRef = collectionRef.doc();
    batch.set(docRef, reading);
  });

  await batch.commit();
  console.log(`Successfully populated ${readings.length} crowd readings`);
  
  // Note: crowdLevels collection is no longer needed - frontend calculates
  // crowd level and wait time dynamically from historical data
}

populateCrowdData()
  .then(() => {
    console.log("Population complete!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Error populating data:", error);
    process.exit(1);
  });

