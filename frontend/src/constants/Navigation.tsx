import HomePage from "../pages/Home";

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
    link: "/packages",
    label: "My Packages",
    element: <HomePage />,
  },
  {
    link: "/signin",
    label: "Sign In",
    element: <HomePage />,
  },
];
