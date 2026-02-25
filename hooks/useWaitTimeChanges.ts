import { useState, useEffect, useRef } from "react";
import { WaitTime } from "@/types/waitTime";

export function useWaitTimeChanges(
  waitTimes: WaitTime[],
  highlightDuration: number = 1000
) {
  const [changedRides, setChangedRides] = useState<Set<string>>(new Set());
  const previousWaitTimesRef = useRef<WaitTime[]>(waitTimes);

  useEffect(() => {
    const previous = previousWaitTimesRef.current;
    const current = waitTimes;

    const changed = new Set<string>();

    current.forEach((currentRide) => {
      const previousRide = previous.find(
        (r) => r.rideName === currentRide.rideName
      );

      if (previousRide) {
        // Check if wait time or status changed
        if (
          previousRide.waitTime !== currentRide.waitTime ||
          previousRide.status !== currentRide.status
        ) {
          changed.add(currentRide.rideName);
        }
      }
    });

    if (changed.size > 0) {
      setChangedRides(changed);
      // Clear changed rides after specified duration
      setTimeout(() => setChangedRides(new Set()), highlightDuration);
    }

    previousWaitTimesRef.current = current;
  }, [waitTimes, highlightDuration]);

  return changedRides;
}
