"use client";

import { Card, CardContent, CardTitle } from "@/components/ui/card";
import ParkCard from "./park-card";
import { ParkList } from "@/types/api";

interface ParkCategoryCardProps {
  groupName: string;
  parks: ParkList[];
}

export default function ParkCategoryCard({
  groupName,
  parks,
}: ParkCategoryCardProps) {
  return (
    <Card className="p-0">
      <CardContent className="p-0">
        <CardTitle className="text-xl font-bold border-b px-4 py-2">
          {groupName}
        </CardTitle>
        <div className="py-2 px-2 space-y-1">
          {parks.map((park) => (
            <ParkCard key={park.identifier} park={park} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
