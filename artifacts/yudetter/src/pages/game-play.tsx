import { useState, useEffect, useRef } from "react";
import { useRoute, useLocation } from "wouter";
import {
  useGetGame,
  useChargeGamePayment,
  useGetMe,
} from "@workspace/api-client-react";
import { Loader2, ArrowLeft, Gamepad2, CreditCard, ShieldCheck, CheckCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";

export default function GamePlayPage() {
  const [, params] = useRoute("/games/:id");
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const id = parseInt(params?.id || "", 10);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const { data: me, refetch: refetchMe } = useGetMe();
  const { data: game, isLoading: isGameLoading } = useGetGame(id, {
    query: { enabled: !isNaN(id) }
  });
  const chargeMutation = useChargeGamePayment();

  // 状態管理
  const [hasPaidPlayFee, setHasPaidPlayFee] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPlayFeeModalOpen, setIsPlayFeeModalOpen] = useState(false);
  const [isPlayFeePaying, setIsPlayFeePaying] = useState(false);

  // ゲーム内課金 (SDK要求) の状態管理
  const [isGameChargeOpen, setIsGameChargeOpen] = useState(false);
  const [gameChargeAmount, setGameChargeAmount] = useState(0);
  const [gameChargeDesc, setGameChargeDesc] = useState("");
  const [isGameCharging, setIsGameCharging] = useState(false);
  const [pendingSource, setPendingSource] = useState<MessageEventSource | null>(null);

  // プレイ開始ボタン処理
  const handleStartPlay = () => {
    if (!game) return;
    if (game.playPrice === 0 || hasPaidPlayFee) {
      setIsPlaying(true);
    } else {
      setIsPlayFeeModalOpen(true);
    }
  };

  // プレイ開始前の支払い処理
  const handlePayPlayFee = async () => {
    if (!game || !me) return;

    if (me.yudedollar < game.playPrice) {
      toast({ variant: "destructive", title: "残高不足", description: "YD残高が不足しています" });
      return;
    }

    setIsPlayFeePaying(true);
    try {
      await chargeMutation.mutateAsync({
        id,
        data: {
          amount: game.playPrice,
          description: "ゲームプレイ料金",
        },
      });

      setHasPaidPlayFee(true);
      setIsPlayFeeModalOpen(false);
      setIsPlaying(true);
      refetchMe();
      toast({ title: "支払い完了", description: "ゲームプレイを開始します！" });
    } catch (e: any) {
      console.error(e);
      toast({ variant: "destructive", title: "支払い失敗", description: e.response?.data?.error || "決済に失敗しました" });
    } finally {
      setIsPlayFeePaying(false);
    }
  };

  // ゲーム内決済 (SDK) のメッセージリスナー
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // 親と子(iframe)の通信のため、オリジンチェックは環境依存となるが、同一オリジンまたはサンドボックスからの postMessage を想定
      const data = event.data;
      if (data && data.type === "YGS_PAYMENT_REQUEST") {
        console.log("Received game payment request:", data);
        const amount = Number(data.amount);
        const description = String(data.description || "ゲーム内課金");

        if (isNaN(amount) || amount <= 0) {
          event.source?.postMessage(
            { type: "YGS_PAYMENT_RESPONSE", success: false, error: "無効な決済金額です" },
            { targetOrigin: "*" }
          );
          return;
        }

        // 決済確認モーダルを開く
        setGameChargeAmount(amount);
        setGameChargeDesc(description);
        setPendingSource(event.source);
        setIsGameChargeOpen(true);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, []);

  // ゲーム内決済 (SDK) の承認
  const handleConfirmGameCharge = async () => {
    if (!pendingSource) return;

    setIsGameCharging(true);
    try {
      const res = await chargeMutation.mutateAsync({
        id,
        data: {
          amount: gameChargeAmount,
          description: gameChargeDesc,
        },
      });

      if (res.success && res.transactionId) {
        // ゲーム(iframe)に対して成功のレスポンスを返送
        pendingSource.postMessage(
          { type: "YGS_PAYMENT_RESPONSE", success: true, transactionId: res.transactionId },
          { targetOrigin: "*" }
        );
        toast({ title: "決済成功", description: `${gameChargeAmount}YD を支払いました` });
      } else {
        throw new Error("決済の処理に失敗しました");
      }
      setIsGameChargeOpen(false);
      refetchMe();
    } catch (e: any) {
      console.error(e);
      pendingSource.postMessage(
        { type: "YGS_PAYMENT_RESPONSE", success: false, error: e.response?.data?.error || "決済処理エラー" },
        { targetOrigin: "*" }
      );
      toast({ variant: "destructive", title: "決済失敗", description: e.response?.data?.error || "処理に失敗しました" });
      setIsGameChargeOpen(false);
    } finally {
      setIsGameCharging(false);
      setPendingSource(null);
    }
  };

  // ゲーム内決済 (SDK) の拒否・キャンセル
  const handleCancelGameCharge = () => {
    if (pendingSource) {
      pendingSource.postMessage(
        { type: "YGS_PAYMENT_RESPONSE", success: false, error: "ユーザーによってキャンセルされました" },
        { targetOrigin: "*" }
      );
    }
    setIsGameChargeOpen(false);
    setPendingSource(null);
  };

  if (isGameLoading) {
    return (
      <div className="flex h-96 w-full items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!game) {
    return <div className="p-4 text-center text-destructive">ゲームが見つかりません</div>;
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* ヘッダー */}
      <div className="flex items-center gap-3 border-b border-border/30 p-4 shrink-0">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/games")} className="rounded-full">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex flex-col min-w-0">
          <h1 className="text-base font-bold font-rounded truncate">{game.title}</h1>
          <span className="text-[10px] text-muted-foreground">by @{game.creator?.username}</span>
        </div>
      </div>

      {/* プレイ画面領域 */}
      <div className="flex-1 w-full bg-zinc-950 relative flex items-center justify-center">
        {!isPlaying ? (
          <div className="flex flex-col items-center text-center p-6 gap-6 max-w-sm">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center text-primary animate-bounce">
              <Gamepad2 className="w-10 h-10" />
            </div>
            <div className="flex flex-col gap-1.5">
              <h2 className="text-xl font-bold text-white font-rounded">{game.title}</h2>
              {game.description && <p className="text-sm text-zinc-400 leading-normal">{game.description}</p>}
            </div>

            <div className="flex flex-col gap-1 items-center border border-zinc-800 rounded-2xl p-4 w-full bg-zinc-900/50">
              <span className="text-xs text-zinc-500 font-semibold">1プレイ料金</span>
              <span className="font-rounded font-black text-2xl text-amber-500">
                {game.playPrice === 0 ? "無料" : `${game.playPrice.toLocaleString()} YD`}
              </span>
            </div>

            <Button
              onClick={handleStartPlay}
              className="w-full h-12 rounded-full font-bold text-base shadow-lg"
            >
              プレイ開始
            </Button>
          </div>
        ) : (
          <iframe
            ref={iframeRef}
            srcDoc={game.htmlContent || ""}
            sandbox="allow-scripts allow-modals allow-same-origin"
            className="w-full h-full border-none bg-white"
          />
        )}
      </div>

      {/* プレイ料金支払用モーダル */}
      <Dialog open={isPlayFeeModalOpen} onOpenChange={setIsPlayFeeModalOpen}>
        <DialogContent className="sm:max-w-[400px] p-0 border-none bg-background rounded-3xl overflow-hidden shadow-2xl">
          <div className="flex flex-col p-6 gap-6 relative">
            <button
              onClick={() => setIsPlayFeeModalOpen(false)}
              className="absolute right-4 top-4 text-muted-foreground hover:text-foreground rounded-full p-1 hover:bg-secondary transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <DialogHeader>
              <DialogTitle className="text-lg font-bold font-rounded text-center flex items-center justify-center gap-1.5">
                <CreditCard className="w-5 h-5 text-amber-600" />
                プレイ料金のお支払い
              </DialogTitle>
            </DialogHeader>

            <div className="rounded-2xl bg-secondary/40 border border-border/30 p-4 flex flex-col gap-3.5">
              <div className="flex justify-between items-start">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-muted-foreground">プレイゲーム</span>
                  <span className="text-sm font-bold truncate max-w-[200px]">{game.title}</span>
                </div>
              </div>

              <div className="flex justify-between items-center border-t border-border/20 pt-3">
                <span className="text-xs text-muted-foreground">プレイ料金</span>
                <span className="text-lg font-black font-rounded text-amber-600">
                  {game.playPrice.toLocaleString()} YD
                </span>
              </div>
            </div>

            <div className="flex justify-between text-xs font-semibold text-muted-foreground px-1">
              <span>あなたの所持金</span>
              <span>{me?.yudedollar?.toLocaleString()} YD</span>
            </div>

            <DialogFooter className="mt-2">
              <Button
                onClick={handlePayPlayFee}
                disabled={isPlayFeePaying}
                className="w-full h-11 rounded-full font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-sm"
              >
                {isPlayFeePaying ? <Loader2 className="w-5 h-5 animate-spin" /> : "支払ってゲームを開始"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* ゲーム内決済用 SDK 承認モーダル (iframe側からの要求) */}
      <Dialog open={isGameChargeOpen} onOpenChange={(open) => !open && handleCancelGameCharge()}>
        <DialogContent className="sm:max-w-[400px] p-0 border-none bg-background rounded-3xl overflow-hidden shadow-2xl">
          <div className="flex flex-col p-6 gap-6 relative">
            <button
              onClick={handleCancelGameCharge}
              className="absolute right-4 top-4 text-muted-foreground hover:text-foreground rounded-full p-1 hover:bg-secondary transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <DialogHeader>
              <DialogTitle className="text-lg font-bold font-rounded text-center flex items-center justify-center gap-1.5">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                ゲーム内決済の要求
              </DialogTitle>
            </DialogHeader>

            <div className="rounded-2xl bg-secondary/40 border border-border/30 p-4 flex flex-col gap-3.5">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground">購入内容</span>
                <span className="text-sm font-bold leading-relaxed">{gameChargeDesc}</span>
              </div>

              <div className="flex justify-between items-center border-t border-border/20 pt-3">
                <span className="text-xs text-muted-foreground">金額</span>
                <span className="text-lg font-black font-rounded text-emerald-600">
                  {gameChargeAmount.toLocaleString()} YD
                </span>
              </div>
            </div>

            <div className="flex justify-between text-xs font-semibold text-muted-foreground px-1">
              <span>あなたの所持金</span>
              <span>{me?.yudedollar?.toLocaleString()} YD</span>
            </div>

            <DialogFooter className="mt-2 flex flex-col gap-2 sm:flex-row">
              <Button
                variant="outline"
                onClick={handleCancelGameCharge}
                disabled={isGameCharging}
                className="w-full h-11 rounded-full font-bold order-2 sm:order-1"
              >
                キャンセル
              </Button>
              <Button
                onClick={handleConfirmGameCharge}
                disabled={isGameCharging || (me && me.yudedollar < gameChargeAmount)}
                className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full font-bold order-1 sm:order-2"
              >
                {isGameCharging ? <Loader2 className="w-5 h-5 animate-spin" /> : "承認して支払う"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
      <Toaster />
    </div>
  );
}
