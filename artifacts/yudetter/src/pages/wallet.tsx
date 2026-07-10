import { useGetMe, useGetWalletHistory } from "@workspace/api-client-react";
import { Loader2, ArrowUpRight, ArrowDownLeft, Flame, DollarSign, Trophy } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export default function WalletPage() {
  const { data: me, isLoading: isMeLoading } = useGetMe();
  const { data: history = [], isLoading: isHistoryLoading } = useGetWalletHistory();

  if (isMeLoading || isHistoryLoading) {
    return (
      <div className="flex h-96 w-full items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  // 今日の上限進捗（投稿・閲覧）を履歴から計算
  // 簡易的に本日の取引データから算出
  const getTodayLimitProgress = (type: string) => {
    const today = new Date().toISOString().split("T")[0];
    const todayTransactions = history.filter(
      (t) =>
        t.type === type &&
        t.createdAt.startsWith(today)
    );
    return todayTransactions.reduce((acc, t) => acc + Math.abs(t.amount), 0);
  };

  const todayPostYd = getTodayLimitProgress("post_create");
  const todayViewYd = getTodayLimitProgress("post_view");

  return (
    <div className="flex flex-col gap-6 p-4">
      {/* 画面ヘッダー */}
      <div className="flex items-center justify-between border-b border-border/30 pb-4">
        <h1 className="text-2xl font-bold font-rounded">ウォレット</h1>
      </div>

      {/* YD残高カード */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-500 via-amber-600 to-yellow-700 p-6 text-white shadow-xl">
        {/* 背景の光沢飾り */}
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -left-10 -bottom-10 h-32 w-32 rounded-full bg-yellow-300/10 blur-xl" />

        <div className="flex flex-col justify-between h-40">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium tracking-wide text-white/80">現在のユデドル残高</span>
            <div className="flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur-sm">
              <Flame className="w-4 h-4 text-orange-300 animate-pulse" />
              <span>連続 {me?.consecutiveLoginDays ?? 0} 日目ログイン</span>
            </div>
          </div>

          <div className="my-2 flex items-baseline gap-2">
            <span className="text-5xl font-black font-rounded tracking-tight">
              {me?.yudedollar?.toLocaleString() ?? 0}
            </span>
            <span className="text-2xl font-bold text-amber-200">YD</span>
          </div>

          <div className="flex items-center justify-between border-t border-white/20 pt-3 text-xs text-white/80">
            <span>ユーザー: @{me?.username}</span>
          </div>
        </div>
      </div>

      {/* 本日のYD獲得限度状況 */}
      <div className="rounded-2xl border border-border/50 bg-card p-5 shadow-sm">
        <h2 className="text-base font-bold font-rounded mb-4 flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-500" />
          本日のボーナス獲得枠
        </h2>
        <div className="flex flex-col gap-4">
          {/* 投稿枠 */}
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-sm">
              <span className="font-medium text-muted-foreground">新規投稿ボーナス (1回: 5YD)</span>
              <span className="font-bold">{todayPostYd} / 100 YD</span>
            </div>
            <Progress value={todayPostYd} max={100} className="h-2" />
          </div>

          {/* 閲覧枠 */}
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-sm">
              <span className="font-medium text-muted-foreground">投稿閲覧ボーナス (1回: 1YD)</span>
              <span className="font-bold">{todayViewYd} / 100 YD</span>
            </div>
            <Progress value={todayViewYd} max={100} className="h-2" />
          </div>
        </div>
      </div>

      {/* 取引履歴 */}
      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-bold font-rounded">獲得・使用履歴</h2>
        
        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground border border-dashed border-border rounded-2xl">
            <DollarSign className="w-12 h-12 text-muted-foreground/30 mb-2" />
            <p className="text-sm">取引履歴がありません</p>
            <p className="text-xs text-muted-foreground/60">投稿やログインでYDを獲得しましょう！</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto pr-1">
            {history.map((t) => {
              const isIncome = t.amount > 0;
              const formattedDate = new Date(t.createdAt).toLocaleDateString("ja-JP", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              });

              return (
                <div
                  key={t.id}
                  className="flex items-center justify-between p-4 rounded-xl border border-border/40 hover:bg-secondary/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                        isIncome
                          ? "bg-green-500/10 text-green-600"
                          : "bg-red-500/10 text-red-600"
                      }`}
                    >
                      {isIncome ? (
                        <ArrowUpRight className="w-5 h-5" />
                      ) : (
                        <ArrowDownLeft className="w-5 h-5" />
                      )}
                    </div>
                    <div className="flex flex-col">
                      <span className="font-bold text-sm leading-tight text-foreground/90">
                        {t.description}
                      </span>
                      <span className="text-xs text-muted-foreground mt-0.5">
                        {formattedDate} • {t.type}
                      </span>
                    </div>
                  </div>

                  <span
                    className={`font-rounded font-black text-base ${
                      isIncome ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {isIncome ? "+" : ""}
                    {t.amount} YD
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
