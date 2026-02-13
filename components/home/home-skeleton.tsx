"use client";

import HomeHeader from "./header";
import { Skeleton } from "../ui/skeleton";
import Footer from "../ui/footer";
import { Tabs, TabsList, TabsTrigger } from "../ui/tabs";
import { TrendingUp } from "lucide-react";

export default function HomeSkeleton() {
  return (
    <div className="flex min-h-screen w-full mx-auto max-w-4xl flex-col px-4">
      {/* Skeleton Content */}
      <main className="flex-1 flex flex-col gap-8">
        {/* Fixed Header */}
        <HomeHeader />
        {/* Search Bar Skeleton */}
        <div>
          <div className="relative bg-background rounded-4xl flex-1">
            <Skeleton className="h-12 rounded-4xl" />
          </div>
          <div className="h-0 bg-input/30 border rounded-b-4xl -mt-6 mb-6 w-full" />
        </div>

        {/* Popular Parks Section Skeleton */}
        <div className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-1">
            <h1 className="text-3xl font-bold">Popular Parks</h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Trending over the past 2 hours</span>
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-background rounded-lg border p-0">
                <Skeleton className="h-13 rounded-lg" />
              </div>
            ))}
          </div>
        </div>

        {/* All Theme Parks Section Skeleton */}
        <div className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h1 className="text-3xl font-bold">All Theme Parks</h1>
            <Tabs defaultValue="group">
              <TabsList>
                <TabsTrigger value="group">By Group</TabsTrigger>
                <TabsTrigger value="country">By Country</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Park Categories Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* First Column */}
            <div className="space-y-8">
              {[1, 2, 3].map((i) => (
                <div key={`col1-${i}`} className="space-y-4">
                  <Skeleton className="h-6 w-24" />
                  <div className="space-y-2">
                    {[1, 2].map((j) => (
                      <Skeleton key={`col1-${i}-${j}`} className="h-16" />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Second Column */}
            <div className="space-y-8">
              {[1, 2, 3].map((i) => (
                <div key={`col2-${i}`} className="space-y-4">
                  <Skeleton className="h-6 w-28" />
                  <div className="space-y-2">
                    {[1, 2].map((j) => (
                      <Skeleton key={`col2-${i}-${j}`} className="h-16" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Fixed Footer */}
      <Footer />
    </div>
  );
}
