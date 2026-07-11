import { useState, useEffect } from "react";
import { useSearch, useGetExploreInfinite } from "@workspace/api-client-react";
import { Search as SearchIcon, Loader2 } from "lucide-react";
import YudateCard, { VerifiedBadge } from "@/components/yudate-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import InfiniteScrollObserver from "@/components/infinite-scroll-observer";
import { Link } from "wouter";

type SearchTabType = 'latest' | 'popular' | 'oldest' | 'users';

export default function ExplorePage() {
  const searchParams = new URLSearchParams(window.location.search);
  const initialQuery = searchParams.get('q') || "";
  
  const [query, setQuery] = useState(initialQuery);
  const [activeTab, setActiveTab] = useState<SearchTabType>('latest');

  // Update query if URL changes
  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  const { data: searchDataRaw, isLoading: isSearchLoading } = useSearch(
    { q: query, type: activeTab as any },
    { query: { enabled: query.length > 0, queryKey: ['/api/search', { q: query, type: activeTab }] } }
  );

  const searchData = searchDataRaw as any;

  const { 
    data: exploreDataRaw, 
    isLoading: isExploreLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
  } = useGetExploreInfinite(
    undefined,
    { 
      query: { 
        enabled: !query, 
        queryKey: ['/api/explore'],
        getNextPageParam: (lastPage: any) => lastPage.nextCursor ?? null,
        initialPageParam: null as any,
      } 
    }
  );

  const exploreItems = (exploreDataRaw as any)?.pages?.flatMap((p: any) => p.items || []) || [];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      window.history.replaceState(null, '', `/explore?q=${encodeURIComponent(query.trim())}`);
    } else {
      window.history.replaceState(null, '', `/explore`);
    }
  };

  const searchYudates = searchData?.yudates || [];
  const searchUsers = searchData?.users || [];

  const tabItems: { id: SearchTabType; label: string }[] = [
    { id: 'latest', label: '最新' },
    { id: 'popular', label: '人気順' },
    { id: 'oldest', label: '古い順' },
    { id: 'users', label: 'ユーザー' },
  ];

  return (
    <div className="w-full">
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b border-border/50">
        <form onSubmit={handleSearch} className="px-4 py-2">
          <div className="relative group">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-primary">
              <SearchIcon className="w-5 h-5" />
            </div>
            <input
              type="text"
              placeholder="Yudetterを検索"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-secondary focus:bg-background border border-transparent focus:border-primary focus:ring-1 focus:ring-primary rounded-full py-2.5 pl-12 pr-4 outline-none transition-colors"
            />
          </div>
        </form>

        {query && (
          <div className="flex border-b border-border/20">
            {tabItems.map((tab) => (
              <button 
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 font-bold text-center py-3.5 hover:bg-secondary transition-colors relative text-sm sm:text-base`}
              >
                <span className={activeTab === tab.id ? 'text-foreground' : 'text-muted-foreground'}>
                  {tab.label}
                </span>
                {activeTab === tab.id && (
                  <div className="absolute bottom-0 left-4 right-4 h-1 bg-primary rounded-t-full" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col">
        {!query ? (
          // Explore Feed
          isExploreLoading ? (
            <div className="flex justify-center p-8 text-primary"><Loader2 className="w-8 h-8 animate-spin" /></div>
          ) : exploreItems.length ? (
            <>
              {exploreItems.map((yudate: any) => <YudateCard key={yudate.id} yudate={yudate} />)}
              <InfiniteScrollObserver 
                hasNextPage={!!hasNextPage}
                isFetchingNextPage={isFetchingNextPage}
                fetchNextPage={fetchNextPage}
              />
            </>
          ) : (
            <div className="p-8 text-center text-muted-foreground">コンテンツがありません</div>
          )
        ) : (
          // Search Results
          isSearchLoading ? (
            <div className="flex justify-center p-8 text-primary"><Loader2 className="w-8 h-8 animate-spin" /></div>
          ) : activeTab !== 'users' ? (
            searchYudates.length ? (
              searchYudates.map((yudate: any) => <YudateCard key={yudate.id} yudate={yudate} />)
            ) : (
              <div className="p-8 text-center text-muted-foreground font-bold">「{query}」の検索結果はありません</div>
            )
          ) : (
            searchUsers.length ? (
              searchUsers.map((user: any) => (
                <Link 
                  key={user.id} 
                  href={`/profile/${user.username}`} 
                  className="flex items-center justify-between p-4 border-b border-border/50 hover:bg-secondary/20 cursor-pointer block"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="w-12 h-12">
                      <AvatarImage src={user.avatarUrl || ''} />
                      <AvatarFallback className="bg-primary/20 text-primary font-bold">{user.displayName[0]}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-bold text-foreground flex items-center gap-1">
                        <span>{user.displayName}</span>
                        <VerifiedBadge isVerified={user.isVerified} />
                      </div>
                      <div className="text-sm text-muted-foreground">@{user.username}</div>
                      {user.bio && <div className="text-sm mt-1 text-foreground">{user.bio}</div>}
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <div className="p-8 text-center text-muted-foreground font-bold">ユーザーが見つかりません</div>
            )
          )
        )}
      </div>
    </div>
  );
}
