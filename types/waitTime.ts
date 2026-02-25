export type WaitTime = {
  rideName: string;
  waitTime: number;
  status: "open" | "closed" | "down" | "maintenance";
};
