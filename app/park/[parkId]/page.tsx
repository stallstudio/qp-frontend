"use client";

import { Badge } from "@/components/ui/badge";
import { ChevronRight } from "lucide-react";
import { use, useEffect, useState } from "react";

export interface ParkData {
  name: string;
  isOpen: boolean;
  timezone: string;
  schedules: Schedule[] | null;
  waitTimes: WaitTime[] | null;
}

export interface Schedule {
  type: string;
  openTime: string;
  closeTime: string;
}

export interface WaitTime {
  parkId: string;
  rideId: string;
  waitTime: number;
  status: "open" | "closed" | "down";
  customText: string | null;
  timestamp: string;
  rideName?: string;
}

function getWaitTimeBadgeColor(minutes: number): string {
  if (minutes === -1) return "bg-gray-400";
  if (minutes <= 20) return "bg-green-500";
  if (minutes <= 45) return "bg-orange-400";
  return "bg-red-500";
}

function getStatusBadgeColor(status: string): string {
  if (status === "open") return "bg-green-500";
  if (status === "down") return "bg-orange-500";
  return "bg-red-500";
}

function getStatusText(status: string): string {
  if (status === "open") return "OPEN";
  if (status === "down") return "BROKEN DOWN";
  return "CLOSED";
}

export default function ParkPage({
  params,
}: {
  params: Promise<{ parkId: string }>;
}) {
  const { parkId } = use(params);
  const [parkData, setParkData] = useState<ParkData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchParkData = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/parks/${parkId}`);
        console.log(response);
        const data = await response.json();
        setParkData(data);
      } catch (error) {
        console.error("Error fetching park data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchParkData();
  }, [parkId]);

  const getSchedule = () => {
    if (!parkData?.schedules) return "inconnu";
    const openTime = new Date(parkData.schedules[0].openTime);
    const closeTime = new Date(parkData.schedules[0].closeTime);
    return `${openTime.getHours()}:${openTime
      .getMinutes()
      .toString()
      .padStart(2, "0")} - ${closeTime.getHours()}:${closeTime
      .getMinutes()
      .toString()
      .padStart(2, "0")}`;
  };

  const getLastUpdate = () => {
    if (!parkData?.waitTimes) return "inconnu";
    const lastUpdate = new Date(parkData.waitTimes[0].timestamp);
    return lastUpdate.toLocaleString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (!parkId) {
    return <div>Park not found</div>;
  }

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!parkData) {
    return <div>Park not found</div>;
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Hero Section */}
      <div
        className="relative h-[280px] bg-cover bg-center"
        style={{
          backgroundImage: "url('/header.jpg')",
        }}
      >
        {/* Overlay */}
        <div className="absolute inset-0 bg-black/40" />

        {/* Content */}
        <div className="relative h-full flex flex-col items-center justify-center text-white px-4">
          {/* Breadcrumb */}
          <div className="absolute top-8 left-8 flex items-center gap-2 text-sm font-medium">
            <span className="hover:underline cursor-pointer">HOME</span>
            <ChevronRight className="w-4 h-4" />
            <span className="uppercase">{parkData.name}</span>
          </div>

          {/* Park Name */}
          <h1 className="text-5xl font-bold mb-6 tracking-wide">
            {parkData.name}
          </h1>

          {/* Park Info */}
          <div className="text-center space-y-1">
            <p className="font-semibold">
              The park is currently
              {parkData.isOpen ? " OPEN" : " CLOSED"}
            </p>
            <p className="font-semibold">Horaires du jour: {getSchedule()}</p>
            <p>LAST UPDATE: {getLastUpdate()}</p>
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-[2fr_1fr_1fr] gap-4 px-6 py-2 bg-white border-b border-neutral-200">
            <div className="text-sm font-semibold text-neutral-900 uppercase tracking-wide">
              Attraction
            </div>
            <div className="text-sm font-semibold text-neutral-900 uppercase tracking-wide text-center">
              Wait Time
            </div>
            <div className="text-sm font-semibold text-neutral-900 uppercase tracking-wide text-center">
              Status
            </div>
          </div>

          {/* Table Body */}
          <div className="divide-y divide-neutral-100">
            {parkData.waitTimes ? (
              parkData.waitTimes
                .sort((a, b) => b.waitTime - a.waitTime)
                .map((ride, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-[2fr_1fr_1fr] gap-4 px-6 py-2 hover:bg-neutral-50 transition-colors"
                  >
                    {/* Attraction Name */}
                    <div className="text-neutral-900 font-normal">
                      {ride.rideName}
                    </div>

                    {/* Wait Time Badge */}
                    <div className="flex justify-center">
                      <Badge
                        className={`${getWaitTimeBadgeColor(ride.waitTime)}`}
                      >
                        {ride.waitTime === -1
                          ? "UNAVAILABLE"
                          : `${ride.waitTime} minutes`}
                      </Badge>
                    </div>

                    {/* Status Badge */}
                    <div className="flex justify-center">
                      <Badge className={`${getStatusBadgeColor(ride.status)}`}>
                        {getStatusText(ride.status)}
                      </Badge>
                    </div>
                  </div>
                ))
            ) : (
              <div className="flex items-center justify-center py-5">
                No attractions found
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
