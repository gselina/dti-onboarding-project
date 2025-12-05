import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Container,
  Grid,
  Card,
  Text,
  Title,
  Badge,
  Group,
  Stack,
  Button,
  Paper,
  SimpleGrid,
  Loader,
  Center,
} from "@mantine/core";
import {
  Clock,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  HelpCircle,
  Phone,
  MapPin,
  Package,
  Info,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  fetchCrowdLevels,
  fetchPackageStats,
  type CrowdStats,
  type PackageStats,
} from "../utils/api";
import { isWithinRPCCHours, getRPCCHoursString } from "../utils/rpccHours";

const HomePage = () => {
  const [crowdStats, setCrowdStats] = useState<CrowdStats | null>(null);
  const [packageStats, setPackageStats] = useState<PackageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        const [crowdData, packageData] = await Promise.all([
          fetchCrowdLevels(),
          fetchPackageStats(),
        ]);
        setCrowdStats(crowdData);
        setPackageStats(packageData);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to load data";
        setError(errorMessage);
        console.error("Error loading data:", err);
      } finally {
        setLoading(false);
      }
    };

    loadData();

    // Refresh data every 30 seconds
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  const getCrowdBadgeColor = (level: string) => {
    switch (level) {
      case "High":
        return "red";
      case "Medium":
        return "yellow";
      default:
        return "green";
    }
  };

  const getCrowdBgColor = (level: string) => {
    switch (level) {
      case "High":
        return "#FFFAFA";
      case "Medium":
        return "#FFFCF5";
      default:
        return "#F8FFF5";
    }
  };

  const getCrowdBorderColor = (level: string) => {
    switch (level) {
      case "High":
        return "#E1B4B4";
      case "Medium":
        return "#E1DAB4";
      default:
        return "#CAE1B4";
    }
  };

  // Generate a deterministic "random" value based on a string seed
  const seededRandom = (seed: string): number => {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      const char = seed.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    // Convert to 0-1 range
    return Math.abs(hash) / 2147483647;
  };

  // Generate mock predicted data based on today's historical data
  const generateMockPredictedData = (
    historicalData: { time: string; value: number }[]
  ): { time: string; value: number; predicted?: number }[] => {
    if (!historicalData || historicalData.length === 0) {
      return [];
    }

    // Generate predicted values with significant variation (deterministic based on time)
    // This simulates what yesterday's traffic might have looked like
    return historicalData.map((point) => {
      // Use time as seed for deterministic "random" values
      const random1 = seededRandom(point.time);
      const random2 = seededRandom(point.time + "offset");

      // Add significant variation: ±60% of the current value, but keep it within 0-100
      const variation = (random1 - 0.5) * 1.2; // -60% to +60%
      // Also add a base offset to make it more different
      const offset = (random2 - 0.5) * 30; // -15 to +15
      const predictedValue = Math.max(
        0,
        Math.min(100, Math.round(point.value * (1 + variation) + offset))
      );

      return {
        ...point,
        predicted: predictedValue,
      };
    });
  };

  // Filter historical data to only include actual traffic points up to current time
  const filterDataUpToCurrentTime = (
    historicalData: { time: string; value: number }[]
  ): { time: string; value: number }[] => {
    if (!historicalData || historicalData.length === 0) {
      return [];
    }

    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    return historicalData.filter((point) => {
      // Parse time string (e.g., "2:00PM" or "11:00AM")
      const timeStr = point.time.trim().toUpperCase();
      const isPM = timeStr.includes("PM");
      const timeMatch = timeStr.match(/(\d+):(\d+)/);

      if (!timeMatch) {
        return true; // Keep if we can't parse (shouldn't happen)
      }

      let hour = parseInt(timeMatch[1], 10);
      const minute = parseInt(timeMatch[2], 10);

      // Convert to 24-hour format
      if (isPM && hour !== 12) {
        hour += 12;
      } else if (!isPM && hour === 12) {
        hour = 0;
      }

      // Only keep points up to current time
      if (hour < currentHour) {
        return true; // Before current hour, keep it
      } else if (hour === currentHour) {
        return minute <= currentMinute; // Same hour, check minutes
      } else {
        return false; // After current time, filter it out
      }
    });
  };

  // Filter actual traffic data to only show up to current time
  const filteredHistoricalData = crowdStats?.historicalData
    ? filterDataUpToCurrentTime(crowdStats.historicalData)
    : [];

  // Calculate crowd level from current hour's value in historical data
  const getCurrentCrowdLevel = (): "Low" | "Medium" | "High" => {
    if (!filteredHistoricalData || filteredHistoricalData.length === 0) {
      return "Low";
    }

    // Get the most recent data point (should be current hour)
    const currentDataPoint =
      filteredHistoricalData[filteredHistoricalData.length - 1];
    const currentValue = currentDataPoint?.value || 0;

    // Determine crowd level based on thresholds
    if (currentValue >= 30) {
      return "High";
    } else if (currentValue >= 10) {
      return "Medium";
    } else {
      return "Low";
    }
  };

  // Get current crowd level from historical data
  const currentCrowdLevel = getCurrentCrowdLevel();

  // Calculate estimated wait time based on current crowd level
  const getEstimatedWaitTime = (level: "Low" | "Medium" | "High"): string => {
    switch (level) {
      case "High":
        return "20-30 minutes";
      case "Medium":
        return "10-20 minutes";
      case "Low":
      default:
        return "0-10 minutes";
    }
  };

  const estimatedWaitTime = getEstimatedWaitTime(currentCrowdLevel);

  // Generate predicted data from filtered data (so predicted line also stops at current time)
  // But predicted values are generated deterministically, so they'll be consistent
  const chartData =
    filteredHistoricalData.length > 0
      ? generateMockPredictedData(filteredHistoricalData)
      : [];

  const isCurrentlyOpen = isWithinRPCCHours();
  const currentDay = new Date().getDay();
  const hoursString = getRPCCHoursString(currentDay);

  return (
    <div
      style={{
        backgroundColor: "#FFFFFF",
        minHeight: "100vh",
        minWidth: "100vw",
      }}
    >
      <Container size="xl" py={80}>
        <Stack spacing="xl" align="center" style={{ textAlign: "center" }}>
          <Title
            order={1}
            size={48}
            weight={700}
            style={{ color: "#000000", lineHeight: 1.2 }}
          >
            <span style={{ color: "#7A5848" }}>Plan Your Pickup</span> @ RPCC
          </Title>
          <Text size="lg" style={{ color: "#6B5D4F", maxWidth: "600px" }}>
            Get real-time and historical crowd data so you always pick up your
            packages at the perfect moment. See when RPCC is busy and plan
            ahead.
          </Text>
          <Button
            component={Link}
            to="/reservations"
            size="lg"
            variant="filled"
            component={Link}
            to="/time-slots"
            sx={{
              backgroundColor: "#000000",
              color: "#FFFFFF",
              padding: "12px 32px",
              border: "1px solid #000000",
              transition: "background-color 1000ms ease, color 1000ms ease",
              "&:hover": {
                backgroundColor: "#FFFFFF",
                color: "#000000",
              },
            }}
          >
            Reserve a time slot
          </Button>
        </Stack>
      </Container>

      <Container size="xl" py="xl">
        <Grid gutter="md">
          <Grid.Col span={12} md={6}>
            <Stack spacing="md" style={{ height: "100%" }}>
              <Card
                shadow="sm"
                padding="lg"
                radius="md"
                withBorder
                style={{ backgroundColor: "#FFFFFF", flex: 1 }}
              >
                <Stack spacing="md">
                  <Title order={2} style={{ color: "#000000" }}>
                    Crowd Level
                  </Title>

                  <Paper
                    p="md"
                    style={{
                      backgroundColor: getCrowdBgColor(currentCrowdLevel),
                      border:
                        "1px solid " + getCrowdBorderColor(currentCrowdLevel),
                    }}
                  >
                    <Stack spacing="sm">
                      <Group spacing="xs">
                        {loading ? (
                          <Loader size="sm" />
                        ) : error ? (
                          <Text size="sm" style={{ color: "#EF4444" }}>
                            Error loading data
                          </Text>
                        ) : !isCurrentlyOpen ? (
                          <Badge
                            color="gray"
                            variant="light"
                            size="lg"
                            style={{
                              fontSize: "14px",
                            }}
                          >
                            Closed
                          </Badge>
                        ) : (
                          <Badge
                            color={getCrowdBadgeColor(currentCrowdLevel)}
                            variant="light"
                            size="lg"
                            style={{
                              fontSize: "14px",
                            }}
                          >
                            {currentCrowdLevel} Crowd
                          </Badge>
                        )}
                      </Group>
                      {!isCurrentlyOpen ? (
                        <Text size="sm" style={{ color: "#6B5D4F" }}>
                          RPCC is currently closed. Today's hours: {hoursString}
                        </Text>
                      ) : (
                        <Text size="sm" style={{ color: "#6B5D4F" }}>
                          Estimated Wait Time: {estimatedWaitTime}
                        </Text>
                      )}
                    </Stack>
                  </Paper>

                  <Paper p="md" style={{ backgroundColor: "#FFFFFF" }}>
                    <Stack spacing="md">
                      <Text
                        size="sm"
                        weight={600}
                        style={{ color: "#000000", textTransform: "uppercase" }}
                      >
                        Today's Traffic Levels
                      </Text>
                      <div style={{ width: "100%", height: "200px" }}>
                        {loading ? (
                          <Center h="100%">
                            <Loader />
                          </Center>
                        ) : error ? (
                          <Center h="100%">
                            <Text size="sm" style={{ color: "#EF4444" }}>
                              Error loading chart
                            </Text>
                          </Center>
                        ) : (
                          /* @ts-expect-error Recharts has React type compatibility issues with React 18 */
                          <ResponsiveContainer width="100%" height="100%">
                            {/* @ts-expect-error Recharts LineChart type compatibility */}
                            <LineChart
                              data={
                                chartData.length > 0
                                  ? chartData
                                  : [
                                      {
                                        time: "5:00PM",
                                        value: 45,
                                        predicted: 30,
                                      },
                                      {
                                        time: "6:00PM",
                                        value: 62,
                                        predicted: 45,
                                      },
                                      {
                                        time: "7:00PM",
                                        value: 38,
                                        predicted: 35,
                                      },
                                    ]
                              }
                            >
                              {/* @ts-expect-error Recharts CartesianGrid type compatibility */}
                              <CartesianGrid
                                strokeDasharray="4 4"
                                stroke="#E8E3D5"
                              />
                              {/* @ts-expect-error Recharts XAxis type compatibility */}
                              <XAxis
                                dataKey="time"
                                stroke="#6B5D4F"
                                style={{ fontSize: "12px" }}
                              />
                              {/* @ts-expect-error Recharts YAxis type compatibility */}
                              <YAxis
                                stroke="#6B5D4F"
                                style={{ fontSize: "11px" }}
                                domain={[0, 100]}
                                tickFormatter={(value) => `${value}`}
                              />
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: "#FAF7F2",
                                  border: "1px solid #ECE5E2",
                                  borderRadius: "4px",
                                  color: "#7A5848",
                                }}
                                labelStyle={{
                                  color: "#7A5848",
                                  fontWeight: 600,
                                }}
                              />
                              {/* @ts-expect-error Recharts Line type compatibility */}
                              <Line
                                type="monotone"
                                dataKey="value"
                                stroke="#7A5848"
                                strokeWidth={3}
                                dot={{ fill: "#7A5848", r: 4 }}
                                activeDot={{ r: 6 }}
                                name="Actual"
                              />
                              {/* @ts-expect-error Recharts Line type compatibility */}
                              <Line
                                type="monotone"
                                dataKey="predicted"
                                stroke="#D3D3D3"
                                strokeWidth={2}
                                strokeDasharray="5 5"
                                dot={false}
                                connectNulls={false}
                                name="Predicted Traffic"
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        )}
                      </div>
                    </Stack>
                  </Paper>
                </Stack>
              </Card>

              <Card
                shadow="sm"
                padding="lg"
                radius="md"
                withBorder
                style={{ backgroundColor: "#FFFFFF" }}
              >
                <Stack spacing="md">
                  <Title order={2} style={{ color: "#000000" }}>
                    Quick Actions
                  </Title>

                  <SimpleGrid cols={2} spacing="md">
                    <Paper
                      p="md"
                      component="a"
                      href="https://scl.cornell.edu/residential-life/service-centers-and-mail/service-center-north-campus"
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{
                        backgroundColor: "#FAF7F2",
                        cursor: "pointer",
                        minHeight: "120px",
                        border: "1px solid #ECE5E2",
                        borderRadius: "10px",
                        transition:
                          "background-color 1000ms ease, color 1000ms ease",
                        "&:hover": {
                          backgroundColor: "#D9D0CC",
                        },
                      }}
                    >
                      <Stack spacing="xs" align="center">
                        <HelpCircle size={32} color="#7A5848" />
                        <Text weight={600} style={{ color: "#7A5848" }}>
                          FAQ
                        </Text>
                        <Text
                          size="xs"
                          style={{
                            color: "#6B5D4F",
                            textAlign: "center",
                          }}
                        >
                          Learn more about services and policies.
                        </Text>
                      </Stack>
                    </Paper>

                    <Paper
                      component="a"
                      href="mailto:scl-student-srv@mail.scl.cornell.edu"
                      p="md"
                      sx={{
                        backgroundColor: "#FAF7F2",
                        cursor: "pointer",
                        minHeight: "120px",
                        border: "1px solid #ECE5E2",
                        borderRadius: "10px",
                        transition:
                          "background-color 1000ms ease, color 1000ms ease",
                        "&:hover": {
                          backgroundColor: "#D9D0CC",
                        },
                      }}
                    >
                      <Stack spacing="xs" align="center">
                        <AlertCircle size={32} color="#7A5848" />
                        <Text weight={600} style={{ color: "#7A5848" }}>
                          Report Issue
                        </Text>
                        <Text
                          size="xs"
                          style={{ color: "#6B5D4F", textAlign: "center" }}
                        >
                          Email staff to report problems.
                        </Text>
                      </Stack>
                    </Paper>

                    <Paper
                      component="a"
                      href="mailto:scl-student-srv@mail.scl.cornell.edu"
                      p="md"
                      sx={{
                        backgroundColor: "#FAF7F2",
                        cursor: "pointer",
                        minHeight: "120px",
                        border: "1px solid #ECE5E2",
                        borderRadius: "10px",
                        transition:
                          "background-color 1000ms ease, color 1000ms ease",
                        "&:hover": {
                          backgroundColor: "#D9D0CC",
                        },
                      }}
                    >
                      <Stack spacing="xs" align="center">
                        <Phone size={32} color="#7A5848" />
                        <Text weight={600} style={{ color: "#7A5848" }}>
                          Contact Staff
                        </Text>
                        <Text
                          size="xs"
                          style={{ color: "#6B5D4F", textAlign: "center" }}
                        >
                          Get in touch with the RPCC mail team.
                        </Text>
                      </Stack>
                    </Paper>

                    <Paper
                      component="a"
                      href="https://maps.app.goo.gl/iSUdJZi1cnrDyZTK6"
                      target="_blank"
                      rel="noopener noreferrer"
                      p="md"
                      sx={{
                        backgroundColor: "#FAF7F2",
                        cursor: "pointer",
                        minHeight: "120px",
                        border: "1px solid #ECE5E2",
                        borderRadius: "10px",
                        transition:
                          "background-color 1000ms ease, color 1000ms ease",
                        "&:hover": {
                          backgroundColor: "#D9D0CC",
                        },
                      }}
                    >
                      <Stack spacing="xs" align="center">
                        <MapPin size={32} color="#7A5848" />
                        <Text weight={600} style={{ color: "#7A5848" }}>
                          Directions
                        </Text>
                        <Text
                          size="xs"
                          style={{ color: "#6B5D4F", textAlign: "center" }}
                        >
                          Find directions to RPCC.
                        </Text>
                      </Stack>
                    </Paper>
                  </SimpleGrid>
                </Stack>
              </Card>
            </Stack>
          </Grid.Col>

          <Grid.Col span={12} md={6}>
            <Stack spacing="md" style={{ height: "100%" }}>
              <Card
                shadow="sm"
                padding="lg"
                radius="md"
                withBorder
                style={{ backgroundColor: "#FFFFFF" }}
              >
                <Stack spacing="md">
                  <Title order={2} style={{ color: "#000000" }}>
                    Today's Stats
                  </Title>

                  <Paper
                    p="md"
                    style={{ backgroundColor: "#FAF7F2", borderRadius: "10px" }}
                  >
                    <Stack spacing="xs">
                      <Group position="apart" align="center">
                        <Group spacing="xs">
                          <Package size={20} color="#000000" />
                          <Text
                            size="sm"
                            weight={500}
                            style={{ color: "#000000" }}
                          >
                            Packages Today
                          </Text>
                        </Group>
                        {packageStats && (
                          <Group spacing={4}>
                            {packageStats.packagesChange >= 0 ? (
                              <TrendingUp size={16} color="#4CAF50" />
                            ) : (
                              <TrendingDown size={16} color="#EF4444" />
                            )}
                            <Text
                              size="sm"
                              weight={600}
                              style={{
                                color:
                                  packageStats.packagesChange >= 0
                                    ? "#4CAF50"
                                    : "#EF4444",
                              }}
                            >
                              {packageStats.packagesChange >= 0 ? "+" : ""}
                              {packageStats.packagesChange}%
                            </Text>
                          </Group>
                        )}
                      </Group>
                      {loading ? (
                        <Loader size="sm" />
                      ) : (
                        <Text
                          size="xl"
                          weight={700}
                          style={{ color: "#619F40" }}
                        >
                          {packageStats?.packagesToday || 0}
                        </Text>
                      )}
                    </Stack>
                  </Paper>

                  <Paper
                    p="md"
                    style={{ backgroundColor: "#FAF7F2", borderRadius: "10px" }}
                  >
                    <Stack spacing="xs">
                      <Group position="apart" align="center">
                        <Group spacing="xs">
                          <Clock size={20} color="#000000" />
                          <Text
                            size="sm"
                            weight={500}
                            style={{ color: "#000000" }}
                          >
                            Average Wait Time
                          </Text>
                        </Group>
                        {packageStats && (
                          <Group spacing={4}>
                            {packageStats.waitTimeChange >= 0 ? (
                              <TrendingUp size={16} color="#EF4444" />
                            ) : (
                              <TrendingDown size={16} color="#4CAF50" />
                            )}
                            <Text
                              size="sm"
                              weight={600}
                              style={{
                                color:
                                  packageStats.waitTimeChange >= 0
                                    ? "#EF4444"
                                    : "#4CAF50",
                              }}
                            >
                              {packageStats.waitTimeChange >= 0 ? "+" : ""}
                              {packageStats.waitTimeChange}%
                            </Text>
                          </Group>
                        )}
                      </Group>
                      {loading ? (
                        <Loader size="sm" />
                      ) : (
                        <Text
                          size="xl"
                          weight={700}
                          style={{ color: "#619F40" }}
                        >
                          {packageStats?.averageWaitTime || 0} minutes
                        </Text>
                      )}
                    </Stack>
                  </Paper>
                </Stack>
              </Card>

              <Card
                shadow="sm"
                padding="lg"
                radius="md"
                withBorder
                style={{ backgroundColor: "#FFFFFF", flex: 1 }}
              >
                <Stack spacing="md">
                  <Title order={2} style={{ color: "#000000" }}>
                    Announcements
                  </Title>

                  <Paper
                    p="md"
                    style={{
                      backgroundColor: "#FFFFFF",
                      border: "1px solid #E8E3D5",
                    }}
                  >
                    <Stack spacing="sm">
                      <Group spacing="xs">
                        <Info size={18} color="#000000" />
                        <Text weight={600} style={{ color: "#000000" }}>
                          Holiday Hours
                        </Text>
                      </Group>
                      <Text size="sm" style={{ color: "#6B5D4F" }}>
                        Hours will be adjusted to 8am-5pm on weekends for
                        Thanksgiving week.
                      </Text>
                    </Stack>
                  </Paper>

                  <Paper
                    p="md"
                    style={{
                      backgroundColor: "#FFFFFF",
                      border: "1px solid #E8E3D5",
                    }}
                  >
                    <Stack spacing="sm">
                      <Group spacing="xs">
                        <Info size={18} color="#000000" />
                        <Text weight={600} style={{ color: "#000000" }}>
                          High Volume Packages
                        </Text>
                      </Group>
                      <Text size="sm" style={{ color: "#6B5D4F" }}>
                        Please allow extra time for newly delivered items to be
                        processed into the system.
                      </Text>
                    </Stack>
                  </Paper>

                  <Paper
                    p="md"
                    style={{
                      backgroundColor: "#FFFFFF",
                      border: "1px solid #E8E3D5",
                    }}
                  >
                    <Stack spacing="sm">
                      <Group spacing="xs">
                        <Info size={18} color="#000000" />
                        <Text weight={600} style={{ color: "#000000" }}>
                          Pickup Relocation
                        </Text>
                      </Group>
                      <Text size="sm" style={{ color: "#6B5D4F" }}>
                        All student mail will be distributed from the third
                        floor of RPCC temporarily.
                      </Text>
                    </Stack>
                  </Paper>

                  <Paper
                    p="md"
                    style={{
                      backgroundColor: "#FFFFFF",
                      border: "1px solid #E8E3D5",
                    }}
                  >
                    <Stack spacing="sm">
                      <Group spacing="xs">
                        <Info size={18} color="#000000" />
                        <Text weight={600} style={{ color: "#000000" }}>
                          Lost Item Recovery
                        </Text>
                      </Group>
                      <Text size="sm" style={{ color: "#6B5D4F" }}>
                        A small number of unclaimed packages were moved to the
                        Lost & Found desk. Please contact staff if you believe
                        this affects you.
                      </Text>
                    </Stack>
                  </Paper>
                </Stack>
              </Card>
            </Stack>
          </Grid.Col>
        </Grid>
      </Container>
    </div>
  );
};

export default HomePage;
