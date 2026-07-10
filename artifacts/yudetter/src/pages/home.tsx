import { useState } from "react";
import { useGetExploreInfinite } from "@workspace/api-client-react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Loader2, Search } from "lucide-react";
import { useLocation } from "wouter";
import YudateCard from "@/components/yudate-card";
import YudateComposer from "@/components/yudate-composer";
import InfiniteScrollObserver from "@/components/infinite-scroll-observer";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function useGetPopularInfinite() {
  return useInfiniteQuery({
    queryKey: ["/api/explore/popular"],
    initialPageParam: null as number | null,
    queryFn: async ({ pageParam }) => {
      const url = new URL(`${BASE}/api/explore/popular`, window.location.origin);
      if (pageParam !== null && pageParam !== undefined) {
        url.searchParams.set("cursor", pageParam.toString());
      }
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error("Failed to fetch popular");
      return res.json() as Promise<{ items: any[]; nextCursor: number | null }>;
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? null,
  });
}

type Tab = "latest" | "popular";

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<Tab>("latest");
  const [, setLocation] = useLocation();

  const { 
    data: latestData, 
    isLoading: isLatestLoading,
    fetchNextPage: fetchNextLatest,
    hasNextPage: hasNextLatest,
    isFetchingNextPage: isFetchingNextLatest,
  } = useGetExploreInfinite(undefined, {
    query: { 
      queryKey: ["/api/explore"],
      getNextPageParam: (lastPage: any) => lastPage.nextCursor ?? null,
      initialPageParam: null as any,
    },
  });
  const { 
    data: popularData, 
    isLoading: isPopularLoading,
    fetchNextPage: fetchNextPopular,
    hasNextPage: hasNextPopular,
    isFetchingNextPage: isFetchingNextPopular,
  } = useGetPopularInfinite();

  const isLoading = activeTab === "latest" ? isLatestLoading : isPopularLoading;
  
  const latestItems = (latestData as any)?.pages.flatMap((p: any) => p.items) || [];
  const popularItems = (popularData as any)?.pages.flatMap((p: any) => p.items) || [];
  const items = activeTab === "latest" ? latestItems : popularItems;

  const fetchNextPage = activeTab === "latest" ? fetchNextLatest : fetchNextPopular;
  const hasNextPage = activeTab === "latest" ? !!hasNextLatest : !!hasNextPopular;
  const isFetchingNextPage = activeTab === "latest" ? isFetchingNextLatest : isFetchingNextPopular;

  return (
    <div className="w-full">
      {/* Sticky Header */}
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b border-border/50">
        <div className="flex items-center justify-between px-4 h-[53px]">
          <h1 className="text-xl font-bold font-rounded">ホーム</h1>
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
        ) : !items.length ? (
          <div className="p-8 text-center text-muted-foreground">
            <p className="font-rounded font-bold text-xl mb-2 text-foreground">
              {activeTab === "latest" ? "まだユデートがありません" : "まだ人気のユデートがありません"}
            </p>
            <p>最初のユデートを投稿してみましょう！</p>
          </div>
        ) : (
          <>
            {items.map((yudate: any) => <YudateCard key={yudate.id} yudate={yudate} />)}
            <InfiniteScrollObserver 
              hasNextPage={hasNextPage}
              isFetchingNextPage={isFetchingNextPage}
              fetchNextPage={fetchNextPage}
            />
          </>
        )}
      </div>
    </div>
  );
}
