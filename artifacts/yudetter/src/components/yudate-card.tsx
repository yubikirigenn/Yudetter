import { Link, useLocation } from "wouter";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Heart, MessageCircle, Repeat2, Share, Quote } from "lucide-react";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import type { Yudate, QuotedYudate } from "@workspace/api-client-react";
import {
  useLikeYudate,
  useUnlikeYudate,
  useReyudate,
  useUnReyudate,
  getGetYudateQueryKey,
} from "@workspace/api-client-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Dialog, DialogContent } from "./ui/dialog";
import YudateComposer from "./yudate-composer";

/** Fixed-width count so icons never shift when the number changes */
function ActionCount({ value }: { value: number }) {
  return (
    <span className="text-sm font-medium tabular-nums w-5 text-left leading-none">
      {value > 0 ? value : ""}
    </span>
  );
}

function formatRelativeTime(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${Math.max(1, seconds)}秒前`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}分前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}時間前`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}日前`;
  // Older than a week — show actual date
  const now = new Date();
  if (date.getFullYear() === now.getFullYear()) {
    return format(date, 'M月d日', { locale: ja });
  }
  return format(date, 'yyyy年M月d日', { locale: ja });
}

export default function YudateCard({
  yudate,
  isQuoted = false,
  isDetail = false,
}: {
  yudate: Yudate | QuotedYudate;
  isQuoted?: boolean;
  isDetail?: boolean;
}) {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [showReplyDialog, setShowReplyDialog] = useState(false);
  const [showQuoteDialog, setShowQuoteDialog] = useState(false);

  const isFullYudate = !isQuoted && 'likeCount' in yudate;
  const fullYudate = yudate as Yudate;

  const likeMutation = useLikeYudate();
  const unlikeMutation = useUnlikeYudate();
  const reyudateMutation = useReyudate();
  const unreyudateMutation = useUnReyudate();

  const handleNavigate = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('a')) return;
    setLocation(`/yudate/${yudate.id}`);
  };

  const invalidateFeeds = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/yudates'] });
    queryClient.invalidateQueries({ queryKey: ['/api/explore'] });
    queryClient.invalidateQueries({ queryKey: ['/api/explore/popular'] });
    queryClient.invalidateQueries({ queryKey: getGetYudateQueryKey(yudate.id) });
  };

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isFullYudate) return;
    if (fullYudate.isLiked) {
      unlikeMutation.mutate({ id: yudate.id }, {
        onSuccess: () => {
          queryClient.setQueryData(getGetYudateQueryKey(yudate.id), (old: any) =>
            old ? { ...old, isLiked: false, likeCount: Math.max(0, old.likeCount - 1) } : old
          );
          invalidateFeeds();
        }
      });
    } else {
      likeMutation.mutate({ id: yudate.id }, {
        onSuccess: () => {
          queryClient.setQueryData(getGetYudateQueryKey(yudate.id), (old: any) =>
            old ? { ...old, isLiked: true, likeCount: old.likeCount + 1 } : old
          );
          invalidateFeeds();
        }
      });
    }
  };

  const handleReyudate = () => {
    if (!isFullYudate) return;
    if (fullYudate.isReyudated) {
      unreyudateMutation.mutate({ id: yudate.id }, { onSuccess: invalidateFeeds });
    } else {
      reyudateMutation.mutate({ id: yudate.id }, { onSuccess: invalidateFeeds });
    }
  };

  const timeAgo = formatRelativeTime(new Date(yudate.createdAt));

  return (
    <article
      onClick={!isQuoted ? handleNavigate : undefined}
      className={`
        relative border-b border-border/50 bg-background
        ${!isQuoted && !isDetail ? 'cursor-pointer hover:bg-secondary/20 transition-colors' : ''}
        ${isQuoted ? 'border rounded-xl mt-3 mx-0 hover:bg-secondary/40 overflow-hidden' : 'p-4'}
        ${isDetail ? 'text-lg px-4 pt-4 pb-2' : ''}
      `}
    >
      <div className={`flex gap-3 ${isQuoted ? 'p-3' : ''}`}>
        {!isQuoted && (
          <Link href={`/profile/${yudate.author.username}`} className="shrink-0 z-10">
            <Avatar className="w-10 h-10 sm:w-12 sm:h-12 border border-border/50 hover:opacity-90 transition-opacity">
              <AvatarImage src={yudate.author.avatarUrl || ''} />
              <AvatarFallback className="bg-primary/20 text-primary font-bold">
                {yudate.author.displayName[0]}
              </AvatarFallback>
            </Avatar>
          </Link>
        )}

        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-baseline justify-between gap-1 mb-1">
            <div className="flex items-baseline gap-1.5 min-w-0 flex-wrap">
              {isQuoted && (
                <Avatar className="w-5 h-5 mr-1 inline-block align-middle shrink-0">
                  <AvatarImage src={yudate.author.avatarUrl || ''} />
                  <AvatarFallback className="bg-primary/20 text-primary text-[10px]">
                    {yudate.author.displayName[0]}
                  </AvatarFallback>
                </Avatar>
              )}
              <Link href={`/profile/${yudate.author.username}`} className="font-bold hover:underline truncate z-10 max-w-[120px] sm:max-w-none">
                {yudate.author.displayName}
              </Link>
              <span className="text-muted-foreground text-[13px] sm:text-[15px] truncate">@{yudate.author.username}</span>
              <span className="text-muted-foreground text-[13px] sm:text-[15px] shrink-0">· {timeAgo}</span>
            </div>
          </div>

          {/* Content */}
          <div className={`whitespace-pre-wrap break-words ${isDetail && !isQuoted ? 'text-xl leading-relaxed mt-2 mb-4' : 'text-[15px] leading-snug'}`}>
            {yudate.content}
          </div>

          {/* Nested quoted yudate */}
          {isFullYudate && fullYudate.quotedYudate && !isQuoted && (
            <YudateCard yudate={fullYudate.quotedYudate} isQuoted={true} />
          )}

          {/* Action Bar */}
          {isFullYudate && !isQuoted && (
            <div className={`flex items-center gap-0 text-muted-foreground ${isDetail ? 'border-t border-border/50 pt-3 mt-4 mb-2 justify-around' : 'mt-3 justify-between max-w-[340px] sm:max-w-[425px]'}`}>

              {/* Reply */}
              <button
                onClick={(e) => { e.stopPropagation(); setShowReplyDialog(true); }}
                className="flex items-center gap-1 group transition-colors hover:text-blue-500 min-w-[44px]"
              >
                <div className="p-2 rounded-full group-hover:bg-blue-500/10 transition-colors">
                  <MessageCircle className="w-[18px] h-[18px]" />
                </div>
                <ActionCount value={fullYudate.replyCount} />
              </button>

              {/* Reyudate dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    onClick={(e) => e.stopPropagation()}
                    className={`flex items-center gap-1 group transition-colors min-w-[44px] ${fullYudate.isReyudated ? 'text-primary' : 'hover:text-primary'}`}
                  >
                    <div className={`p-2 rounded-full transition-colors ${fullYudate.isReyudated ? 'bg-primary/10' : 'group-hover:bg-primary/10'}`}>
                      <Repeat2 className="w-[18px] h-[18px]" />
                    </div>
                    <ActionCount value={fullYudate.reyudateCount} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent onClick={(e) => e.stopPropagation()}>
                  <DropdownMenuItem
                    className="gap-2 cursor-pointer"
                    onClick={(e) => { e.stopPropagation(); handleReyudate(); }}
                  >
                    <Repeat2 className="w-4 h-4" />
                    {fullYudate.isReyudated ? 'リユデートを取り消す' : 'リユデート'}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="gap-2 cursor-pointer"
                    onClick={(e) => { e.stopPropagation(); setShowQuoteDialog(true); }}
                  >
                    <Quote className="w-4 h-4" />
                    引用リユデート
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Like */}
              <button
                onClick={handleLike}
                className={`flex items-center gap-1 group transition-colors min-w-[44px] ${fullYudate.isLiked ? 'text-pink-500' : 'hover:text-pink-500'}`}
              >
                <div className={`p-2 rounded-full transition-colors ${fullYudate.isLiked ? 'bg-pink-500/10' : 'group-hover:bg-pink-500/10'}`}>
                  <Heart className={`w-[18px] h-[18px] ${fullYudate.isLiked ? 'fill-current' : ''}`} />
                </div>
                <ActionCount value={fullYudate.likeCount} />
              </button>

              {/* Share */}
              <button
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1 group transition-colors hover:text-primary min-w-[44px]"
              >
                <div className="p-2 rounded-full group-hover:bg-primary/10 transition-colors">
                  <Share className="w-[18px] h-[18px]" />
                </div>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Reply dialog */}
      <Dialog open={showReplyDialog} onOpenChange={setShowReplyDialog}>
        <DialogContent className="sm:max-w-[600px] p-0 border-none bg-transparent shadow-none" onClick={(e) => e.stopPropagation()}>
          <div className="bg-background rounded-2xl overflow-hidden border border-border shadow-xl">
            <div className="p-4 border-b border-border/50 relative">
              <div className="absolute top-4 left-10 w-0.5 h-[calc(100%-1rem)] bg-border/50 -z-10" />
              <div className="flex gap-3">
                <Avatar className="w-12 h-12">
                  <AvatarImage src={yudate.author.avatarUrl || ''} />
                  <AvatarFallback>{yudate.author.displayName[0]}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold">{yudate.author.displayName}</span>
                    <span className="text-muted-foreground">@{yudate.author.username}</span>
                  </div>
                  <p className="mt-1 text-[15px]">{yudate.content}</p>
                  <p className="text-muted-foreground text-sm mt-2">
                    返信先: <span className="text-primary">@{yudate.author.username}</span>
                  </p>
                </div>
              </div>
            </div>
            <YudateComposer
              replyToId={yudate.id}
              placeholder="返信する"
              onSuccess={() => setShowReplyDialog(false)}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Quote dialog */}
      <Dialog open={showQuoteDialog} onOpenChange={setShowQuoteDialog}>
        <DialogContent className="sm:max-w-[600px] p-0 border-none bg-transparent shadow-none" onClick={(e) => e.stopPropagation()}>
          <div className="bg-background rounded-2xl overflow-hidden border border-border shadow-xl">
            <div className="px-4 pt-3 pb-1 border-b border-border/30">
              <span className="text-sm font-medium text-muted-foreground">引用リユデート</span>
            </div>
            <YudateComposer
              quotedYudateId={yudate.id}
              quotedYudatePreview={yudate}
              placeholder="このユデートについてコメントする"
              onSuccess={() => setShowQuoteDialog(false)}
              autoFocus
            />
          </div>
        </DialogContent>
      </Dialog>
    </article>
  );
}
