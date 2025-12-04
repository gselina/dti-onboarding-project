// backend/scripts/populateTimeSlots.ts

import * as dotenv from "dotenv";
import { db } from "../firebase";
import { Timestamp } from "firebase-admin/firestore";  // Changed import

// Load environment variables
dotenv.config();

/**
 * Populates timeSlots collection with time slots for a given date range
 */
async function populateTimeSlots() {
    try {
        console.log("Starting to populate timeSlots...");

        // Configuration
        const startDate = new Date("2025-12-04");
        const endDate = new Date("2025-12-31");
        const slotDurationMinutes = 30;
        const startHour = 8;
        const startMinute = 0;
        const endHour = 19;
        const capacity = 80;

        let slotsCreated = 0;

        // Generate slots for each day in the range
        const currentDate = new Date(startDate);
        while (currentDate <= endDate) {
            const date = new Date(currentDate);
            
            // Calculate how many 30-minute slots fit between start and end time
            const totalMinutes = (endHour - startHour) * 60;
            const slotsPerDay = Math.floor(totalMinutes / slotDurationMinutes);

            // Create slots for this day (every 30 minutes)
            for (let i = 0; i < slotsPerDay; i++) {
                const slotStart = new Date(date);
                const totalMinutesFromStart = i * slotDurationMinutes;
                const hours = startHour + Math.floor(totalMinutesFromStart / 60);
                const minutes = startMinute + (totalMinutesFromStart % 60);
                
                slotStart.setHours(hours, minutes, 0, 0);

                const slotEnd = new Date(slotStart);
                slotEnd.setMinutes(slotEnd.getMinutes() + slotDurationMinutes);

                // Validate dates before creating
                if (isNaN(slotStart.getTime()) || isNaN(slotEnd.getTime())) {
                    console.error(`Invalid date created for slot ${i} on ${date.toDateString()}`);
                    continue;
                }

                // Create the time slot document using Admin SDK
                await db.collection("timeSlots").add({
                    startTime: Timestamp.fromDate(slotStart),
                    endTime: Timestamp.fromDate(slotEnd),
                    capacity: capacity,
                    currentBookings: 0,
                    status: "available",
                });

                slotsCreated++;
                console.log(`Created slot: ${slotStart.toLocaleString()} - ${slotEnd.toLocaleString()}`);
            }
            
            // Move to next day
            currentDate.setDate(currentDate.getDate() + 1);
        }

        console.log(`\n✅ Successfully created ${slotsCreated} time slots!`);
        process.exit(0);
    } catch (error) {
        console.error("❌ Error populating timeSlots:", error);
        process.exit(1);
    }
}

// Run the script
populateTimeSlots();