export type QueueTime = {
  type: string;
  waitTime: number;
  status: "open" | "closed" | "down" | "maintenance";
};

export type WaitTime = {
  rideName: string;
  queues: QueueTime[];
};
