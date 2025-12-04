// Shared types across both frontend and backend!
// Package Pickup Queue Types
export type TimeSlot = {
    id: string;
    startTime: Date | any; // Firestore Timestamp
    endTime: Date | any;   // Firestore Timestamp
    capacity: number;
    currentBookings: number;
    status: "available" | "busy" | "full";
};

export type Reservation = {
    id: string;
    userId: string;
    userName: string;
    slotId: string;
    status: "active" | "completed" | "cancelled";
    createdAt: Date | any; // Firestore Timestamp
};
