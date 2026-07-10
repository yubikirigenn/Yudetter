import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import {
  useGetMarketItem,
  usePurchaseMarketItem,
  useLikeMarketItem,
  useUnlikeMarketItem,
  useGetMarketItemComments,
  useCreateMarketItemComment,
  useClaimPurchasedId,
  useCreateYudate,
  useGetMe,
} from "@workspace/api-client-react";
import {
  Loader2,
  ArrowLeft,
  Heart,
  MessageSquare,
  Share2,
  Calendar,
  User,
  Gavel,
  CheckCircle,
  CreditCard,
  X,
  Music,
  Gamepad2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";

import { useEffect, useRef } from "react";

// コピーガード付き画像プレビューコンポーネント (Canvas描画 + 焼き付け + 透明ガード)
function MarketImagePreview({ src, title, showWatermark }: { src: string; title: string; showWatermark: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      if (showWatermark) {
        ctx.save();
        const fontSize = Math.max(32, Math.floor(img.width / 8));
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
        ctx.strokeStyle = "rgba(0, 0, 0, 0.25)";
        ctx.lineWidth = Math.max(1, Math.floor(fontSize / 20));
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        ctx.translate(img.width / 2, img.height / 2);
        ctx.rotate(-25 * Math.PI / 180);

        ctx.fillText("SAMPLE", 0, 0);
        ctx.strokeText("SAMPLE", 0, 0);
        ctx.restore();
      }
    };
    img.src = src;
  }, [src, showWatermark]);

  if (!showWatermark) {
    return <img src={src} alt={title} className="w-full h-full object-contain animate-fade-in" />;
  }

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-black/5 select-none rounded-2xl overflow-hidden">
      <canvas ref={canvasRef} className="max-w-full max-h-full object-contain" />
      <div 
        className="absolute inset-0 z-30 cursor-not-allowed" 
        onContextMenu={(e) => e.preventDefault()}
        onDragStart={(e) => e.preventDefault()}
      />
    </div>
  );
}

export default function MarketDetailPage() {
  const [, params] = useRoute("/market/:id");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const id = parseInt(params?.id || "", 10);

  const { data: me } = useGetMe();
  const { data: item, isLoading: isItemLoading, refetch: refetchItem } = useGetMarketItem(id, {
    query: { enabled: !isNaN(id) }
  });
  const { data: comments = [], refetch: refetchComments } = useGetMarketItemComments(id, {
    query: { enabled: !isNaN(id) }
  });

  const likeMutation = useLikeMarketItem();
  const unlikeMutation = useUnlikeMarketItem();
  const commentMutation = useCreateMarketItemComment();
  const purchaseMutation = usePurchaseMarketItem();
  const claimIdMutation = useClaimPurchasedId();
  const sharePostMutation = useCreateYudate();

  const [commentText, setCommentText] = useState("");
  const [isCommenting, setIsCommenting] = useState(false);
  const [bidAmount, setBidAmount] = useState("");
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [purchaseSuccess, setPurchaseSuccess] = useState(false);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [shareText, setShareText] = useState("");
  const [isSharingToTimeline, setIsSharingToTimeline] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  if (isNaN(id)) {
    return <div className="p-4 text-center text-destructive">無効な商品IDです</div>;
  }

  if (isItemLoading) {
    return (
      <div className="flex h-96 w-full items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!item) {
    return <div className="p-4 text-center">商品が見つかりません</div>;
  }

  const isSeller = item.seller?.id === me?.id;
  const isBuyer = item.buyer?.id === me?.id;
  const isAuction = item.saleType === "auction";
  const minBid = item.highestBid ? item.highestBid + 1 : item.price;

  // いいね処理
  const handleLike = async () => {
    try {
      if (item.isLiked) {
        await unlikeMutation.mutateAsync({ id });
      } else {
        await likeMutation.mutateAsync({ id });
      }
      refetchItem();
    } catch (e) {
      console.error(e);
    }
  };

  // 出品商品の削除処理
  const handleDeleteItem = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/market/items/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("削除に失敗しました");
      toast({ title: "削除完了", description: "出品商品を削除しました" });
      setLocation("/market");
    } catch (e) {
      console.error(e);
      toast({ variant: "destructive", title: "エラー", description: "出品の削除に失敗しました" });
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
    }
  };

  // コメント処理
  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || isCommenting) return;

    setIsCommenting(true);
    try {
      await commentMutation.mutateAsync({
        id,
        data: { comment: commentText.trim() },
      });
      setCommentText("");
      refetchComments();
      refetchItem();
    } catch (e) {
      console.error(e);
      toast({ variant: "destructive", title: "エラー", description: "コメントの投稿に失敗しました" });
    } finally {
      setIsCommenting(false);
    }
  };

  // 購入 / 入札の実行
  const handleConfirmPurchase = async () => {
    setIsPurchasing(true);
    try {
      const bidVal = isAuction ? parseInt(bidAmount, 10) : undefined;
      await purchaseMutation.mutateAsync({
        id,
        data: bidVal ? { bidAmount: bidVal } : undefined,
      });

      setPurchaseSuccess(true);
      refetchItem();
    } catch (e: any) {
      console.error(e);
      toast({
        variant: "destructive",
        title: "エラー",
        description: e.response?.data?.error || "処理に失敗しました",
      });
    } finally {
      setIsPurchasing(false);
    }
  };

  // ダウンロード処理
  const handleDownload = async (url: string, title: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      const ext = url.split(".").pop()?.split("?")[0] || "bin";
      link.download = `${title}.${ext}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
      toast({ title: "ダウンロード開始", description: "ファイルのダウンロードを開始しました" });
    } catch (err) {
      console.error("Download failed", err);
      window.open(url, "_blank");
    }
  };

  // ユーザーIDの適用処理
  const handleClaimId = async () => {
    try {
      await claimIdMutation.mutateAsync({ id });
      toast({ title: "成功", description: `ユーザーIDを @${item.itemData} に更新しました！` });
      refetchItem();
    } catch (e: any) {
      console.error(e);
      toast({
        variant: "destructive",
        title: "エラー",
        description: e.response?.data?.error || "IDの適用に失敗しました",
      });
    }
  };

  // タイムライン宣伝機能
  const handleShareToTimeline = () => {
    const itemUrl = `${window.location.origin}/market/${item.id}`;
    setShareText(itemUrl);
    setIsShareDialogOpen(true);
  };

  const handleConfirmShare = async () => {
    if (!shareText.trim() || isSharingToTimeline) return;
    setIsSharingToTimeline(true);
    try {
      await sharePostMutation.mutateAsync({
        data: {
          content: shareText.trim(),
        },
      });
      toast({ title: "宣伝完了", description: "タイムラインに宣伝投稿を作成しました！" });
      setIsShareDialogOpen(false);
    } catch (e: any) {
      console.error(e);
      toast({ variant: "destructive", title: "エラー", description: "宣伝の共有に失敗しました" });
    } finally {
      setIsSharingToTimeline(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-4">
      {/* 戻るヘッダー */}
      <div className="flex items-center gap-3 border-b border-border/30 pb-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/market")} className="rounded-full">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-xl font-bold font-rounded">商品詳細</h1>
      </div>

      {/* アイテムプレビュー */}
      <div className="relative aspect-video w-full bg-secondary/15 rounded-2xl overflow-hidden border border-border/30 flex items-center justify-center">
        {item.itemType === "image" ? (
          <MarketImagePreview 
            src={item.itemData} 
            title={item.title} 
            showWatermark={item.status === "selling" && !item.isBought && !isSeller} 
          />
        ) : item.itemType === "audio" ? (
          <div className="flex flex-col items-center justify-center p-6 text-center gap-3 w-full h-full relative">
            {item.thumbnailUrl && (
              <img src={item.thumbnailUrl} alt={item.title} className="absolute inset-0 w-full h-full object-cover blur-sm opacity-25" />
            )}
            <div className="z-10 flex flex-col items-center gap-2">
              {item.thumbnailUrl ? (
                <img src={item.thumbnailUrl} alt={item.title} className="w-20 h-20 object-cover rounded-xl shadow-md border mb-1" />
              ) : (
                <Music className="w-12 h-12 text-primary animate-pulse" />
              )}
              <span className="text-xs font-bold text-primary bg-primary/10 px-3 py-1 rounded-full">AUDIO</span>
              <audio src={item.itemData} controls className="mt-1 w-64 max-w-full" />
              <span className="text-[10px] text-muted-foreground">※ 購入前に試聴できます</span>
            </div>
          </div>
        ) : item.itemType === "game" ? (
          <div className="flex flex-col items-center justify-center p-6 text-center gap-2 w-full h-full relative">
            {item.thumbnailUrl && (
              <img src={item.thumbnailUrl} alt={item.title} className="absolute inset-0 w-full h-full object-cover blur-sm opacity-25" />
            )}
            <div className="z-10 flex flex-col items-center gap-2">
              {item.thumbnailUrl ? (
                <img src={item.thumbnailUrl} alt={item.title} className="w-20 h-20 object-cover rounded-xl shadow-md border mb-1" />
              ) : (
                <span className="text-sm font-bold text-primary bg-primary/10 px-3 py-1 rounded-full font-rounded">GAME</span>
              )}
              <span className="text-lg font-black">{item.title}</span>
              <span className="text-xs text-muted-foreground">購入後、ゲームスタジオ画面からプレイ可能になります。</span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-6 text-center gap-2 w-full h-full relative">
            {item.thumbnailUrl && (
              <img src={item.thumbnailUrl} alt={item.title} className="absolute inset-0 w-full h-full object-cover blur-sm opacity-25" />
            )}
            <div className="z-10 flex flex-col items-center gap-2">
              {item.thumbnailUrl ? (
                <img src={item.thumbnailUrl} alt={item.title} className="w-20 h-20 object-cover rounded-xl shadow-md border mb-1" />
              ) : (
                <span className="text-sm font-bold text-amber-600 bg-amber-500/10 px-3 py-1 rounded-full">USER ID SPECIAL</span>
              )}
              <span className="text-3xl font-black font-rounded tracking-tight">@{item.itemData}</span>
              <span className="text-xs text-muted-foreground">購入後、自分のユーザーIDとしてアカウントに適用できます。</span>
            </div>
          </div>
        )}

        <span className={`absolute left-4 top-4 text-xs font-bold px-3 py-1 rounded-full text-white shadow-md ${
          isAuction ? "bg-purple-600" : "bg-primary"
        }`}>
          {isAuction ? "オークション" : "通常販売"}
        </span>
      </div>

      {/* タイトルと価格 */}
      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-xl font-bold text-foreground leading-snug">{item.title}</h2>
          <span className="font-rounded font-black text-2xl text-amber-600 shrink-0">
            {item.price.toLocaleString()} YD
          </span>
        </div>

        {/* 出品者情報 */}
        <div className="flex items-center justify-between p-3 rounded-xl border border-border/40 bg-secondary/10 mt-1">
          <div className="flex items-center gap-3">
            <Avatar className="w-9 h-9 border border-border">
              <AvatarImage src={item.seller?.avatarUrl || ""} />
              <AvatarFallback className="bg-primary/20 text-primary font-bold">
                {item.seller?.displayName?.[0]}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="text-sm font-bold">{item.seller?.displayName}</span>
              <span className="text-xs text-muted-foreground">@{item.seller?.username}</span>
            </div>
          </div>
          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            {new Date(item.createdAt).toLocaleDateString("ja-JP")} 出品
          </span>
        </div>

        {/* 商品説明 */}
        {item.description && (
          <p className="text-sm text-foreground/80 bg-secondary/5 rounded-xl p-4 leading-relaxed mt-2 border border-border/10">
            {item.description}
          </p>
        )}
      </div>

      {/* アクションボタン群 (いいね・コメント・共有) */}
      <div className="flex items-center justify-between border-t border-b border-border/30 py-2.5">
        <div className="flex items-center gap-6">
          <button
            onClick={handleLike}
            className={`flex items-center gap-1.5 text-sm font-semibold transition-colors ${
              item.isLiked ? "text-red-500 hover:text-red-600" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Heart className={`w-5 h-5 ${item.isLiked ? "fill-red-500" : ""}`} />
            <span>{item.likeCount} いいね</span>
          </button>
          <span className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
            <MessageSquare className="w-5 h-5" />
            <span>{item.commentCount} コメント</span>
          </span>
        </div>

        <Button variant="ghost" size="sm" onClick={handleShareToTimeline} className="rounded-full gap-1.5 text-muted-foreground hover:text-foreground">
          <Share2 className="w-4 h-4" />
          <span>タイムラインで宣伝</span>
        </Button>
      </div>

      {/* 購入・入札・クレームボタン (購入・保留など状況に応じたUI) */}
      <div className="flex flex-col gap-3">
        {item.status === "selling" && !isSeller && (
          <div className="flex flex-col sm:flex-row gap-3 w-full">
            <Button
              onClick={() => {
                setBidAmount(""); // 通常入札モーダルの準備
                setIsPurchaseModalOpen(true);
              }}
              className="flex-1 h-12 rounded-full font-bold text-base shadow-md active:scale-98 transition-transform"
            >
              {isAuction ? "オークションに入札する" : "この商品を購入する"}
            </Button>
            {isAuction && item.buyoutPrice && (
              <Button
                onClick={() => {
                  setBidAmount(String(item.buyoutPrice)); // 即決額を設定してモーダルを開く
                  setIsPurchaseModalOpen(true);
                }}
                variant="outline"
                className="flex-1 h-12 rounded-full font-bold text-base border-purple-500 text-purple-700 hover:bg-purple-50 shadow-sm active:scale-98 transition-transform"
              >
                即決価格で購入 ({item.buyoutPrice.toLocaleString()} YD)
              </Button>
            )}
          </div>
        )}

        {isSeller && (
          <div className="flex flex-col gap-2">
            <div className="text-center p-3.5 bg-secondary/20 text-muted-foreground rounded-2xl text-xs font-semibold">
              あなたの出品した商品です（購入・入札できません）
            </div>
            <Button
              variant="destructive"
              onClick={() => setIsDeleteDialogOpen(true)}
              disabled={isDeleting}
              className="w-full h-11 rounded-full font-bold text-sm shadow-md active:scale-98 transition-all"
            >
              {isDeleting ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
              この出品を削除する
            </Button>
          </div>
        )}

        {/* オークションの現在状況表示 */}
        {isAuction && item.status === "selling" && (
          <div className="rounded-2xl border border-purple-500/20 bg-purple-500/5 p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between text-xs font-bold text-purple-700">
              <span className="flex items-center gap-1">
                <Gavel className="w-4 h-4" />
                現在の最高入札
              </span>
              <span>終了日時: {new Date(item.auctionEndAt || "").toLocaleString("ja-JP")}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black font-rounded text-purple-800">
                  {item.highestBid?.toLocaleString() ?? item.price.toLocaleString()}
                </span>
                <span className="text-xs font-bold text-purple-600">YD</span>
                {item.highestBidder && (
                  <span className="text-xs text-muted-foreground ml-2">
                    (入札者: @{item.highestBidder.username})
                  </span>
                )}
              </div>
              {item.buyoutPrice && (
                <div className="flex flex-col items-end">
                  <span className="text-[10px] text-purple-500 font-bold">即決価格</span>
                  <span className="text-sm font-black font-rounded text-purple-700">
                    {item.buyoutPrice.toLocaleString()} YD
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ID クレーム誘導ボタン (売却完了後、購入者本人が新ID適用待ち) */}
        {item.status === "sold" && item.itemType === "user_id" && isBuyer && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 flex flex-col gap-3">
            <span className="text-sm font-bold text-amber-800 flex items-center gap-1.5">
              <CheckCircle className="w-5 h-5 text-amber-600" />
              ID購入成立！アカウントに適用してください
            </span>
            <p className="text-xs text-amber-700/80 leading-relaxed">
              売却が完了し、ユーザーID <strong>@{item.itemData}</strong> の移行予約ができています。下のボタンを押してあなたのアカウントに即時適用できます。
            </p>
            <Button
              onClick={handleClaimId}
              className="w-full h-11 bg-amber-600 hover:bg-amber-700 text-white rounded-full font-bold text-sm shadow-sm"
            >
              ユーザーID @{item.itemData} を適用する
            </Button>
          </div>
        )}

        {item.status === "sold" && item.itemType === "user_id" && !isBuyer && (
          <div className="text-center p-3.5 bg-yellow-500/10 text-yellow-700 rounded-2xl text-xs font-semibold border border-yellow-500/20">
            売却が成立し、現在購入者による新しいユーザーID設定の適用を待っています。
          </div>
        )}

        {item.status === "completed" && (
          <div className="text-center p-3.5 bg-green-500/10 text-green-700 rounded-2xl text-xs font-semibold border border-green-500/20 flex items-center justify-center gap-1.5">
            <CheckCircle className="w-4 h-4 text-green-600" />
            この商品は取引が完了しています (購入者: @{item.buyer?.username})
          </div>
        )}

        {/* ゲームを遊ぶボタン (購入済み or 出品者かつゲームタイプ) */}
        {(item.isBought || isSeller) && item.itemType === "game" && (
          <Button
            type="button"
            onClick={() => window.open(`/games/${item.itemData}`, '_blank')}
            className="w-full h-12 rounded-full font-bold text-base bg-emerald-600 hover:bg-emerald-700 text-white shadow-md flex items-center justify-center gap-2 active:scale-98 transition-transform mt-2"
          >
            <Gamepad2 className="w-5 h-5" />
            ゲームを遊ぶ (別タブで開く)
          </Button>
        )}

        {/* 購入済み商品のダウンロードボタン (画像・音声) */}
        {item.isBought && (item.itemType === "image" || item.itemType === "audio") && (
          <Button
            type="button"
            onClick={() => handleDownload(item.itemData, item.title)}
            className="w-full h-12 rounded-full font-bold text-base bg-primary hover:bg-primary/90 text-white shadow-md active:scale-98 transition-transform mt-2"
          >
            ダウンロードする
          </Button>
        )}
      </div>

      {/* コメントセクション */}
      <div className="flex flex-col gap-4 mt-2">
        <h3 className="text-base font-bold font-rounded">コメント ({comments.length})</h3>

        {/* コメント入力 */}
        <form onSubmit={handleComment} className="flex gap-2">
          <Input
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="商品に質問やコメントを残す..."
            className="rounded-full"
            maxLength={100}
            required
          />
          <Button type="submit" disabled={isCommenting} className="rounded-full px-5 shrink-0">
            {isCommenting ? <Loader2 className="w-4 h-4 animate-spin" /> : "送信"}
          </Button>
        </form>

        {/* コメントリスト */}
        <div className="flex flex-col gap-3.5 max-h-[300px] overflow-y-auto pr-1">
          {comments.map((c) => (
            <div key={c.id} className="flex gap-3 items-start border-b border-border/10 pb-3">
              <Avatar className="w-8 h-8 border border-border shrink-0">
                <AvatarImage src={c.user?.avatarUrl || ""} />
                <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">
                  {c.user?.displayName?.[0]}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs font-bold truncate text-foreground/90">
                    {c.user?.displayName} <span className="text-muted-foreground font-normal">@{c.user?.username}</span>
                  </span>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {new Date(c.createdAt).toLocaleDateString("ja-JP")}
                  </span>
                </div>
                <p className="text-sm mt-1 text-foreground/80 leading-normal">{c.comment}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 購入・入札用の決済モーダル (没入感の高いApple Pay風UI) */}
      <Dialog open={isPurchaseModalOpen} onOpenChange={setIsPurchaseModalOpen}>
        <DialogContent className="sm:max-w-[420px] p-0 border-none bg-background rounded-3xl overflow-hidden shadow-2xl">
          {purchaseSuccess ? (
            <div className="flex flex-col items-center text-center p-8 gap-4">
              <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center text-green-600">
                <CheckCircle className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-bold font-rounded">取引成立！</h3>
              <p className="text-sm text-muted-foreground leading-normal">
                {isAuction && Number(bidAmount) !== item.buyoutPrice
                  ? `${(Number(bidAmount) || 0).toLocaleString()} YD の入札を正常に記録しました。落札完了までお待ちください。`
                  : `「${item.title}」の購入が完了しました。`}
              </p>

              {(!isAuction || Number(bidAmount) === item.buyoutPrice) && (item.itemType === "image" || item.itemType === "audio") ? (
                <div className="flex flex-col gap-2 w-full mt-4">
                  <p className="text-xs text-amber-700 font-medium font-rounded">ファイルを今すぐダウンロードしますか？</p>
                  <div className="flex gap-2.5 w-full mt-1">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsPurchaseModalOpen(false);
                        setPurchaseSuccess(false);
                        refetchItem();
                      }}
                      className="flex-1 h-11 rounded-full font-bold"
                    >
                      あとで
                    </Button>
                    <Button
                      onClick={async () => {
                        await handleDownload(item.itemData, item.title);
                        setIsPurchaseModalOpen(false);
                        setPurchaseSuccess(false);
                        refetchItem();
                      }}
                      className="flex-1 h-11 rounded-full font-bold bg-primary hover:bg-primary/90"
                    >
                      ダウンロード
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  onClick={() => {
                    setIsPurchaseModalOpen(false);
                    setPurchaseSuccess(false);
                    refetchItem();
                  }}
                  className="w-full h-11 rounded-full font-bold mt-4"
                >
                  閉じる
                </Button>
              )}
            </div>
          ) : (
            <div className="flex flex-col p-6 gap-6 relative">
              <button
                onClick={() => setIsPurchaseModalOpen(false)}
                className="absolute right-4 top-4 text-muted-foreground hover:text-foreground rounded-full p-1 hover:bg-secondary transition-colors"
              >
                <X className="w-4 h-4" />
              </button>

              <DialogHeader>
                <DialogTitle className="text-lg font-bold font-rounded text-center flex items-center justify-center gap-1.5">
                  <CreditCard className="w-5 h-5 text-amber-600" />
                  {isAuction && item.buyoutPrice && Number(bidAmount) === item.buyoutPrice
                    ? "即決購入の確認"
                    : "YD 決済の確認"}
                </DialogTitle>
              </DialogHeader>

              {/* 決済内容カード */}
              <div className="rounded-2xl bg-secondary/40 border border-border/30 p-4 flex flex-col gap-3.5">
                <div className="flex justify-between items-start">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-muted-foreground">購入商品</span>
                    <span className="text-sm font-bold truncate max-w-[200px]">{item.title}</span>
                  </div>
                  <span className="text-xs font-bold text-amber-700 bg-amber-500/10 px-2 py-0.5 rounded-full shrink-0">
                    {item.itemType}
                  </span>
                </div>

                <div className="flex justify-between items-center border-t border-border/20 pt-3">
                  <span className="text-xs text-muted-foreground">お支払い額</span>
                  <span className="text-lg font-black font-rounded text-amber-600">
                    {isAuction
                      ? `${(Number(bidAmount) || 0).toLocaleString()} YD`
                      : `${item.price.toLocaleString()} YD`}
                  </span>
                </div>
              </div>

              {/* オークションの入札額入力 */}
              {isAuction && (!item.buyoutPrice || Number(bidAmount) !== item.buyoutPrice) && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-muted-foreground">入札額を入力 (最小 {minBid}YD)</label>
                  <div className="relative">
                    <Input
                      type="number"
                      value={bidAmount}
                      onChange={(e) => setBidAmount(e.target.value)}
                      placeholder={`${minBid}`}
                      className="pr-10 font-bold text-base"
                      min={minBid}
                      required
                    />
                    <span className="absolute right-3 top-2.5 text-xs text-muted-foreground font-bold">YD</span>
                  </div>
                </div>
              )}

              {/* 残高情報 */}
              <div className="flex justify-between text-xs font-semibold text-muted-foreground px-1">
                <span>あなたの所持金</span>
                <span>{me?.yudedollar?.toLocaleString()} YD</span>
              </div>

              <DialogFooter className="mt-2">
                <Button
                  onClick={handleConfirmPurchase}
                  disabled={
                    isPurchasing || 
                    (isAuction && 
                      (!item.buyoutPrice || Number(bidAmount) !== item.buyoutPrice) && 
                      (!bidAmount || parseInt(bidAmount, 10) < minBid)
                    )
                  }
                  className="w-full h-11 rounded-full font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-sm flex items-center justify-center gap-1.5"
                >
                  {isPurchasing ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <span>認証して支払う</span>
                    </>
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* タイムライン宣伝投稿用のダイアログ */}
      <Dialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen}>
        <DialogContent className="sm:max-w-[420px] rounded-3xl p-6 shadow-xl bg-background border border-border/40">
          <DialogHeader>
            <DialogTitle className="text-base font-bold font-rounded text-center">タイムラインで宣伝</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 mt-2">
            <p className="text-xs text-muted-foreground leading-normal">
              宣伝投稿のメッセージを入力してください。商品リンクは自動で追加されています。
            </p>
            <Textarea
              value={shareText}
              onChange={(e) => setShareText(e.target.value)}
              placeholder="宣伝メッセージを入力..."
              rows={4}
              className="resize-none rounded-xl border-border/60"
            />
          </div>
          <DialogFooter className="mt-4 flex gap-2 sm:justify-center">
            <Button
              variant="outline"
              onClick={() => setIsShareDialogOpen(false)}
              className="flex-1 rounded-full font-bold h-10 text-xs"
            >
              キャンセル
            </Button>
            <Button
              onClick={handleConfirmShare}
              disabled={isSharingToTimeline || !shareText.trim()}
              className="flex-1 rounded-full font-bold h-10 text-xs"
            >
              {isSharingToTimeline ? <Loader2 className="w-4 h-4 animate-spin" /> : "投稿する"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 削除確認用 AlertDialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="rounded-3xl p-6 bg-background border border-border/40 max-w-[400px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-rounded font-bold text-base">出品を削除しますか？</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground leading-normal mt-2">
              {isAuction
                ? "このオークションを完全に削除します。既に入札されている場合は、最高入札者に対してYDが自動で全額返金されます。この操作は取り消せません。"
                : "この出品商品を完全に削除します。この操作は取り消せません。"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 flex gap-2 sm:justify-center">
            <AlertDialogCancel className="flex-1 rounded-full font-bold h-10 text-xs">キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteItem}
              disabled={isDeleting}
              className="flex-1 rounded-full font-bold h-10 text-xs bg-destructive hover:bg-destructive/90 text-white"
            >
              {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
              削除する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Toaster />
    </div>
  );
}
