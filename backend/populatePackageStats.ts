import { db } from "./firebaseUtils";
import * as admin from "firebase-admin";

type PackageStat = {
  date: string; // YYYY-MM-DD format
  packagesToday: number;
  averageWaitTime: number; // in minutes
  timestamp: admin.firestore.Timestamp;
};

async function populatePackageStats() {
  console.log("Starting to populate package stats...");

  const stats: PackageStat[] = [];
  const now = new Date();

  // Generate stats for the past 30 days
  for (let day = 29; day >= 0; day--) {
    const date = new Date(now);
    date.setDate(now.getDate() - day);
    const dateString = date.toISOString().split("T")[0]; // YYYY-MM-DD

    // Simulate package counts (higher on weekdays, lower on weekends)
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const basePackages = isWeekend ? 40 : 80;
    const packagesToday = basePackages + Math.floor(Math.random() * 30);

    // Simulate wait times (correlated with package count)
    const averageWaitTime = Math.round(
      5 + (packagesToday / 100) * 10 + Math.random() * 5
    );

    stats.push({
      date: dateString,
      packagesToday: packagesToday,
      averageWaitTime: averageWaitTime,
      timestamp: admin.firestore.Timestamp.fromDate(date),
    });
  }

  // Batch write to Firestore
  const batch = db.batch();
  const collectionRef = db.collection("packageStats");

  stats.forEach((stat) => {
    const docRef = collectionRef.doc(stat.date);
    batch.set(docRef, stat);
  });

  await batch.commit();
  console.log(`Successfully populated ${stats.length} package stats`);

  // Create a current stats document
  const today = now.toISOString().split("T")[0];
  const todayStat = stats.find((s) => s.date === today) || stats[stats.length - 1];
  const yesterdayStat = stats[stats.length - 2] || todayStat;

  const packagesChange = Math.round(
    ((todayStat.packagesToday - yesterdayStat.packagesToday) /
      yesterdayStat.packagesToday) *
      100
  );
  const waitTimeChange = Math.round(
    ((todayStat.averageWaitTime - yesterdayStat.averageWaitTime) /
      yesterdayStat.averageWaitTime) *
      100
  );

  await db.collection("packageStats").doc("current").set({
    packagesToday: todayStat.packagesToday,
    packagesChange: packagesChange,
    averageWaitTime: todayStat.averageWaitTime,
    waitTimeChange: waitTimeChange,
    lastUpdated: admin.firestore.Timestamp.now(),
  });

  console.log("Successfully created current package stats document");
}

populatePackageStats()
  .then(() => {
    console.log("Population complete!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Error populating data:", error);
    process.exit(1);
  });

