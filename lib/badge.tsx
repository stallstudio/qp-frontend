import { WaitTime } from "@/types/waitTime";

function getWaitTimeColorClass(waitTime: number): string {
  if (waitTime < 0) {
    return "bg-gray-100 text-gray-800";
  }
  if (waitTime <= 20) {
    return "bg-green-100 text-green-800";
  }
  if (waitTime <= 45) {
    return "bg-orange-100 text-orange-800";
  }
  return "bg-red-100 text-red-800";
}

function getWaitTimeBadge(waitTime: number) {
  const colorClass = getWaitTimeColorClass(waitTime);

  return (
    <span
      className={`px-2 py-1 rounded-full text-xs font-medium ${colorClass}`}
    >
      {waitTime === -1 ? "Unavailable" : `${waitTime} min`}
    </span>
  );
}

function getStatusColorClass(status: WaitTime["status"]) {
  if (status === "open") {
    return "bg-green-100 text-green-800";
  }
  if (status === "closed") {
    return "bg-red-100 text-red-800";
  }
  if (status === "down") {
    return "bg-orange-100 text-orange-800";
  }
  if (status === "maintenance") {
    return "bg-red-100 text-red-800";
  }
}

function getStatusDotColorClass(status: WaitTime["status"]) {
  if (status === "open") {
    return "bg-green-400";
  }
  if (status === "closed") {
    return "bg-red-400";
  }
  if (status === "down") {
    return "bg-orange-300";
  }
  if (status === "maintenance") {
    return "bg-red-400";
  }
}

function getStatusLabel(status: WaitTime["status"]) {
  if (status === "open") {
    return "Open";
  }
  if (status === "closed") {
    return "Closed";
  }
  if (status === "down") {
    return "Down";
  }
  if (status === "maintenance") {
    return "Maintenance";
  }
}

function getStatusBadge(status: WaitTime["status"]) {
  const colorClass = getStatusColorClass(status);
  const dotColorClass = getStatusDotColorClass(status);

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${colorClass}`}
    >
      <div className={`w-2 h-2 ${dotColorClass} rounded-full`}></div>
      {getStatusLabel(status)}
    </span>
  );
}

function getParkStatusDot(status: "open" | "closed" | "unknown") {
  if (status === "open") {
    return (
      <span className="w-2 h-2 bg-green-500 rounded-full relative">
        <span className="absolute inset-0 bg-green-500 rounded-full animate-ping"></span>
      </span>
    );
  }
  if (status === "closed") {
    return <span className="w-2 h-2 bg-red-500 rounded-full"></span>;
  }

  return null;
}

export { getWaitTimeBadge, getStatusBadge, getParkStatusDot };
