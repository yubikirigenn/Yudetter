import { useState, useRef, useEffect } from "react";
import { Image, Video, Mic, Timer, CalendarClock, Globe, Lock, X, Loader2, EyeOff, Coins } from "lucide-react";
import { useCreateYudate, useReplyToYudate, useGetMe } from "@workspace/api-client-react";
import type { Yudate, QuotedYudate } from "@workspace/api-client-react";
import imageCompression from "browser-image-compression";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Button } from "./ui/button";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Input } from "./ui/input";

interface YudateComposerProps {
  replyToId?: number;
  isReplyToReply?: boolean;
  isOwnPost?: boolean;
  quotedYudateId?: number;
  quotedYudatePreview?: Yudate | QuotedYudate;
  placeholder?: string;
  onSuccess?: () => void;
  autoFocus?: boolean;
}

export default function YudateComposer({
  replyToId,
  isReplyToReply = false,
  isOwnPost = false,
  quotedYudateId,
  quotedYudatePreview,
  placeholder = "いまどうしてる？",
  onSuccess,
  autoFocus,
}: YudateComposerProps) {
  const [content, setContent] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  // 新機能用 state
  const [visibility, setVisibility] = useState<"public" | "followers">("public");
  const [isSpoiler, setIsSpoiler] = useState(false);
  const [scheduledFor, setScheduledFor] = useState<string>(""); // datetime-local format
  const [autoDeleteIn, setAutoDeleteIn] = useState<number | null>(null); // 分
  const [superYudateAmount, setSuperYudateAmount] = useState("");

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: me } = useGetMe();

  const createMutation = useCreateYudate();
  const replyMutation = useReplyToYudate();

  const isPending = createMutation.isPending || replyMutation.isPending;

  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [autoFocus]);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${e.target.scrollHeight}px`;
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      let uploadFile: File | Blob = file;
      if (file.type.startsWith('image/')) {
        uploadFile = await imageCompression(file, {
          maxSizeMB: 1,
          maxWidthOrHeight: 1920,
          useWebWorker: true,
        });
      }

      const formData = new FormData();
      formData.append("file", uploadFile);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "アップロードに失敗しました");
      }

      const data = await res.json();
      setImageUrl(data.url);
    } catch (err: any) {
      toast({ title: err.message || "アップロードに失敗しました", variant: "destructive" });
    } finally {
      setIsUploading(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
      if (videoInputRef.current) videoInputRef.current.value = "";
      if (audioInputRef.current) audioInputRef.current.value = "";
    }
  };

  const invalidateFeeds = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/yudates'] });
    queryClient.invalidateQueries({ queryKey: ['/api/explore'] });
    queryClient.invalidateQueries({ queryKey: ['/api/explore/popular'] });
    if (me?.username) {
      queryClient.invalidateQueries({ queryKey: ['/api/users', me.username, 'yudates'] });
    }
  };

  const handleSubmit = () => {
    if (!content.trim() || isPending) return;

    let finalScheduledFor: Date | null = null;
    if (scheduledFor) {
      const d = new Date(scheduledFor);
      if (!isNaN(d.getTime())) finalScheduledFor = d;
    }

    let finalAutoDeleteAt: Date | null = null;
    if (autoDeleteIn) {
      finalAutoDeleteAt = new Date(Date.now() + autoDeleteIn * 60000);
    }

    const superAmountVal = Number(superYudateAmount) || 0;
    if (superAmountVal > 0) {
      if (isOwnPost) {
        toast({ title: "自分の投稿にはスーパーユデートできません", variant: "destructive" });
        return;
      }
      if (superAmountVal < 1 || superAmountVal > 100000) {
        toast({ title: "スーパーユデートは1YD〜100,000YDで指定してください", variant: "destructive" });
        return;
      }
      if (me && me.yudedollar < superAmountVal) {
        toast({ title: "YD残高が不足しています", variant: "destructive" });
        return;
      }
    }

    const payload = {
      content: content.trim(),
      imageUrl: imageUrl ?? undefined,
      visibility,
      scheduledFor: finalScheduledFor?.toISOString(),
      autoDeleteAt: finalAutoDeleteAt?.toISOString(),
      isSpoiler,
      superYudateAmount: superAmountVal > 0 ? superAmountVal : undefined,
    };

    if (replyToId) {
      replyMutation.mutate({ id: replyToId, data: payload as any }, {
        onSuccess: () => {
          resetComposer();
          toast({ title: "返信しました" });
          invalidateFeeds();
          onSuccess?.();
        },
        onError: (err: any) => {
          const errMsg = err.response?.data?.error || "エラーが発生しました";
          toast({ title: errMsg, variant: "destructive" });
        },
      });
    } else {
      createMutation.mutate({ data: { ...payload, quotedYudateId } }, {
        onSuccess: () => {
          resetComposer();
          toast({ title: quotedYudateId ? "引用リユデートしました" : (finalScheduledFor ? "予約投稿しました" : "ユデートを投稿しました") });
          invalidateFeeds();
          onSuccess?.();
        },
        onError: () => toast({ title: "エラーが発生しました", variant: "destructive" }),
      });
    }
  };

  const resetComposer = () => {
    setContent("");
    setImageUrl(null);
    setVisibility("public");
    setIsSpoiler(false);
    setScheduledFor("");
    setAutoDeleteIn(null);
    setSuperYudateAmount("");
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const progress = content.length / 280;
  const isOverLimit = content.length > 280;

  return (
    <div className="flex gap-4 p-4 border-b border-border/50 bg-background">
      <div className="shrink-0 pt-1">
        <Avatar className="w-12 h-12">
          <AvatarImage src={me?.avatarUrl || ''} />
          <AvatarFallback>{me?.displayName?.[0] || 'U'}</AvatarFallback>
        </Avatar>
      </div>
      <div className="flex-1 min-w-0">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleInput}
          placeholder={placeholder}
          className="w-full bg-transparent text-xl outline-none resize-none placeholder:text-muted-foreground mt-2 mb-2 min-h-[60px]"
          maxLength={300}
        />

        {/* Media Preview */}
        {imageUrl && (
          <div className="relative mt-2 mb-3 rounded-xl overflow-hidden border border-border bg-black/5 dark:bg-white/5">
            {(() => {
              const url = imageUrl.toLowerCase();
              if (url.endsWith('.mp4') || url.endsWith('.webm') || url.endsWith('.mov')) {
                return (
                  <video src={imageUrl} controls className="max-h-[300px] w-full object-contain" />
                );
              } else if (url.endsWith('.mp3') || url.endsWith('.wav') || url.endsWith('.m4a') || url.endsWith('.ogg')) {
                return (
                  <div className="p-4 flex justify-center">
                    <audio src={imageUrl} controls className="w-full" />
                  </div>
                );
              } else {
                return (
                  <img src={imageUrl} alt="添付メディア" className="max-h-64 w-full object-cover" />
                );
              }
            })()}
            <button
              onClick={() => setImageUrl(null)}
              className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1 hover:bg-black/80 transition-colors"
              title="削除"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Quoted yudate preview */}
        {quotedYudatePreview && (
          <div className="border border-border rounded-xl p-3 mb-3 bg-secondary/20">
            <div className="flex items-center gap-2 mb-1">
              <Avatar className="w-4 h-4">
                <AvatarImage src={quotedYudatePreview.author.avatarUrl || ''} />
                <AvatarFallback className="text-[8px]">{quotedYudatePreview.author.displayName[0]}</AvatarFallback>
              </Avatar>
              <span className="font-bold text-sm">{quotedYudatePreview.author.displayName}</span>
              <span className="text-muted-foreground text-sm">@{quotedYudatePreview.author.username}</span>
            </div>
            <p className="text-[14px] text-muted-foreground line-clamp-3">{quotedYudatePreview.content}</p>
          </div>
        )}

        {/* Super Yudate Attachment Preview */}
        {replyToId && !isReplyToReply && Number(superYudateAmount) > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-secondary/40 border border-border/60 px-2.5 py-1.5 rounded-full w-fit mb-3">
            <span>スーパーユデート: {Number(superYudateAmount).toLocaleString()} YD</span>
            <button
              type="button"
              onClick={() => setSuperYudateAmount("")}
              className="text-muted-foreground hover:text-foreground shrink-0 rounded-full hover:bg-secondary/80 p-0.5 transition-colors"
              title="解除"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Status Indicators */}
        <div className="flex flex-wrap gap-2 mb-2">
          {isSpoiler && (
            <span className="text-[12px] flex items-center gap-1 font-bold text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
              <EyeOff className="w-3 h-3" /> 閲覧注意
            </span>
          )}
          {visibility === "followers" && (
            <span className="text-[12px] flex items-center gap-1 font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
              <Lock className="w-3 h-3" /> フォロワー限定
            </span>
          )}
          {autoDeleteIn && (
            <span className="text-[12px] flex items-center gap-1 font-bold text-destructive bg-destructive/10 px-2 py-0.5 rounded-full">
              <Timer className="w-3 h-3" /> {autoDeleteIn >= 60 ? `${autoDeleteIn/60}時間後に削除` : `${autoDeleteIn}分後に削除`}
            </span>
          )}
          {scheduledFor && (
            <span className="text-[12px] flex items-center gap-1 font-bold text-orange-500 bg-orange-500/10 px-2 py-0.5 rounded-full">
              <CalendarClock className="w-3 h-3" /> 予約: {new Date(scheduledFor).toLocaleString()}
            </span>
          )}
        </div>

        <div className="flex justify-between items-center pt-3 border-t border-border/50">
          <div className="flex gap-1 text-primary relative">
            {isUploading ? (
              <div className="p-2">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            ) : (
              <>
                {/* Image */}
                <label className={`p-2 rounded-full hover:bg-primary/10 transition-colors cursor-pointer ${!!imageUrl ? 'opacity-40 pointer-events-none' : ''}`} title="画像">
                  <Image className="w-5 h-5" />
                  <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} disabled={!!imageUrl} />
                </label>
                {/* Video */}
                <label className={`p-2 rounded-full hover:bg-primary/10 transition-colors cursor-pointer ${!!imageUrl ? 'opacity-40 pointer-events-none' : ''}`} title="動画">
                  <Video className="w-5 h-5" />
                  <input ref={videoInputRef} type="file" accept="video/mp4,video/webm,video/quicktime" className="hidden" onChange={handleFileSelect} disabled={!!imageUrl} />
                </label>
                {/* Audio */}
                <label className={`p-2 rounded-full hover:bg-primary/10 transition-colors cursor-pointer ${!!imageUrl ? 'opacity-40 pointer-events-none' : ''}`} title="音声">
                  <Mic className="w-5 h-5" />
                  <input ref={audioInputRef} type="file" accept="audio/mpeg,audio/wav,audio/m4a,audio/ogg" className="hidden" onChange={handleFileSelect} disabled={!!imageUrl} />
                </label>
                {/* Super Yudate */}
                {replyToId && !isReplyToReply && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className={`p-2 rounded-full hover:bg-primary/10 transition-colors ${Number(superYudateAmount) > 0 ? "text-amber-600 bg-amber-500/10 hover:bg-amber-500/20" : ""}`}
                        title="スーパーユデート"
                      >
                        <Coins className="w-5 h-5" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-60 p-4 flex flex-col gap-3">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-bold text-xs">スーパーユデートを設定</span>
                        <span className="text-[10px] text-muted-foreground">投げ銭額を 1 〜 100,000 YD で指定します。</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Input
                          type="number"
                          id="super-yudate-popover-input"
                          placeholder="額を入力"
                          min={1}
                          max={100000}
                          defaultValue={superYudateAmount}
                          className="h-8 text-xs focus-visible:ring-amber-500"
                        />
                        <span className="text-xs font-bold text-muted-foreground shrink-0">YD</span>
                      </div>
                      <div className="flex justify-end gap-1.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const input = document.getElementById("super-yudate-popover-input") as HTMLInputElement;
                            if (input) input.value = "";
                            setSuperYudateAmount("");
                          }}
                          className="h-7 text-[10px]"
                        >
                          クリア
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => {
                            const input = document.getElementById("super-yudate-popover-input") as HTMLInputElement;
                            const val = input ? input.value : "";
                            if (!val) {
                              setSuperYudateAmount("");
                              return;
                            }
                            const num = Number(val);
                            if (isNaN(num) || num < 1 || num > 100000) {
                              toast({ title: "1〜100,000の範囲で入力してください", variant: "destructive" });
                              return;
                            }
                            setSuperYudateAmount(val);
                          }}
                          className="h-7 text-[10px] bg-amber-500 hover:bg-amber-600 text-white"
                        >
                          確定
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
              </>
            )}

            <div className="w-px h-6 bg-border/50 self-center mx-1" />

            {/* Visibility */}
            <button onClick={() => setIsSpoiler(!isSpoiler)} className={`p-2 rounded-full hover:bg-primary/10 transition-colors ${isSpoiler ? "text-primary" : ""}`} title="閲覧注意">
              <EyeOff className="w-5 h-5" />
            </button>

            {/* Visibility */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-2 rounded-full hover:bg-primary/10 transition-colors" title="公開範囲">
                  {visibility === "public" ? <Globe className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setVisibility("public")} className="gap-2">
                  <Globe className="w-4 h-4" /> 全体公開
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setVisibility("followers")} className="gap-2">
                  <Lock className="w-4 h-4" /> フォロワーのみ公開
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Auto Delete */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-2 rounded-full hover:bg-primary/10 transition-colors" title="自動削除">
                  <Timer className={`w-5 h-5 ${autoDeleteIn ? 'text-destructive' : ''}`} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setAutoDeleteIn(null)}>オフ</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setAutoDeleteIn(15)}>15分後</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setAutoDeleteIn(60)}>1時間後</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setAutoDeleteIn(24 * 60)}>24時間後</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Schedule */}
            <Popover>
              <PopoverTrigger asChild>
                <button className="p-2 rounded-full hover:bg-primary/10 transition-colors" title="予約投稿">
                  <CalendarClock className={`w-5 h-5 ${scheduledFor ? 'text-orange-500' : ''}`} />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-4 flex flex-col gap-2">
                <p className="font-bold text-sm">予約投稿日時</p>
                <Input 
                  type="datetime-local" 
                  value={scheduledFor} 
                  onChange={(e) => setScheduledFor(e.target.value)} 
                />
                <div className="flex justify-end mt-2">
                  <Button variant="outline" size="sm" onClick={() => setScheduledFor("")}>クリア</Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex items-center gap-4">
            {content.length > 0 && (
              <>
                <div className={`text-sm font-medium ${isOverLimit ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {content.length}/280
                </div>
                <div className="w-px h-8 bg-border/50" />
              </>
            )}
            <Button
              onClick={handleSubmit}
              disabled={!content.trim() || isOverLimit || isPending}
              className="rounded-full px-6 font-bold font-rounded"
            >
              {replyToId ? "返信" : quotedYudateId ? "引用する" : (scheduledFor ? "予約する" : "ユデートする")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
