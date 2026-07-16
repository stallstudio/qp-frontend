export interface DayAffluence {
  date: string;
  /** Median ride ratio. 1.0 = a typical day at this park. */
  index: number;
  /** 0 = the park's quietest recorded day, 1 = its busiest. UI colours by this. */
  rank: number;
  rideCount: number;
}

export interface DayOpeningHour {
  type: string;
  openTime: string | null; // ISO (UTC)
  closeTime: string | null;
}

export interface ChartSegment {
  start: string;
  end: string;
  waitTime: number;
  status: string;
}

export interface RideDayStat {
  rideId: number;
  rideName: string;
  averageWait: number;
  operated: boolean; // ran at all that day (had ≥1 open reading)
  status: string; // dominant status, for the label when it never operated
  chartData: ChartSegment[];
}

export interface DayProfilePoint {
  hour: number;
  avgWait: number | null;
}

export interface ParkDayStats {
  park: { id: number; name: string; timezone: string };
  date: string;
  openingHours: DayOpeningHour[];
  chartBounds: { start: string; end: string };
  rides: RideDayStat[];
  dayProfile: DayProfilePoint[];
}
