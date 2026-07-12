import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import {
  useGetMarketItems,
  useCreateMarketItem,
  useGetGames,
  useGetMe,
} from "@workspace/api-client-react";
import { Loader2, Plus, ShoppingBag, History, Tag, Heart, MessageSquare, ShieldAlert, Music, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";

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
        const fontSize = Math.max(24, Math.floor(img.width / 10));
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
    return <img src={src} alt={title} className="w-full h-full object-cover animate-fade-in" />;
  }

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-black/5 select-none overflow-hidden">
      <canvas ref={canvasRef} className="w-full h-full object-cover" />
      <div 
        className="absolute inset-0 z-30 cursor-not-allowed" 
        onContextMenu={(e) => e.preventDefault()}
        onDragStart={(e) => e.preventDefault()}
      />
    </div>
  );
}

export default function MarketPage() {
  const [activeTab, setActiveTab] = useState<"items" | "sell" | "history">("items");
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: me } = useGetMe();
  const { data: items = [], isLoading: isItemsLoading, refetch: refetchItems } = useGetMarketItems({ status: "all" });
  const { data: games = [] } = useGetGames();
  const createMutation = useCreateMarketItem();

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

  // 出品フォームステート
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [itemType, setItemType] = useState<"image" | "audio" | "game" | "user_id">("image");
  const [itemData, setItemData] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [selectedGameId, setSelectedGameId] = useState("");
  const [price, setPrice] = useState("");
  const [saleType, setSaleType] = useState<"normal" | "auction">("normal");
  const [duration, setDuration] = useState("3");
  const [buyoutPrice, setBuyoutPrice] = useState("");
  const [stock, setStock] = useState("");
  const [isInfiniteStock, setIsInfiniteStock] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isThumbnailUploading, setIsThumbnailUploading] = useState(false);
  const [hideContent, setHideContent] = useState(false);

  // 自分の作成したゲーム一覧をフィルタリング
  const myGames = games.filter((g) => g.creator?.id === me?.id);

  // ファイルアップロードハンドラー
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: "media" | "thumbnail") => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (type === "media") {
      setIsUploading(true);
    } else {
      setIsThumbnailUploading(true);
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("アップロードに失敗しました");
      const data = await res.json();
      
      if (type === "media") {
        setItemData(data.url);
        toast({ title: "アップロード完了", description: "メディアファイルをアップロードしました" });
      } else {
        setThumbnailUrl(data.url);
        toast({ title: "アップロード完了", description: "サムネイル画像をアップロードしました" });
      }
    } catch (err) {
      console.error(err);
      toast({ variant: "destructive", title: "エラー", description: "ファイルのアップロードに失敗しました" });
    } finally {
      if (type === "media") {
        setIsUploading(false);
      } else {
        setIsThumbnailUploading(false);
      }
    }
  };

  // 出品処理
  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!title.trim()) {
      toast({ variant: "destructive", title: "エラー", description: "タイトルを入力してください" });
      return;
    }

    const priceNum = parseInt(price.replace(/,/g, ""), 10);
    if (isNaN(priceNum) || priceNum < 1 || priceNum > 999999999) {
      toast({ variant: "destructive", title: "エラー", description: "価格は 1YD 〜 999,999,999YD の範囲で設定してください" });
      return;
    }

    let buyoutPriceNum: number | undefined = undefined;
    if (saleType === "auction" && buyoutPrice.trim()) {
      buyoutPriceNum = parseInt(buyoutPrice.replace(/,/g, ""), 10);
      if (isNaN(buyoutPriceNum) || buyoutPriceNum <= priceNum) {
        toast({ variant: "destructive", title: "エラー", description: "即決価格は開始価格より高い価格を設定してください" });
        return;
      }
    }

    let finalItemData = itemData.trim();
    if (itemType === "game") {
      if (!selectedGameId) {
        toast({ variant: "destructive", title: "エラー", description: "出品するゲームを選択してください" });
        return;
      }
      finalItemData = selectedGameId;
    } else if (itemType === "user_id") {
      finalItemData = me?.username ?? "";
    }

    if (!finalItemData) {
      toast({ variant: "destructive", title: "エラー", description: "出品ファイルをアップロードしてください" });
      return;
    }

    setIsSubmitting(true);
    try {
      const finalStockVal = itemType === "game" || isInfiniteStock ? null : (parseInt(stock, 10) || null);

      await createMutation.mutateAsync({
        data: {
          title: title.trim(),
          description: description.trim() || undefined,
          itemType,
          itemData: finalItemData,
          thumbnailUrl: thumbnailUrl.trim() || undefined,
          price: priceNum,
          saleType,
          buyoutPrice: buyoutPriceNum,
          auctionDurationDays: saleType === "auction" ? parseInt(duration, 10) : undefined,
          stock: finalStockVal,
          hideContent: hideContent || undefined,
        },
      });

      toast({ title: "成功", description: "商品を出品しました！" });
      // フォームリセット
      setTitle("");
      setDescription("");
      setItemData("");
      setThumbnailUrl("");
      setSelectedGameId("");
      setPrice("");
      setSaleType("normal");
      setBuyoutPrice("");
      setStock("");
      setIsInfiniteStock(true);
      setHideContent(false);
      refetchItems();
      setActiveTab("items");
    } catch (e: any) {
      console.error(e);
      toast({ variant: "destructive", title: "エラー", description: e.response?.data?.error || "出品に失敗しました" });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 価格のカンマ区切りフォーマット
  const handlePriceChange = (val: string) => {
    const clean = val.replace(/[^0-9]/g, "");
    if (clean === "") {
      setPrice("");
      return;
    }
    const num = parseInt(clean, 10);
    if (num > 999999999) return;
    setPrice(num.toLocaleString());
  };

  return (
    <div className="flex flex-col gap-6 p-4">
      {/* 画面ヘッダー */}
      <div className="flex items-center justify-between border-b border-border/30 pb-4">
        <h1 className="text-2xl font-bold font-rounded">マーケット</h1>
        <div className="flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-sm font-semibold">
          <span className="text-muted-foreground text-xs">所持金:</span>
          <span className="font-rounded font-black text-amber-600">{me?.yudedollar?.toLocaleString()} YD</span>
        </div>
      </div>

      {/* タブ切り替え */}
      <div className="flex rounded-full bg-secondary/50 p-1 w-full shrink-0">
        <button
          onClick={() => setActiveTab("items")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-full text-sm font-bold transition-all ${
            activeTab === "items"
              ? "bg-background text-foreground shadow-sm scale-[1.02]"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <ShoppingBag className="w-4 h-4" />
          出品一覧
        </button>
        <button
          onClick={() => setActiveTab("sell")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-full text-sm font-bold transition-all ${
            activeTab === "sell"
              ? "bg-background text-foreground shadow-sm scale-[1.02]"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Plus className="w-4 h-4" />
          出品する
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-full text-sm font-bold transition-all ${
            activeTab === "history"
              ? "bg-background text-foreground shadow-sm scale-[1.02]"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <History className="w-4 h-4" />
          取引履歴
        </button>
      </div>

      {/* コンテンツ表示 */}
      {activeTab === "items" && (
        <>
          {isItemsLoading ? (
            <div className="flex h-60 w-full items-center justify-center">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
          ) : items.filter((item) => item.status === "selling").length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground border border-dashed border-border rounded-2xl">
              <Tag className="w-12 h-12 text-muted-foreground/30 mb-2" />
              <p className="text-sm">現在出品されている商品はありません</p>
              <p className="text-xs text-muted-foreground/60">「出品する」タブからアイテムを出品してみましょう！</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {items
                .filter((item) => item.status === "selling")
                .map((item) => {
                  const isAuction = item.saleType === "auction";
                  const currentPrice = (isAuction && item.highestBid && item.highestBid > 0)
                    ? item.highestBid
                    : item.price;
                  const formattedPrice = currentPrice.toLocaleString();
                  return (
                    <div
                      key={item.id}
                      onClick={() => setLocation(`/market/${item.id}`)}
                      className="flex flex-col overflow-hidden rounded-2xl border border-border/40 bg-card hover:shadow-md transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
                    >
                      {/* アイテムプレビュー画像 */}
                      <div className="relative aspect-video w-full bg-secondary/20 overflow-hidden flex items-center justify-center">
                        {item.thumbnailUrl ? (
                          <img src={item.thumbnailUrl} alt={item.title} className="w-full h-full object-cover" />
                        ) : item.hideContent ? (
                          <div className="flex flex-col items-center p-3 text-center gap-1.5">
                            <Lock className="w-6 h-6 text-muted-foreground" />
                            <span className="text-[10px] font-bold text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full uppercase">
                              {item.itemType === "user_id" ? "USER ID" : item.itemType}
                            </span>
                          </div>
                        ) : item.itemType === "image" ? (
                          <MarketImagePreview 
                            src={item.itemData} 
                            title={item.title} 
                            showWatermark={item.status === "selling" && !item.isBought && item.seller?.id !== me?.id} 
                          />
                        ) : item.itemType === "audio" ? (
                        <div className="flex flex-col items-center p-3 text-center gap-1">
                          <Music className="w-6 h-6 text-primary animate-pulse" />
                          <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">AUDIO</span>
                          <span className="text-xs font-medium truncate max-w-[140px]">{item.title}</span>
                        </div>
                      ) : item.itemType === "game" ? (
                        <div className="flex flex-col items-center p-3 text-center">
                          <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full mb-1">GAME</span>
                          <span className="text-xs font-bold truncate max-w-[140px]">{item.title}</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center p-3 text-center">
                          <span className="text-xs font-bold text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-full mb-1">USER ID</span>
                          <span className="text-sm font-black font-rounded">@{item.itemData}</span>
                        </div>
                      )}

                      {/* オークション・通常バッジ */}
                      <span className={`absolute left-2.5 top-2.5 text-[10px] font-bold px-2 py-0.5 rounded-full text-white shadow-sm ${
                        isAuction ? "bg-purple-600" : "bg-primary"
                      }`}>
                        {isAuction ? "オークション" : "通常販売"}
                      </span>
                    </div>

                    {/* 商品情報 */}
                    <div className="flex flex-col p-3 gap-1">
                      <h3 className="font-bold text-sm truncate text-foreground">{item.title}</h3>
                      <div className="flex items-center gap-1.5 mt-1">
                        <Avatar className="w-4 h-4 border border-border">
                          <AvatarImage src={item.seller?.avatarUrl || ""} />
                          <AvatarFallback className="text-[8px] bg-primary/10">{item.seller?.displayName?.[0]}</AvatarFallback>
                        </Avatar>
                        <span className="text-[11px] text-muted-foreground truncate flex-1">@{item.seller?.username}</span>
                      </div>

                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/20">
                        <span className="font-rounded font-black text-sm text-amber-600 flex items-center gap-1 flex-wrap">
                          {isAuction && item.highestBid && item.highestBid > 0 ? (
                            <span className="text-[9px] text-purple-600 font-bold bg-purple-50 border border-purple-100 px-1 py-0.5 rounded leading-none">現在値</span>
                          ) : null}
                          <span>{formattedPrice} <span className="text-[10px]">YD</span></span>
                        </span>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-0.5">
                            <Heart className={`w-3.5 h-3.5 ${item.isLiked ? "fill-red-500 text-red-500" : ""}`} />
                            {item.likeCount}
                          </span>
                          <span className="flex items-center gap-0.5">
                            <MessageSquare className="w-3.5 h-3.5" />
                            {item.commentCount}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {activeTab === "sell" && (
        <form onSubmit={handleCreateItem} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-bold text-foreground">商品タイトル</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例: レアなヘッダー画像、カスタムゲームなど"
              maxLength={50}
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-bold text-foreground">商品の説明</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="商品の詳細な説明、仕様などを記入してください"
              rows={4}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-bold text-foreground">出品アイテムの種類</label>
              <Select
                value={itemType}
                onValueChange={(val: any) => {
                  setItemType(val);
                  setItemData("");
                  if (val === "game") {
                    setSaleType("normal");
                    setIsInfiniteStock(true);
                    setStock("");
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="選択してください" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="image">画像 (ファイル選択アップロード)</SelectItem>
                  <SelectItem value="audio">音声 (ファイル選択アップロード)</SelectItem>
                  <SelectItem value="game">作成したゲーム</SelectItem>
                  <SelectItem value="user_id">ユーザーID (現在のIDを出品)</SelectItem>
                  <SelectItem value="text">テキストファイル (.txt)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-bold text-foreground">販売形式</label>
              <Select
                value={saleType}
                onValueChange={(val: any) => setSaleType(val)}
                disabled={itemType === "game"}
              >
                <SelectTrigger>
                  <SelectValue placeholder="選択してください" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">通常販売 (即時購入)</SelectItem>
                  {itemType !== "game" && <SelectItem value="auction">オークション形式</SelectItem>}
                </SelectContent>
              </Select>
              {itemType === "game" && (
                <span className="text-[10px] text-muted-foreground mt-0.5">※ ゲームは固定価格（通常販売）のみとなります</span>
              )}
            </div>
          </div>

          {/* 在庫数量（通常販売のみ） */}
          {itemType !== "game" && saleType === "normal" && (
            <div className="flex flex-col gap-1.5 border border-border/40 p-3 rounded-2xl bg-secondary/5 mt-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                  販売数量の設定
                </label>
                <label className="flex items-center gap-1.5 text-xs font-bold cursor-pointer text-primary">
                  <input
                    type="checkbox"
                    checked={isInfiniteStock}
                    onChange={(e) => {
                      setIsInfiniteStock(e.target.checked);
                      if (e.target.checked) setStock("");
                    }}
                    className="rounded text-primary focus:ring-primary w-3.5 h-3.5"
                  />
                  無限に販売する (永遠に売り続ける)
                </label>
              </div>
              {!isInfiniteStock && (
                <div className="flex items-center gap-2 mt-1 max-w-[200px]">
                  <Input
                    type="number"
                    value={stock}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, "");
                      if (val) {
                        const num = parseInt(val, 10);
                        setStock(String(Math.min(99, Math.max(1, num))));
                      } else {
                        setStock("");
                      }
                    }}
                    placeholder="数量 (1〜99)"
                    min={1}
                    max={99}
                    required={!isInfiniteStock}
                    className="h-9 text-xs"
                  />
                  <span className="text-xs font-bold text-muted-foreground shrink-0">点</span>
                </div>
              )}
            </div>
          )}

          {/* アイテムデータ入力 */}
          {itemType === "image" && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-bold text-foreground">画像ファイル</label>
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => handleFileUpload(e, "media")}
                disabled={isUploading}
                required={!itemData}
                className="cursor-pointer"
              />
              {isUploading && (
                <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> アップロード中...
                </div>
              )}
              {itemData && (
                <div className="mt-2 border border-border/60 rounded-xl overflow-hidden max-w-xs relative bg-muted/20">
                  <img src={itemData} alt="プレビュー" className="max-h-32 object-contain mx-auto" />
                  <span className="text-[10px] text-muted-foreground p-1 block truncate border-t">{itemData}</span>
                </div>
              )}
            </div>
          )}

          {itemType === "text" && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-bold text-foreground">テキストファイル (.txt)</label>
              <Input
                type="file"
                accept=".txt,text/plain"
                onChange={(e) => handleFileUpload(e, "media")}
                disabled={isUploading}
                required={!itemData}
                className="cursor-pointer"
              />
              {isUploading && (
                <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> アップロード中...
                </div>
              )}
              {itemData && (
                <div className="mt-2 border border-border/60 rounded-xl p-3 bg-muted/20 text-xs font-mono break-all max-h-32 overflow-y-auto">
                  <span className="font-bold block text-muted-foreground mb-1">アップロード完了:</span>
                  {itemData}
                </div>
              )}
            </div>
          )}

          {itemType === "audio" && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-bold text-foreground">音声ファイル</label>
              <Input
                type="file"
                accept="audio/*"
                onChange={(e) => handleFileUpload(e, "media")}
                disabled={isUploading}
                required={!itemData}
                className="cursor-pointer"
              />
              {isUploading && (
                <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> アップロード中...
                </div>
              )}
              {itemData && (
                <div className="mt-2 p-3 border border-border/60 rounded-xl bg-muted/20 flex flex-col gap-2 max-w-xs">
                  <audio src={itemData} controls className="w-full h-8" />
                  <span className="text-[10px] text-muted-foreground truncate border-t pt-1">{itemData}</span>
                </div>
              )}
            </div>
          )}

          {itemType === "game" && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-bold text-foreground">出品するゲーム</label>
              {myGames.length === 0 ? (
                <div className="text-xs text-destructive border border-destructive/20 bg-destructive/5 rounded-xl p-3 flex items-start gap-1.5">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>
                    あなたが作成したゲームはありません。ゲームスタジオ（YGS）画面からゲームを作成・保存した後に選択できます。
                  </span>
                </div>
              ) : (
                <Select
                  value={selectedGameId}
                  onValueChange={(val) => setSelectedGameId(val)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="ゲームを選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {myGames.map((g) => (
                      <SelectItem key={g.id} value={String(g.id)}>
                        {g.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {itemType === "user_id" && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 flex flex-col gap-2">
              <span className="text-xs font-bold text-amber-700 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4" />
                ユーザーID出品の注意点
              </span>
              <p className="text-xs text-amber-800/80 leading-relaxed">
                ・出品するIDはあなたの現在のIDである <strong>@{me?.username}</strong> です。<br />
                ・売却が完了すると、あなたのIDはシステムによってランダムな仮IDに変更され、元のIDの所有権は購入者に移転します。<br />
                ・オークションの場合は、落札が決定した時点でIDが解放・保留されます。
              </p>
            </div>
          )}

          {/* サムネイル画像 (任意) */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-bold text-foreground">サムネイル画像 (任意)</label>
            <Input
              type="file"
              accept="image/*"
              onChange={(e) => handleFileUpload(e, "thumbnail")}
              disabled={isThumbnailUploading}
              className="cursor-pointer"
            />
            {isThumbnailUploading && (
              <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> アップロード中...
              </div>
            )}
            {thumbnailUrl && (
              <div className="mt-2 border border-border/60 rounded-xl overflow-hidden max-w-xs relative bg-muted/20">
                <img src={thumbnailUrl} alt="サムネイルプレビュー" className="max-h-24 object-contain mx-auto" />
                <span className="text-[10px] text-muted-foreground p-1 block truncate border-t">{thumbnailUrl}</span>
              </div>
            )}
          </div>

          {/* 中身を隠すトグル */}
          <div className="flex items-center justify-between p-3 rounded-xl border border-border/40 bg-secondary/10">
            <div className="flex items-center gap-3">
              <Lock className="w-4 h-4 text-muted-foreground" />
              <div className="flex flex-col">
                <span className="text-sm font-bold text-foreground">中身を隠す</span>
                <span className="text-[11px] text-muted-foreground">有効にするとサムネイル画像のみが表示されます</span>
              </div>
            </div>
            <Switch checked={hideContent} onCheckedChange={setHideContent} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-bold text-foreground">
                {saleType === "auction" ? "開始価格 (YD)" : "販売価格 (YD)"}
              </label>
              <div className="relative">
                <Input
                  value={price}
                  onChange={(e) => handlePriceChange(e.target.value)}
                  placeholder="価格を入力"
                  className="pr-10 font-bold"
                  required
                />
                <span className="absolute right-3 top-2.5 text-xs text-muted-foreground font-bold">YD</span>
              </div>
            </div>

            {saleType === "auction" && (
              <div className="flex flex-col gap-1.5 col-span-2">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-bold text-foreground">開催期間</label>
                    <Select value={duration} onValueChange={(val) => setDuration(val)}>
                      <SelectTrigger>
                        <SelectValue placeholder="期間を選択" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 日間</SelectItem>
                        <SelectItem value="3">3 日間</SelectItem>
                        <SelectItem value="5">5 日間</SelectItem>
                        <SelectItem value="7">7 日間</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-bold text-foreground">即決価格 (YD, 任意)</label>
                    <div className="relative">
                      <Input
                        value={buyoutPrice}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9]/g, "");
                          setBuyoutPrice(val ? Number(val).toLocaleString() : "");
                        }}
                        placeholder="即時落札用の価格"
                        className="pr-10 font-bold"
                      />
                      <span className="absolute right-3 top-2.5 text-xs text-muted-foreground font-bold">YD</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <Button
            type="submit"
            disabled={isSubmitting || (itemType === "game" && !selectedGameId)}
            className="w-full h-12 rounded-full font-bold mt-4"
          >
            {isSubmitting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              `${saleType === "auction" ? "オークション出品する" : "通常販売で出品する"}`
            )}
          </Button>
        </form>
      )}

      {activeTab === "history" && (
        <div className="flex flex-col gap-4">
          {/* 取引履歴タブ */}
          <div className="flex flex-col gap-2">
            <h2 className="text-base font-bold">購入履歴</h2>
            {items.filter((item) => item.isBought).length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground border border-dashed rounded-xl">
                購入した商品はありません
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {items
                  .filter((item) => item.isBought)
                  .map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3 border rounded-xl hover:bg-secondary/30 transition-colors"
                    >
                      <div className="flex flex-col min-w-0 cursor-pointer" onClick={() => setLocation(`/market/${item.id}`)}>
                        <span className="text-sm font-bold truncate">{item.title}</span>
                        <span className="text-xs text-muted-foreground mt-0.5">出品者: @{item.seller?.username}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-rounded font-black text-sm text-amber-600">{item.price.toLocaleString()} YD</span>
                        {item.itemType === "game" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(`/games/${item.itemData}`, '_blank');
                            }}
                            className="h-8 rounded-full text-xs font-bold shrink-0 border-emerald-500 text-emerald-700 hover:bg-emerald-50 flex items-center gap-1"
                          >
                            <Gamepad2 className="w-3.5 h-3.5" />
                            遊ぶ
                          </Button>
                        )}
                        {(item.itemType === "image" || item.itemType === "audio" || item.itemType === "text") && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownload(item.itemData, item.title);
                            }}
                            className="h-8 rounded-full text-xs font-bold shrink-0 animate-fade-in"
                          >
                            ダウンロード
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2 mt-4">
            <h2 className="text-base font-bold">販売履歴</h2>
            {items.filter((item) => item.seller?.id === me?.id && item.status === "completed").length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground border border-dashed rounded-xl">
                売却済みの商品はありません
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {items
                  .filter((item) => item.seller?.id === me?.id && item.status === "completed")
                  .map((item) => (
                    <div
                      key={item.id}
                      onClick={() => setLocation(`/market/${item.id}`)}
                      className="flex items-center justify-between p-3 border rounded-xl hover:bg-secondary/30 transition-colors cursor-pointer"
                    >
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-bold truncate">{item.title}</span>
                        <span className="text-xs text-muted-foreground mt-0.5">購入者: @{item.buyer?.username}</span>
                      </div>
                      <span className="font-rounded font-black text-sm text-amber-600">{item.price.toLocaleString()} YD</span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
