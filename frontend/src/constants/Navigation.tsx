import HomePage from "../pages/Home";
import TimeSlots from "../pages/TimeSlots"; 
import SignInPage from "../pages/SignIn";
import ReservationsPage from "../pages/Reservations";

/**
 * Backend base path for API calls.
 * For local development, use: 'http://localhost:8080/api'
 * For production, use: 'https://<app-name>.fly.dev/api'
 */
export const BACKEND_BASE_PATH =
  import.meta.env.MODE === "development"
    ? "http://localhost:8080/api"
    : "https://fa23-lec9-demo-soln.fly.dev/api";

export const PATHS: {
  link: string;
  label: string;
  element?: JSX.Element;
}[] = [
  {
    link: "/",
    label: "Home",
    element: <HomePage />,
  },
  {
    link: "/reservations",
    label: "My Reservations",
    element: <ReservationsPage />,
  },
  {
    link: "/signin",
    label: "Sign In",
    element: <SignInPage />,
  },
  {
    link: "/time-slots",
    label: "Book Time Slot",
    element: <TimeSlots />,
  },
];