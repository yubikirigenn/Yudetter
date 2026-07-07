import { Search } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";

export default function RightSidebar() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) {
      setLocation(`/explore?q=${encodeURIComponent(search.trim())}`);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleSearch} className="sticky top-2 z-10 bg-background pt-2 pb-4">
        <div className="relative group">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-primary">
            <Search className="w-5 h-5" />
          </div>
          <input
            type="text"
            placeholder="Yudetterを検索"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-secondary hover:bg-border/50 focus:bg-background border border-transparent focus:border-primary focus:ring-1 focus:ring-primary rounded-full py-3 pl-12 pr-4 outline-none transition-colors"
          />
        </div>
      </form>

      <div className="bg-secondary/40 rounded-2xl p-4 border border-border/50">
        <h2 className="font-rounded font-bold text-xl mb-4">おすすめのトレンド</h2>
        <div className="flex flex-col gap-4">
          {[
            { topic: "React", posts: "1.2万" },
            { topic: "TypeScript", posts: "8,400" },
            { topic: "Yudetter開発", posts: "3,200" },
            { topic: "UI/UX", posts: "1,500" }
          ].map((item, i) => (
            <div key={i} className="cursor-pointer hover:bg-secondary/80 -mx-4 px-4 py-2 transition-colors">
              <p className="text-sm text-muted-foreground mb-0.5">日本のトレンド</p>
              <p className="font-bold">{item.topic}</p>
              <p className="text-sm text-muted-foreground mt-0.5">{item.posts} ユデート</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}