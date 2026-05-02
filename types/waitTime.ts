export type WaitTimeStatus = "open" | "closed" | "down" | "maintenance";

export type TimeSlot = {
  start: string; // "HH:mm" (24h, heure locale du parc)
  end: string;   // "HH:mm" (24h, heure locale du parc)
};

export type QueueTime = {
  type: string;
  waitTime: number;
  status: WaitTimeStatus;
  timeSlot: TimeSlot | null;
};

export type WaitTime = {
  rideName: string;
  queues: QueueTime[];
};
