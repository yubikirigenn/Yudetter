import { useGetTimeline } from "@workspace/api-client-react";
import { Loader2 } from "lucide-react";
import YudateCard from "@/components/yudate-card";
import YudateComposer from "@/components/yudate-composer";

export default function HomePage() {
  const { data, isLoading } = useGetTimeline();

  return (
    <div className="w-full">
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b border-border/50">
        <div className="flex items-center justify-between px-4 h-[53px]">
          <h1 className="font-rounded font-bold text-xl">ホーム</h1>
        </div>
      </div>

      <div className="hidden sm:block">
        <YudateComposer />
      </div>

      <div className="flex flex-col">
        {isLoading ? (
          <div className="flex justify-center p-8 text-primary">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        ) : !data?.items.length ? (
          <div className="p-8 text-center text-muted-foreground">
            <p className="font-rounded font-bold text-xl mb-2 text-foreground">まだユデートがありません</p>
            <p>他の人をフォローして、タイムラインをいっぱいにしましょう。</p>
          </div>
        ) : (
          data.items.map((yudate) => (
            <YudateCard key={yudate.id} yudate={yudate} />
          ))
        )}
      </div>
    </div>
  );
}