import { useState, useEffect } from "react";
import { useSearch, useGetExplore } from "@workspace/api-client-react";
import { Search as SearchIcon, Loader2 } from "lucide-react";
import YudateCard from "@/components/yudate-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function ExplorePage() {
  const searchParams = new URLSearchParams(window.location.search);
  const initialQuery = searchParams.get('q') || "";
  
  const [query, setQuery] = useState(initialQuery);
  const [activeTab, setActiveTab] = useState<'yudates' | 'users'>('yudates');

  // Update query if URL changes
  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  const { data: searchData, isLoading: isSearchLoading } = useSearch(
    { q: query, type: 'all' },
    { query: { enabled: query.length > 0, queryKey: ['/api/search', { q: query, type: 'all' }] } }
  );

  const { data: exploreData, isLoading: isExploreLoading } = useGetExplore(
    undefined,
    { query: { enabled: !query, queryKey: ['/api/explore'] } }
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      window.history.replaceState(null, '', `/explore?q=${encodeURIComponent(query.trim())}`);
    } else {
      window.history.replaceState(null, '', `/explore`);
    }
  };

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
          <div className="flex">
            <button 
              onClick={() => setActiveTab('yudates')}
              className={`flex-1 font-bold text-center p-4 hover:bg-secondary transition-colors relative`}
            >
              <span className={activeTab === 'yudates' ? 'text-foreground' : 'text-muted-foreground'}>ユデート</span>
              {activeTab === 'yudates' && <div className="absolute bottom-0 left-1/4 right-1/4 h-1 bg-primary rounded-t-full" />}
            </button>
            <button 
              onClick={() => setActiveTab('users')}
              className={`flex-1 font-bold text-center p-4 hover:bg-secondary transition-colors relative`}
            >
              <span className={activeTab === 'users' ? 'text-foreground' : 'text-muted-foreground'}>ユーザー</span>
              {activeTab === 'users' && <div className="absolute bottom-0 left-1/4 right-1/4 h-1 bg-primary rounded-t-full" />}
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-col">
        {!query ? (
          // Explore Feed
          isExploreLoading ? (
            <div className="flex justify-center p-8 text-primary"><Loader2 className="w-8 h-8 animate-spin" /></div>
          ) : exploreData?.items.length ? (
            exploreData.items.map((yudate) => <YudateCard key={yudate.id} yudate={yudate} />)
          ) : (
            <div className="p-8 text-center text-muted-foreground">コンテンツがありません</div>
          )
        ) : (
          // Search Results
          isSearchLoading ? (
            <div className="flex justify-center p-8 text-primary"><Loader2 className="w-8 h-8 animate-spin" /></div>
          ) : activeTab === 'yudates' ? (
            searchData?.yudates.length ? (
              searchData.yudates.map((yudate) => <YudateCard key={yudate.id} yudate={yudate} />)
            ) : (
              <div className="p-8 text-center text-muted-foreground font-bold">「{query}」の検索結果はありません</div>
            )
          ) : (
            searchData?.users.length ? (
              searchData.users.map((user) => (
                <div key={user.id} className="flex items-center justify-between p-4 border-b border-border/50 hover:bg-secondary/20 cursor-pointer" onClick={() => window.location.href = `/profile/${user.username}`}>
                  <div className="flex items-center gap-3">
                    <Avatar className="w-12 h-12">
                      <AvatarImage src={user.avatarUrl || ''} />
                      <AvatarFallback className="bg-primary/20 text-primary font-bold">{user.displayName[0]}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-bold">{user.displayName}</div>
                      <div className="text-sm text-muted-foreground">@{user.username}</div>
                      {user.bio && <div className="text-sm mt-1">{user.bio}</div>}
                    </div>
                  </div>
                </div>
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