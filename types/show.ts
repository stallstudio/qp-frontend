export interface ShowSchedule {
  startTime: string;
  endTime?: string | null;
}

export interface ShowTime {
  showName: string;
  duration: number;
  schedules: ShowSchedule[];
}
