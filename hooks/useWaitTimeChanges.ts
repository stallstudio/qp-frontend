import { useState, useEffect, useRef } from "react";
import { WaitTime } from "@/types/waitTime";

export function useWaitTimeChanges(
  waitTimes: WaitTime[],
  highlightDuration: number = 1000,
) {
  const [changedRides, setChangedRides] = useState<Set<string>>(new Set());
  const previousWaitTimesRef = useRef<WaitTime[]>(waitTimes);

  useEffect(() => {
    const previous = previousWaitTimesRef.current;
    const current = waitTimes;

    const changed = new Set<string>();

    current.forEach((currentRide) => {
      const previousRide = previous.find(
        (r) => r.rideName === currentRide.rideName,
      );

      if (previousRide) {
        // Check each queue type for changes
        currentRide.queues.forEach((currentQueue) => {
          const previousQueue = previousRide.queues.find(
            (q) => q.type === currentQueue.type,
          );

          if (previousQueue) {
            // Check if wait time or status changed for this queue type
            if (
              previousQueue.waitTime !== currentQueue.waitTime ||
              previousQueue.status !== currentQueue.status
            ) {
              changed.add(`${currentRide.rideName}-${currentQueue.type}`);
            }
          } else {
            // New queue type added
            changed.add(`${currentRide.rideName}-${currentQueue.type}`);
          }
        });
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
