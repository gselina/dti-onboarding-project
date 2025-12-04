import { BACKEND_BASE_PATH } from "../constants/Navigation";

export type CrowdDataPoint = {
  time: string;
  value: number;
};

export type CrowdStats = {
  currentCrowdLevel: "Low" | "Medium" | "High";
  estimatedWaitTime: string;
  historicalData: CrowdDataPoint[];
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

