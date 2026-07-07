import { Link, useLocation } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { ja } from "date-fns/locale";
import { Heart, MessageCircle, Repeat2, Share } from "lucide-react";
import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Button } from "./ui/button";
import type { Yudate, QuotedYudate } from "@workspace/api-client-react";
import { 
  useLikeYudate, 
  useUnlikeYudate, 
  useReyudate, 
  useUnReyudate,
  getGetYudateQueryKey
} from "@workspace/api-client-react";
import YudateComposer from "./yudate-composer";
import { Dialog, DialogContent, DialogTrigger } from "./ui/dialog";

export default function YudateCard({ 
  yudate, 
  isQuoted = false,
  isDetail = false
}: { 
  yudate: Yudate | QuotedYudate; 
  isQuoted?: boolean;
  isDetail?: boolean;
}) {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [showReplyComposer, setShowReplyComposer] = useState(false);

  // If it's a quoted yudate, we don't have interactions
  const isFullYudate = !isQuoted && 'likeCount' in yudate;
  const fullYudate = yudate as Yudate;

  const likeMutation = useLikeYudate();
  const unlikeMutation = useUnlikeYudate();
  const reyudateMutation = useReyudate();
  const unreyudateMutation = useUnReyudate();

  const handleNavigate = (e: React.MouseEvent) => {
    // Don't navigate if clicking on action buttons or links
    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('a')) {
      return;
    }
    setLocation(`/yudate/${yudate.id}`);
  };

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isFullYudate) return;
    
    if (fullYudate.isLiked) {
      unlikeMutation.mutate({ id: yudate.id }, {
        onSuccess: () => {
          // Optimistic update for better UX
          queryClient.setQueryData(getGetYudateQueryKey(yudate.id), (old: any) => old ? { ...old, isLiked: false, likeCount: old.likeCount - 1 } : old);
          queryClient.invalidateQueries({ queryKey: ['/api/yudates'] });
        }
      });
    } else {
      likeMutation.mutate({ id: yudate.id }, {
        onSuccess: () => {
          queryClient.setQueryData(getGetYudateQueryKey(yudate.id), (old: any) => old ? { ...old, isLiked: true, likeCount: old.likeCount + 1 } : old);
          queryClient.invalidateQueries({ queryKey: ['/api/yudates'] });
        }
      });
    }
  };

  const handleReyudate = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isFullYudate) return;

    if (fullYudate.isReyudated) {
      unreyudateMutation.mutate({ id: yudate.id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['/api/yudates'] });
        }
      });
    } else {
      reyudateMutation.mutate({ id: yudate.id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['/api/yudates'] });
        }
      });
    }
  };

  const timeAgo = formatDistanceToNow(new Date(yudate.createdAt), { addSuffix: true, locale: ja });
  
  // Clean up "約" (about) from formatDistanceToNow for more Twitter-like feel
  const cleanTimeAgo = timeAgo.replace('約', '').replace('前', '');

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
            <Avatar className="w-12 h-12 border border-border/50 hover:opacity-90 transition-opacity">
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
            <div className="flex items-baseline gap-1.5 truncate">
              {isQuoted && (
                <Avatar className="w-5 h-5 mr-1 inline-block align-middle">
                  <AvatarImage src={yudate.author.avatarUrl || ''} />
                  <AvatarFallback className="bg-primary/20 text-primary text-[10px]">
                    {yudate.author.displayName[0]}
                  </AvatarFallback>
                </Avatar>
              )}
              <Link href={`/profile/${yudate.author.username}`} className="font-bold hover:underline truncate z-10">
                {yudate.author.displayName}
              </Link>
              <span className="text-muted-foreground text-[15px] truncate">@{yudate.author.username}</span>
              <span className="text-muted-foreground text-[15px] shrink-0">· {cleanTimeAgo}</span>
            </div>
            
            {/* Delete button logic could go here if we check current user */}
          </div>

          {/* Content */}
          <div className={`whitespace-pre-wrap break-words ${isDetail && !isQuoted ? 'text-xl leading-relaxed mt-2 mb-4' : 'text-[15px] leading-snug'}`}>
            {yudate.content}
          </div>

          {/* Quoted Yudate Nested */}
          {isFullYudate && fullYudate.quotedYudate && !isQuoted && (
            <YudateCard yudate={fullYudate.quotedYudate} isQuoted={true} />
          )}

          {/* Action Bar */}
          {isFullYudate && !isQuoted && (
            <div className={`flex justify-between items-center text-muted-foreground max-w-[425px] ${isDetail ? 'border-t border-border/50 pt-3 mt-4 mb-2' : 'mt-3'}`}>
              
              <Dialog open={showReplyComposer} onOpenChange={setShowReplyComposer}>
                <DialogTrigger asChild>
                  <button onClick={(e) => e.stopPropagation()} className="flex items-center gap-1.5 group transition-colors hover:text-blue-500">
                    <div className="p-2 rounded-full group-hover:bg-blue-500/10 transition-colors">
                      <MessageCircle className="w-[18px] h-[18px]" />
                    </div>
                    <span className="text-sm font-medium">{fullYudate.replyCount > 0 ? fullYudate.replyCount : ''}</span>
                  </button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[600px] p-0 border-none bg-transparent shadow-none" onClick={(e) => e.stopPropagation()}>
                  <div className="bg-background rounded-2xl overflow-hidden border border-border shadow-xl">
                    <div className="p-4 border-b border-border/50 relative">
                      <div className="absolute top-4 left-10 w-0.5 h-[calc(100%-1rem)] bg-border/50 -z-10"></div>
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
                          <p className="mt-1">{yudate.content}</p>
                          <p className="text-muted-foreground text-sm mt-2">
                            返信先: <span className="text-primary">@{yudate.author.username}</span>
                          </p>
                        </div>
                      </div>
                    </div>
                    <YudateComposer 
                      replyToId={yudate.id} 
                      onSuccess={() => {
                        setShowReplyComposer(false);
                        queryClient.invalidateQueries({ queryKey: ['/api/yudates'] });
                        queryClient.invalidateQueries({ queryKey: getGetYudateQueryKey(yudate.id) });
                      }} 
                    />
                  </div>
                </DialogContent>
              </Dialog>

              <button 
                onClick={handleReyudate}
                className={`flex items-center gap-1.5 group transition-colors ${fullYudate.isReyudated ? 'text-primary' : 'hover:text-primary'}`}
              >
                <div className={`p-2 rounded-full transition-colors ${fullYudate.isReyudated ? 'bg-primary/10' : 'group-hover:bg-primary/10'}`}>
                  <Repeat2 className="w-[18px] h-[18px]" />
                </div>
                <span className={`text-sm font-medium ${fullYudate.isReyudated ? 'font-bold' : ''}`}>
                  {fullYudate.reyudateCount > 0 ? fullYudate.reyudateCount : ''}
                </span>
              </button>

              <button 
                onClick={handleLike}
                className={`flex items-center gap-1.5 group transition-colors ${fullYudate.isLiked ? 'text-pink-500' : 'hover:text-pink-500'}`}
              >
                <div className={`p-2 rounded-full transition-colors ${fullYudate.isLiked ? 'bg-pink-500/10' : 'group-hover:bg-pink-500/10'}`}>
                  <Heart className={`w-[18px] h-[18px] ${fullYudate.isLiked ? 'fill-current' : ''}`} />
                </div>
                <span className={`text-sm font-medium ${fullYudate.isLiked ? 'font-bold' : ''}`}>
                  {fullYudate.likeCount > 0 ? fullYudate.likeCount : ''}
                </span>
              </button>

              <button onClick={(e) => e.stopPropagation()} className="flex items-center gap-1.5 group transition-colors hover:text-primary">
                <div className="p-2 rounded-full group-hover:bg-primary/10 transition-colors">
                  <Share className="w-[18px] h-[18px]" />
                </div>
              </button>

            </div>
          )}
        </div>
      </div>
    </article>
  );
}