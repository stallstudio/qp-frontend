export type WaitTime = {
  parkId: string;
  rideId: string | null; // Format temporaire: "parkId:apiRideId" (ex: "walibi-belgium:105") - Futur: ID de la DB
  rideName: string;
  externalId: string;
  waitTime: number;
  status: "open" | "closed" | "down" | "maintenance";
  customText: string | null;
  timestamp: string; // ISO 8601 UTC
};
