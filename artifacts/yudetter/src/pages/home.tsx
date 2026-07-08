import { useState } from "react";
import { useGetTimeline, useGetExplore } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Search } from "lucide-react";
import { useLocation } from "wouter";
import YudateCard from "@/components/yudate-card";
import YudateComposer from "@/components/yudate-composer";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function useGetPopular() {
  return useQuery({
    queryKey: ["/api/explore/popular"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/explore/popular`);
      if (!res.ok) throw new Error("Failed to fetch popular");
      return res.json() as Promise<{ items: any[]; nextCursor: number | null }>;
    },
  });
}

type Tab = "latest" | "popular";

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<Tab>("latest");
  const [, setLocation] = useLocation();

  const { data: latestData, isLoading: isLatestLoading } = useGetExplore(undefined, {
    query: { queryKey: ["/api/explore"] },
  });
  const { data: popularData, isLoading: isPopularLoading } = useGetPopular();

  const isLoading = activeTab === "latest" ? isLatestLoading : isPopularLoading;
  const data = activeTab === "latest" ? latestData : popularData;

  return (
    <div className="w-full">
      {/* Sticky Header */}
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b border-border/50">
        <div className="flex items-center justify-between px-4 h-[53px]">
          <h1 className="font-rounded font-bold text-xl">ホーム</h1>
          {/* Search button for mobile (right sidebar is hidden on mobile) */}
          <button
            onClick={() => setLocation("/explore")}
            className="sm:hidden p-2 rounded-full hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
            aria-label="検索"
          >
            <Search className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex">
          {(["latest", "popular"] as Tab[]).map((tab) => {
            const label = tab === "latest" ? "最新" : "人気";
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="flex-1 relative py-4 font-bold transition-colors hover:bg-secondary/30"
              >
                <span className={isActive ? "text-foreground" : "text-muted-foreground"}>
                  {label}
                </span>
                {isActive && (
                  <div className="absolute bottom-0 left-1/4 right-1/4 h-1 bg-primary rounded-t-full" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Composer (desktop only) */}
      <div className="hidden sm:block">
        <YudateComposer />
      </div>

      {/* Feed */}
      <div className="flex flex-col">
        {isLoading ? (
          <div className="flex justify-center p-8 text-primary">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        ) : !data?.items.length ? (
          <div className="p-8 text-center text-muted-foreground">
            <p className="font-rounded font-bold text-xl mb-2 text-foreground">
              {activeTab === "latest" ? "まだユデートがありません" : "まだ人気のユデートがありません"}
            </p>
            <p>最初のユデートを投稿してみましょう！</p>
          </div>
        ) : (
          data.items.map((yudate) => <YudateCard key={yudate.id} yudate={yudate} />)
        )}
      </div>
    </div>
  );
}
