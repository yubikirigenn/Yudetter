import { useLocation } from "wouter";
import {
  useGetGames,
  useGetMe,
} from "@workspace/api-client-react";
import { Loader2, Gamepad2, Plus, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function GamesPage() {
  const [, setLocation] = useLocation();
  const { data: me } = useGetMe();
  const { data: games = [], isLoading: isGamesLoading } = useGetGames({});

  return (
    <div className="flex flex-col gap-6 p-4">
      {/* 画面ヘッダー */}
      <div className="flex items-center justify-between border-b border-border/30 pb-4">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-2xl font-bold font-rounded">ゲームポータル</h1>
          <p className="text-xs text-muted-foreground">他のユーザーが作成したゲームをプレイして遊ぼう！</p>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="hidden sm:flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold">
            <span className="text-muted-foreground">所持金:</span>
            <span className="font-rounded font-black text-amber-600">{me?.yudedollar?.toLocaleString()} YD</span>
          </div>
          <Button
            onClick={() => window.open("/studio", "_blank")}
            className="rounded-full gap-1.5 px-4 font-bold text-xs bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 shadow-none"
          >
            <Plus className="w-3.5 h-3.5" />
            YGSスタジオを開く
          </Button>
        </div>
      </div>

      {/* コンテンツ */}
      {isGamesLoading ? (
        <div className="flex h-60 w-full items-center justify-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      ) : games.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground border border-dashed border-border rounded-2xl">
          <Gamepad2 className="w-12 h-12 text-muted-foreground/30 mb-2" />
          <p className="text-sm">公開されているゲームはありません</p>
          <p className="text-xs text-muted-foreground/60">YGSスタジオから自作のHTMLゲームを公開してみましょう！</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3.5">
          {games.map((g) => {
            const isFree = g.playPrice === 0;
            return (
              <div
                key={g.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border border-border/40 bg-card rounded-2xl hover:shadow-sm transition-all"
              >
                <div className="flex gap-3 min-w-0">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                    <Gamepad2 className="w-6 h-6 animate-pulse" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="font-bold text-base text-foreground leading-snug truncate">{g.title}</span>
                    {g.description && <p className="text-xs text-muted-foreground truncate mt-0.5">{g.description}</p>}
                    <div className="flex items-center gap-1.5 mt-2">
                      <Avatar className="w-4 h-4 border border-border">
                        <AvatarImage src={g.creator?.avatarUrl || ""} />
                        <AvatarFallback className="text-[8px] bg-primary/10">{g.creator?.displayName?.[0]}</AvatarFallback>
                      </Avatar>
                      <span className="text-[11px] text-muted-foreground truncate">
                        制作者: @{g.creator?.username}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 pt-3 sm:pt-0 shrink-0">
                  <div className="flex flex-col sm:items-end">
                    <span className="text-[10px] text-muted-foreground">プレイ料金</span>
                    <span className="font-rounded font-black text-sm text-amber-600">
                      {isFree ? "無料" : `${g.playPrice.toLocaleString()} YD`}
                    </span>
                  </div>
                  <Button
                    onClick={() => setLocation(`/games/${g.id}`)}
                    className="rounded-full gap-1.5 px-5 font-bold text-xs"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    プレイする
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
