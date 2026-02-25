import { useEffect } from "react";

export function usePageVisibility(
  lastUpdate: string,
  onVisible: () => void,
  onHidden: () => void,
  autoRefreshThreshold: number = 60000
) {
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        // Page became visible - check if we need to refresh
        const lastUpdateTime = new Date(lastUpdate).getTime();
        const currentTime = Date.now();
        const timeSinceUpdate = currentTime - lastUpdateTime;

        // If more than threshold has passed, trigger callback
        if (timeSinceUpdate > autoRefreshThreshold) {
          onVisible();
        } else {
          // Just restart intervals without refresh
          onVisible();
        }
      } else {
        // Page became hidden
        onHidden();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [lastUpdate, onVisible, onHidden, autoRefreshThreshold]);
}
