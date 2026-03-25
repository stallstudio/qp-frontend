import { useState, useEffect, useCallback, useRef } from "react";

export function useAutoRefresh(
  lastUpdate: string,
  onRefresh?: () => Promise<void>,
  refreshInterval: number = 60000,
) {
  const [timeSinceLastUpdate, setTimeSinceLastUpdate] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [justUpdated, setJustUpdated] = useState(false);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const handleRefresh = useCallback(async () => {
    if (!onRefresh || isRefreshing) return;

    setIsRefreshing(true);
    try {
      await onRefresh();
      // Trigger animation on successful update
      setJustUpdated(true);
      setTimeout(() => setJustUpdated(false), 1000);
    } catch (error) {
      console.error("Refresh failed:", error);
    } finally {
      setIsRefreshing(false);
    }
  }, [onRefresh, isRefreshing]);

  const clearIntervals = useCallback(() => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }
  }, []);

  const startIntervals = useCallback(
    (calculateRemainingSeconds: () => number) => {
      clearIntervals();

      // Immediate update
      setTimeSinceLastUpdate(calculateRemainingSeconds());

      // Countdown interval (every second)
      countdownIntervalRef.current = setInterval(() => {
        setTimeSinceLastUpdate(calculateRemainingSeconds());
      }, 1000);

      // Refresh interval (every 2 seconds)
      refreshIntervalRef.current = setInterval(() => {
        const newTimeSinceLastUpdate = calculateRemainingSeconds();

        // If time has elapsed and not too far past
        if (newTimeSinceLastUpdate <= 0 && newTimeSinceLastUpdate > -20) {
          handleRefresh();
        }
      }, 2000);
    },
    [clearIntervals, handleRefresh],
  );

  useEffect(() => {
    const calculateRemainingSeconds = () => {
      const lastUpdateTime = new Date(lastUpdate).getTime();
      const targetTime = lastUpdateTime + refreshInterval;
      const currentTime = Date.now();

      const remainingMs = targetTime - currentTime;
      const remainingSeconds = Math.ceil(remainingMs / 1000);

      return remainingSeconds;
    };

    startIntervals(calculateRemainingSeconds);

    return clearIntervals;
  }, [lastUpdate, refreshInterval, startIntervals, clearIntervals]);

  return {
    timeSinceLastUpdate,
    isRefreshing,
    justUpdated,
    handleRefresh,
    startIntervals,
    clearIntervals,
  };
}
