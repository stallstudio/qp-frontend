"use client";

import Image from "next/image";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import {
  Undo2,
  Info,
  Radio,
  Server,
  Gift,
  Heart,
  Flag,
  Clock,
  TrendingUp,
  ListTree,
  Star,
  Flame,
  Search,
  Drama,
  Activity,
  SlidersHorizontal,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Footer from "@/components/ui/footer";
import Vignette from "./vignette";
import {
  LiveDemo,
  TrendDemo,
  QueuesDemo,
  FavoriteDemo,
  StatusDemo,
  SearchDemo,
  ShowsDemo,
} from "./demos";

export default function AboutPageClient() {
  const t = useTranslations("about");
  const tCards = useTranslations("about.cards");
  const [activeTab, setActiveTab] = useState("about");
  const demoLabel = t("demoLabel");

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 px-3 sm:px-4 lg:max-w-6xl">
      <main className="mt-4 flex flex-1 flex-col gap-6">
        {/* En-tête : bannière avec la couverture par défaut + lien de retour. */}
        <div className="relative w-full overflow-hidden rounded-4xl border border-white/10 shadow-sm">
          <Image
            src="/default_cover.webp"
            alt="Queue Park"
            width={1920}
            height={1080}
            className="absolute inset-0 h-full w-full object-cover"
            priority
          />
          <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/40 to-black/20" />
          <div className="relative z-10 flex h-72 flex-col justify-end p-5 sm:p-8">
            <Link
              href="/"
              className="absolute left-5 top-5 flex items-center gap-2 text-sm text-white/90 transition-colors hover:text-white sm:left-8 sm:top-8"
            >
              <Undo2 className="size-4" />
              {t("backHome")}
            </Link>
            <h1 className="text-3xl font-bold text-white sm:text-4xl">
              {t("heroTitle")}
            </h1>
            <p className="mt-2 max-w-xl text-sm text-white/90 sm:text-base">
              {t("heroSubtitle")}
            </p>
          </div>
        </div>

        {/* Container « temps d'attente » : la même carte à onglets que sur les
            pages de parc, mais on écrit dedans. */}
        <Card className="w-full gap-0 rounded-4xl p-2.5 pb-0 sm:p-4">
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full"
          >
            <TabsList className="relative w-full overflow-hidden rounded-3xl">
              {/* Pastille coulissante (reprend le comportement des pages parc). */}
              <span
                aria-hidden
                className="pointer-events-none absolute bottom-[3px] left-[3px] top-[3px] w-[calc(50%-3px)] rounded-3xl bg-background shadow-sm dark:border dark:border-input dark:bg-input/30"
                style={{
                  transform:
                    activeTab === "guide"
                      ? "translateX(100%)"
                      : "translateX(0%)",
                  transitionProperty: "transform",
                  transitionDuration: "1000ms",
                  transitionTimingFunction: "cubic-bezier(0.32, 0.72, 0, 1)",
                }}
              />
              <TabsTrigger
                value="about"
                className="relative z-10 rounded-3xl data-[state=active]:bg-transparent data-[state=active]:shadow-none dark:data-[state=active]:border-transparent dark:data-[state=active]:bg-transparent"
              >
                <Info />
                {t("tabs.about")}
              </TabsTrigger>
              <TabsTrigger
                value="guide"
                className="relative z-10 rounded-3xl data-[state=active]:bg-transparent data-[state=active]:shadow-none dark:data-[state=active]:border-transparent dark:data-[state=active]:bg-transparent"
              >
                <ListTree />
                {t("tabs.guide")}
              </TabsTrigger>
            </TabsList>

            {/* Onglet 1 : le projet. */}
            <TabsContent value="about" className="p-2 pt-5 sm:p-4">
              <h2 className="mb-4 text-2xl font-bold tracking-tight">
                {t("sectionAboutTitle")}
              </h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Vignette
                  wide
                  icon={Info}
                  title={tCards("intro.title")}
                  body={tCards("intro.body")}
                />
                <Vignette
                  icon={Radio}
                  title={tCards("data.title")}
                  body={tCards("data.body")}
                />
                <Vignette
                  icon={Server}
                  title={tCards("worker.title")}
                  body={tCards("worker.body")}
                />
                <Vignette
                  icon={Gift}
                  title={tCards("free.title")}
                  body={tCards("free.body")}
                />
                <Vignette
                  icon={Flag}
                  title={tCards("report.title")}
                  body={tCards("report.body")}
                />
                <Vignette
                  wide
                  icon={Heart}
                  title={tCards("independent.title")}
                  body={tCards("independent.body")}
                />
              </div>
            </TabsContent>

            {/* Onglet 2 : le guide des fonctionnalités (avec mini-démos). */}
            <TabsContent value="guide" className="p-2 pt-5 sm:p-4">
              <h2 className="mb-4 text-2xl font-bold tracking-tight">
                {t("sectionGuideTitle")}
              </h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Vignette
                  icon={Clock}
                  title={tCards("live.title")}
                  body={tCards("live.body")}
                  demoLabel={demoLabel}
                  demo={<LiveDemo />}
                />
                <Vignette
                  icon={TrendingUp}
                  title={tCards("trend.title")}
                  body={tCards("trend.body")}
                  demoLabel={demoLabel}
                  demo={<TrendDemo />}
                />
                <Vignette
                  icon={ListTree}
                  title={tCards("queues.title")}
                  body={tCards("queues.body")}
                  demoLabel={demoLabel}
                  demo={<QueuesDemo />}
                />
                <Vignette
                  icon={Star}
                  title={tCards("favorites.title")}
                  body={tCards("favorites.body")}
                  demoLabel={demoLabel}
                  demo={<FavoriteDemo />}
                />
                <Vignette
                  icon={Drama}
                  title={tCards("shows.title")}
                  body={tCards("shows.body")}
                  demoLabel={demoLabel}
                  demo={<ShowsDemo />}
                />
                <Vignette
                  icon={Search}
                  title={tCards("search.title")}
                  body={tCards("search.body")}
                  demoLabel={demoLabel}
                  demo={<SearchDemo />}
                />
                <Vignette
                  icon={Flame}
                  title={tCards("popular.title")}
                  body={tCards("popular.body")}
                />
                <Vignette
                  icon={Activity}
                  title={tCards("status.title")}
                  body={tCards("status.body")}
                  demoLabel={demoLabel}
                  demo={<StatusDemo />}
                />
                <Vignette
                  wide
                  icon={SlidersHorizontal}
                  title={tCards("preferences.title")}
                  body={tCards("preferences.body")}
                />
              </div>
            </TabsContent>
          </Tabs>
        </Card>
      </main>

      <Footer />
    </div>
  );
}
