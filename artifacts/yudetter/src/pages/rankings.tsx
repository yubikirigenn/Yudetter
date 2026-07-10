import { useState } from "react";
import {
  useGetRankings,
  useOptInRankings,
  useOptOutRankings,
  useGetMe,
} from "@workspace/api-client-react";
import { Loader2, Trophy, Scroll, ShieldAlert, Crown, Medal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";

type PeriodType = "daily" | "weekly" | "allTime";
type CategoryType = "post" | "follower";

export default function RankingsPage() {
  const { toast } = useToast();
  const { data: me, isLoading: isMeLoading, refetch: refetchMe } = useGetMe();
  const { data: rankings, isLoading: isRankingsLoading, refetch: refetchRankings } = useGetRankings({
    query: { enabled: !!me?.rankingOptIn },
  });

  const optInMutation = useOptInRankings();
  const optOutMutation = useOptOutRankings();

  const [period, setPeriod] = useState<PeriodType>("daily");
  const [category, setCategory] = useState<CategoryType>("post");
  const [isOpting, setIsOpting] = useState(false);
  // alert の代わりにインライン確認ダイアログ
  const [isOptOutDialogOpen, setIsOptOutDialogOpen] = useState(false);

  // 参加処理
  const handleOptIn = async () => {
    setIsOpting(true);
    try {
      await optInMutation.mutateAsync();
      await refetchMe();
      await refetchRankings();
      toast({ title: "ランキング参加", description: "ランキングに参加しました！競い合いを楽しみましょう！" });
    } catch (e) {
      console.error(e);
      toast({ variant: "destructive", title: "エラー", description: "参加処理に失敗しました" });
    } finally {
      setIsOpting(false);
    }
  };

  // 退出処理（確認後）
  const handleConfirmOptOut = async () => {
    setIsOptOutDialogOpen(false);
    setIsOpting(true);
    try {
      await optOutMutation.mutateAsync();
      await refetchMe();
      toast({ title: "ランキング退出", description: "ランキングから退出しました" });
    } catch (e) {
      console.error(e);
      toast({ variant: "destructive", title: "エラー", description: "退出処理に失敗しました" });
    } finally {
      setIsOpting(false);
    }
  };

  // me 読み込み中はスピナー
  if (isMeLoading) {
    return (
      <div className="flex h-96 w-full items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  // 規約画面（未参加時）
  if (!me?.rankingOptIn) {
    return (
      <div className="flex flex-col gap-6 p-4 max-w-xl mx-auto">
        <div className="flex flex-col items-center text-center gap-2 pt-6">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <Trophy className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-bold font-rounded">ランキングへ参加</h1>
          <p className="text-xs text-muted-foreground">他のユーザーと競い合って、豪華なYD報酬を獲得しましょう！</p>
        </div>

        <div className="rounded-2xl border border-border/50 bg-card p-5 shadow-sm flex flex-col gap-4">
          <h2 className="text-sm font-bold flex items-center gap-2 border-b pb-2">
            <Scroll className="w-4 h-4 text-primary" />
            Yudetter ランキング利用規約
          </h2>

          <div className="text-xs text-muted-foreground leading-relaxed flex flex-col gap-3 max-h-[300px] overflow-y-auto pr-1">
            <p>
              <strong>1. ランキングの公平性</strong><br />
              すべての参加者は公平にプラットフォームを利用する必要があります。スクリプト・ボットを用いた自動操作、自作自演による不正なフォロー獲得は固く禁止されています。
            </p>
            <p>
              <strong>2. 集計期間と更新</strong><br />
              ・日間ランキング: 毎日 JST 00:00 にリセット・報酬配布<br />
              ・週間ランキング: 毎週月曜日にリセット<br />
              ・総合ランキング: 全期間の累計データを表示
            </p>
            <p>
              <strong>3. 報酬システム</strong><br />
              ・日間 1位: 2,000YD / 2位: 800YD / 3位: 500YD / 4〜10位: 各100YD<br />
              ・週間報酬: 日間報酬の7倍（月曜日に一括付与）
            </p>
            <p>
              <strong>4. 総合ランキングバッジ</strong><br />
              総合フォロワー数の上位3名には金・銀・銅バッジが授与され、全ての画面で表示されます。
            </p>
            <p>
              <strong>5. 参加と退出</strong><br />
              いつでも参加・退出が可能です。退出するとバッジ情報が即時クリアされます。
            </p>
          </div>
        </div>

        <Button
          onClick={handleOptIn}
          disabled={isOpting}
          className="w-full h-12 rounded-full font-bold text-sm shadow-md"
        >
          {isOpting ? <Loader2 className="w-5 h-5 animate-spin" /> : "規約に同意して参加する"}
        </Button>
        <Toaster />
      </div>
    );
  }

  // ランキングリストの取得
  const getRankList = () => {
    if (!rankings) return [];
    const pData = (rankings as any)[period];
    if (!pData) return [];
    return pData[category] || [];
  };

  const rankList = getRankList();

  const UserBadge = ({ badgeType }: { badgeType: string | null | undefined }) => {
    if (!badgeType) return null;

    const getBadgeElement = () => {
      if (badgeType === "gold") {
        return (
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gradient-to-br from-amber-300 via-yellow-400 to-yellow-600 border border-yellow-300 shadow-sm shrink-0 select-none align-middle ml-1">
            <Crown className="w-3 h-3 text-white fill-white" />
          </span>
        );
      }
      if (badgeType === "silver") {
        return (
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gradient-to-br from-zinc-300 via-zinc-400 to-zinc-500 border border-zinc-200 shadow-sm shrink-0 select-none align-middle ml-1">
            <Trophy className="w-2.5 h-2.5 text-white fill-white" />
          </span>
        );
      }
      if (badgeType === "bronze") {
        return (
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gradient-to-br from-amber-600 via-amber-700 to-amber-800 border border-amber-500 shadow-sm shrink-0 select-none align-middle ml-1">
            <Medal className="w-2.5 h-2.5 text-white fill-white" />
          </span>
        );
      }
      return null;
    };

    const getTooltipText = () => {
      if (badgeType === "gold") return "👑 総合フォロワー数 第1位 (ゴールドバッジ)";
      if (badgeType === "silver") return "🥈 総合フォロワー数 第2位 (シルバーバッジ)";
      if (badgeType === "bronze") return "🥉 総合フォロワー数 第3位 (ブロンズバッジ)";
      return "";
    };

    return (
      <Tooltip>
        <TooltipTrigger className="cursor-pointer inline-flex items-center" asChild>
          <span>{getBadgeElement()}</span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-[11px] rounded-xl font-bold p-2 bg-popover text-popover-foreground border border-border shadow-md select-none">
          {getTooltipText()}
        </TooltipContent>
      </Tooltip>
    );
  };

  return (
    <div className="flex flex-col gap-6 p-4">
      {/* ヘッダー */}
      <div className="flex items-center justify-between border-b border-border/30 pb-4 shrink-0">
        <h1 className="text-2xl font-bold font-rounded">ランキング</h1>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsOptOutDialogOpen(true)}
          disabled={isOpting}
          className="rounded-full text-xs font-bold text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          退出する
        </Button>
      </div>

      {/* 期間タブ */}
      <div className="flex rounded-full bg-secondary/50 p-1 w-full shrink-0">
        {(["daily", "weekly", "allTime"] as PeriodType[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`flex-1 flex items-center justify-center py-2 rounded-full text-xs font-bold transition-all ${
              period === p ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {p === "daily" ? "日間" : p === "weekly" ? "週間" : "総合"}
          </button>
        ))}
      </div>

      {/* カテゴリトグル */}
      <div className="flex items-center justify-center gap-2 w-fit mx-auto bg-secondary/30 rounded-full p-1 border shrink-0">
        <button
          onClick={() => setCategory("post")}
          className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
            category === "post" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          投稿数
        </button>
        <button
          onClick={() => setCategory("follower")}
          className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
            category === "follower" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {period === "allTime" ? "総合フォロワー数" : "フォロワー増分"}
        </button>
      </div>

      {/* ランキング表 */}
      {isRankingsLoading ? (
        <div className="flex h-60 w-full items-center justify-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      ) : rankList.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground border border-dashed border-border rounded-2xl">
          <ShieldAlert className="w-12 h-12 text-muted-foreground/30 mb-2" />
          <p className="text-sm">集計対象のデータがありません</p>
          <p className="text-xs text-muted-foreground/60">投稿またはフォロー獲得があると掲載されます！</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5 max-h-[500px] overflow-y-auto pr-1">
          <TooltipProvider>
            {rankList.map((row: any, index: number) => {
              const rank = index + 1;
              const getRankStyle = () => {
                if (rank === 1) return "bg-yellow-500/10 border-yellow-500/30 text-yellow-600 font-black";
                if (rank === 2) return "bg-zinc-400/10 border-zinc-400/30 text-zinc-600 font-bold";
                if (rank === 3) return "bg-amber-600/10 border-amber-600/30 text-amber-700 font-bold";
                return "text-muted-foreground font-semibold";
              };

              return (
                <div
                  key={row.user?.id ?? index}
                  className={`flex items-center justify-between p-3.5 rounded-2xl border border-border/40 hover:bg-secondary/20 transition-all ${
                    row.user?.id === me?.id ? "bg-primary/5 border-primary/20 shadow-sm" : ""
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded-full border flex items-center justify-center shrink-0 text-xs font-rounded ${getRankStyle()}`}>
                      {rank}
                    </div>
                    <Avatar className="w-9 h-9 border border-border shrink-0">
                      <AvatarImage src={row.user?.avatarUrl || ""} />
                      <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">
                        {row.user?.displayName?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-bold text-foreground leading-snug flex items-center gap-1.5 truncate">
                        {row.user?.displayName}
                      </span>
                      <span className="text-xs text-muted-foreground">@{row.user?.username}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end shrink-0">
                    <span className="font-rounded font-black text-sm text-foreground">
                      {row.score?.toLocaleString()}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {category === "post" ? "ユデート" : "フォロワー"}
                    </span>
                  </div>
                </div>
              );
            })}
          </TooltipProvider>
        </div>
      )}

      {/* 退出確認ダイアログ（alert の代わり） */}
      <Dialog open={isOptOutDialogOpen} onOpenChange={setIsOptOutDialogOpen}>
        <DialogContent className="sm:max-w-[380px] rounded-3xl p-0 border-none overflow-hidden shadow-2xl">
          <div className="flex flex-col p-6 gap-5">
            <DialogHeader>
              <DialogTitle className="text-base font-bold font-rounded text-center">
                ランキングから退出しますか？
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground text-center leading-relaxed">
              退出すると、獲得済みのバッジやランキング掲載権が消失します。<br />
              再参加はいつでも可能です。
            </p>
            <DialogFooter className="flex flex-col gap-2 sm:flex-row">
              <Button
                variant="outline"
                onClick={() => setIsOptOutDialogOpen(false)}
                className="w-full h-10 rounded-full font-bold order-2 sm:order-1"
              >
                キャンセル
              </Button>
              <Button
                onClick={handleConfirmOptOut}
                disabled={isOpting}
                className="w-full h-10 bg-destructive hover:bg-destructive/90 text-white rounded-full font-bold order-1 sm:order-2"
              >
                {isOpting ? <Loader2 className="w-4 h-4 animate-spin" /> : "退出する"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Toaster />
    </div>
  );
}
