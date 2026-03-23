export type WaitTimeStatus = "open" | "closed" | "down" | "maintenance";

export type QueueTime = {
  type: string;
  waitTime: number;
  status: WaitTimeStatus;
};

export type WaitTime = {
  rideName: string;
  queues: QueueTime[];
};
