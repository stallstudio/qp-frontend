"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Info,
  Radio,
  Server,
  Gift,
  Heart,
  Flag,
  Clock,
  // TrendingUp, // SUSPENDU : carte « tendance » du guide masquée (historique désactivé).
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
import AboutHeader from "./about-header";
import Vignette from "./vignette";
import {
  LiveDemo,
  // TrendDemo, // SUSPENDU : voir carte « tendance » masquée plus bas.
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
    <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-8 px-3 sm:px-4 lg:max-w-6xl">
      {/* Mêmes marges que la page parc : `mt-4` + `gap-1` pour que la carte à
          onglets colle au header exactement comme sur un parc. */}
      <main className="mt-4 flex flex-1 flex-col gap-1">
        {/* En-tête fixe qui rétrécit au scroll, comme l'accueil / une page parc. */}
        <AboutHeader />

        {/* Container « temps d'attente » : la même carte à onglets que sur les
            pages de parc, mais on écrit dedans. Pas de `pb-0` ici (contrairement
            au container parc qui a un pied interne) : l'espacement du bas reste
            ainsi identique à celui des côtés. */}
        <Card className="w-full gap-0 rounded-4xl p-2.5 sm:p-4">
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
                {/* SUSPENDU : carte « tendance » masquée tant que l'historique
                    est désactivé (voir HISTORY_ENABLED / TRENDS_ENABLED). À
                    réafficher en même temps que la réactivation des tendances.
                <Vignette
                  icon={TrendingUp}
                  title={tCards("trend.title")}
                  body={tCards("trend.body")}
                  demoLabel={demoLabel}
                  demo={<TrendDemo />}
                /> */}
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
