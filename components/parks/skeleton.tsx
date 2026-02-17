"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { Undo2 } from "lucide-react";
import Footer from "../ui/footer";
import Image from "next/image";

export default function ParkSkeleton() {
  return (
    <div className="flex min-h-screen w-full mx-auto max-w-4xl flex-col px-4">
      <main className="flex-1 flex flex-col gap-1 mb-6 mt-4">
        {/* Header Skeleton */}
        <>
          {/* Placeholder to maintain document flow */}
          <div className="w-full h-76" />

          {/* Background cover to prevent content showing behind header */}
          <div className="fixed top-0 left-0 right-0 h-12 bg-background z-40" />

          <div className="fixed top-4 left-0 right-0 z-50">
            <div className="max-w-4xl mx-auto px-4">
              <div className="relative w-full rounded-4xl shadow-sm border h-72">
                {/* Background image skeleton with fixed placeholder */}
                <Image
                  src="https://queue-park.com/assets/images/couverture_estivale.jpg"
                  alt="Park cover"
                  fill
                  className="object-cover rounded-3xl"
                />

                {/* Overlay gradient skeleton */}
                <div className="absolute left-0 bottom-0 w-full h-full z-0">
                  <div className="bg-linear-to-r from-black/80 via-black/40 to-transparent w-full h-full rounded-3xl"></div>
                </div>

                {/* Content skeleton */}
                <div className="absolute left-0 bottom-0 p-4 z-10">
                  {/* Park name and status skeleton */}
                  <div className="mb-2">
                    <Skeleton className="h-8 w-64 mb-2 bg-white/20" />
                    <Skeleton className="h-4 w-20 bg-white/20" />
                  </div>

                  {/* Opening hours skeleton */}
                  <div className="mb-2">
                    <Skeleton className="h-4 w-32 bg-white/20" />
                  </div>

                  {/* Local time skeleton */}
                  <div>
                    <Skeleton className="h-4 w-24 bg-white/20" />
                  </div>
                </div>

                {/* Back button skeleton */}
                <div className="absolute left-0 top-0 p-4 z-10">
                  <div className="flex items-center gap-2 text-white text-sm">
                    <Undo2 className="size-4" />
                    <Skeleton className="h-4 w-16 bg-white/20" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>

        {/* Wait Time Table Skeleton */}
        <div className="w-full rounded-4xl px-4 pt-2 gap-0 pb-0 border shadow-sm">
          {/* Table Header */}
          <div className="border-b pb-2 mb-2">
            <div className="grid grid-cols-3 gap-4 px-2 py-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-16" />
            </div>
          </div>

          {/* Table Rows Skeleton */}
          <div className="space-y-2">
            {[...Array(12)].map((_, index) => (
              <div
                key={index}
                className="grid grid-cols-3 gap-4 px-2 py-3 border-b last:border-b-0"
              >
                <Skeleton className="h-4 w-full max-w-xs" />
                <Skeleton className="h-4 w-12 rounded-full" />
                <Skeleton className="h-4 w-16 rounded-full" />
              </div>
            ))}
          </div>

          {/* Footer skeleton */}
          <div className="flex justify-center text-sm text-muted-foreground my-4">
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
      </main>

      {/* Footer Skeleton */}
      <Footer />
    </div>
  );
}
