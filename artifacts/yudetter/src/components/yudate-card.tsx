import { Link, useLocation } from "wouter";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Heart, MessageCircle, Repeat2, Share, Quote, SmilePlus, Trash2, MoreHorizontal, Pin, PinOff, Edit, Flag, UserMinus, UserPlus, Loader2, Lock, Ban } from "lucide-react";
import { useState, useEffect } from "react";
import EmojiPicker, { Categories } from 'emoji-picker-react';
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { useSession } from "@/lib/auth-client";
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
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import type { Yudate, QuotedYudate } from "@workspace/api-client-react";
import {
  useLikeYudate,
  useUnlikeYudate,
  useReyudate,
  useUnReyudate,
  
  getGetYudateQueryKey,
  useGetMe,
  useFollowUser,
  useUnfollowUser,
  getGetMeQueryKey,
} from "@workspace/api-client-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "./ui/tooltip";
import { Crown, Trophy, Medal } from "lucide-react";

export const UserBadge = ({ badgeType }: { badgeType: string | null | undefined }) => {
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
import YudateComposer from "./yudate-composer";
import { useToast } from "@/hooks/use-toast";
import { Button } from "./ui/button";

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

const REACTION_EMOJIS: { emoji: string; label: string }[] = [
  { emoji: "👍", label: "いいね" },
  { emoji: "❤️", label: "大好き" },
  { emoji: "😂", label: "笑える" },
  { emoji: "😮", label: "驚き" },
  { emoji: "😢", label: "悲しい" },
  { emoji: "🎉", label: "お祝い" },
  { emoji: "🔥", label: "熱い" },
  { emoji: "💯", label: "100点" },
  { emoji: "👏", label: "拍手" },
  { emoji: "🙌", label: "万歳" },
  { emoji: "🙏", label: "お願い" },
  { emoji: "✨", label: "キラキラ" },
  { emoji: "🤔", label: "考え中" },
  { emoji: "👀", label: "注目" },
  { emoji: "🚀", label: "ロケット" },
  { emoji: "💡", label: "ひらめき" },
];

/** Renders markdown + KaTeX safely */
function MarkdownContent({ content, className }: { content: string; className?: string }) {
  // Convert plain newlines to markdown-compatible newlines (two spaces + newline)
  let formattedContent = (content || "").replace(/\n/g, "  \n");

  // 1. Auto-link hashtags (e.g. #tag -> [#tag](/explore?q=%23tag))
  formattedContent = formattedContent.replace(
    /(^|\s)#([^\s#@.,!?:;'"“”‘’()\[\]{}&|~^*+=\-\\/<>`]+)/g,
    (match, space, tag) => {
      return `${space}[#${tag}](/explore?q=${encodeURIComponent('#' + tag)})`;
    }
  );

  // 2. Auto-link mentions (e.g. @user -> [@user](/profile/user))
  formattedContent = formattedContent.replace(
    /(^|\s)@([a-zA-Z0-9_]+)/g,
    (match, space, username) => {
      return `${space}[@${username}](/profile/${username})`;
    }
  );

  return (
    <div className={`prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap ${className || ''}`}>
      <ReactMarkdown
        remarkPlugins={[remarkMath, remarkGfm]}
        rehypePlugins={[rehypeKatex]}
        components={{
          // Use wouter Link for app-internal routing (hashtags/mentions), normal a tag for external
          a: ({ children, href }) => {
            const isInternal = href?.startsWith("/");
            if (isInternal) {
              return (
                <Link href={href} className="text-primary hover:underline font-bold">
                  {children}
                </Link>
              );
            }
            return (
              <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                {children}
              </a>
            );
          },
          // 見出し（カード内でも視覚的に区別できるサイズ）
          h1: ({ children }) => <h1 className="text-xl font-bold leading-tight mt-2 mb-1">{children}</h1>,
          h2: ({ children }) => <h2 className="text-lg font-bold leading-tight mt-2 mb-1">{children}</h2>,
          h3: ({ children }) => <h3 className="text-base font-semibold leading-tight mt-1.5 mb-0.5">{children}</h3>,
        }}
      >
        {formattedContent}
      </ReactMarkdown>
    </div>
  );
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
  const [isDeleting, setIsDeleting] = useState(false);
  const [showSpoiler, setShowSpoiler] = useState(false);
  const { toast } = useToast();
  const { data: session } = useSession();
  const user = session?.user;

  const isFullYudate = !isQuoted && 'likeCount' in yudate;
  const fullYudate = yudate as Yudate;

  // いいね＆リユデートのローカルステート制御（これによって値の一瞬のブレや2重カウントを防ぐ）
  const [localLiked, setLocalLiked] = useState(fullYudate.isLiked);
  const [localLikeCount, setLocalLikeCount] = useState(fullYudate.likeCount);
  const [localReyudated, setLocalReyudated] = useState(fullYudate.isReyudated);
  const [localReyudateCount, setLocalReyudateCount] = useState(fullYudate.reyudateCount);

  // キャッシュや他のタイムラインの更新に応じてローカルステートを正確に同期
  useEffect(() => {
    setLocalLiked(fullYudate.isLiked);
    setLocalLikeCount(fullYudate.likeCount);
  }, [fullYudate.isLiked, fullYudate.likeCount]);

  useEffect(() => {
    setLocalReyudated(fullYudate.isReyudated);
    setLocalReyudateCount(fullYudate.reyudateCount);
  }, [fullYudate.isReyudated, fullYudate.reyudateCount]);

  const { data: me } = useGetMe();

  // 自分の投稿かどうか判定 (Clerkユーザーのusernameと投稿者のusernameを比較)
  const isOwn = !!me && me.username === yudate.author.username;
  const followMutation = useFollowUser();
  const unfollowMutation = useUnfollowUser();

  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showBlockDialog, setShowBlockDialog] = useState(false);
  const [isBlocking, setIsBlocking] = useState(false);
  const [editContent, setEditContent] = useState(yudate.content);
  const [isEditingSubmit, setIsEditingSubmit] = useState(false);

  const isPinned = me?.pinnedYudateId === yudate.id;
  const isFollowingAuthor = yudate.author.isFollowing;

  const likeMutation = useLikeYudate();
  const unlikeMutation = useUnlikeYudate();
  const reyudateMutation = useReyudate();
  const unreyudateMutation = useUnReyudate();
  const addReactionMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number, data: { emoji: string } }) => {
      const res = await fetch(`/api/yudates/${id}/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error();
      return res.json();
    }
  });

  const removeReactionMutation = useMutation({
    mutationFn: async ({ id, emoji }: { id: number, emoji: string }) => {
      const res = await fetch(`/api/yudates/${id}/reactions/${encodeURIComponent(emoji)}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      return res.json();
    }
  });

  const handleNavigate = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('a')) return;
    setLocation(`/yudate/${yudate.id}`);
  };

  const invalidateFeeds = () => {
    // predicate で全てのexplore/yudates関連クエリを無効化（infiniteクエリも含む）
    queryClient.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey;
        return key.some((k) =>
          typeof k === 'string' && (
            k.includes('/api/explore') ||
            k.includes('/api/yudates')
          )
        );
      }
    });
    queryClient.invalidateQueries({ queryKey: getGetYudateQueryKey(yudate.id) });
    queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
    if (yudate.author?.username) {
      queryClient.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string)?.startsWith?.(`/api/users/${yudate.author.username}`) });
    }
  };

  const handleFollowToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!yudate.author.username) return;

    if (isFollowingAuthor) {
      unfollowMutation.mutate({ username: yudate.author.username }, {
        onSuccess: () => {
          toast({ title: `@${yudate.author.username}のフォローを解除しました` });
          invalidateFeeds();
        },
        onError: () => {
          toast({ title: "フォロー解除に失敗しました", variant: "destructive" });
        }
      });
    } else {
      followMutation.mutate({ username: yudate.author.username }, {
        onSuccess: () => {
          toast({ title: `@${yudate.author.username}をフォローしました` });
          invalidateFeeds();
        },
        onError: () => {
          toast({ title: "フォローに失敗しました", variant: "destructive" });
        }
      });
    }
  };

  const handlePinToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const endpoint = isPinned ? `/api/yudates/${yudate.id}/unpin` : `/api/yudates/${yudate.id}/pin`;
      const res = await fetch(endpoint, { method: "POST" });
      if (!res.ok) throw new Error();

      toast({ title: isPinned ? "プロフィール固定を解除しました" : "プロフィールに固定しました" });
      invalidateFeeds();
    } catch {
      toast({ title: "固定処理に失敗しました", variant: "destructive" });
    }
  };

  const handleReport = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("このユデートを通報しますか？\n通報は管理者に送信され、確認が行われます。")) {
      return;
    }
    try {
      const res = await fetch(`/api/yudates/${yudate.id}/report`, { method: "POST" });
      if (!res.ok) throw new Error();

      toast({ title: "このユデートを通報しました。@Yudetter管理者に通知されます。" });
    } catch {
      toast({ title: "通報に失敗しました", variant: "destructive" });
    }
  };

  const handleBlock = async () => {
    setIsBlocking(true);
    try {
      const res = await fetch(`/api/users/${yudate.author.username}/block`, { method: "POST" });
      if (!res.ok) throw new Error();
      toast({ title: "ブロックしました" });
      // キャッシュを完全に削除して古いデータが表示されないようにする
      queryClient.removeQueries({
        predicate: (query) => {
          const key = query.queryKey;
          return key.some((k) =>
            typeof k === 'string' && (
              k.includes('/api/explore') ||
              k.includes('/api/yudates')
            )
          );
        }
      });
      invalidateFeeds();
      setShowBlockDialog(false);
    } catch {
      toast({ title: "ブロックに失敗しました", variant: "destructive" });
    } finally {
      setIsBlocking(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editContent.trim()) return;

    setIsEditingSubmit(true);
    try {
      const res = await fetch(`/api/yudates/${yudate.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editContent.trim() }),
      });
      if (!res.ok) throw new Error();

      toast({ title: "ユデートを編集しました" });
      setShowEditDialog(false);
      invalidateFeeds();
    } catch {
      toast({ title: "編集に失敗しました", variant: "destructive" });
    } finally {
      setIsEditingSubmit(false);
    }
  };

  const updateCachedYudate = (yudateId: number, updater: (old: any) => any) => {
    queryClient.setQueryData(getGetYudateQueryKey(yudateId), updater);

    const listKeys = [
      ['/api/yudates'],
      ['/api/explore'],
      ['/api/explore/popular']
    ];
    if (yudate.author.username) {
      listKeys.push(['/api/users', yudate.author.username, 'yudates']);
      listKeys.push(['/api/users', yudate.author.username, 'likes']);
    }
    if (me?.username) {
      listKeys.push(['/api/users', me.username, 'yudates']);
      listKeys.push(['/api/users', me.username, 'likes']);
    }

    listKeys.forEach((key) => {
      queryClient.setQueryData(key, (old: any) => {
        if (!old) return old;
        if (old && typeof old === 'object' && 'items' in old && Array.isArray(old.items)) {
          return {
            ...old,
            items: old.items.map((item: any) =>
              item.id === yudateId ? updater(item) : item
            )
          };
        }
        if (Array.isArray(old)) {
          return old.map((item: any) =>
            item.id === yudateId ? updater(item) : item
          );
        }
        return old;
      });
    });
  };

  const handleLike = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.blur();
    e.stopPropagation();
    if (!isFullYudate) return;
    
    const isLiked = localLiked;
    const nextLiked = !isLiked;
    const nextCount = Math.max(0, localLikeCount + (nextLiked ? 1 : -1));

    // 即座にローカルステートを切り替える（描画上のラグ、2重カウントを完璧に排除）
    setLocalLiked(nextLiked);
    setLocalLikeCount(nextCount);

    // キャッシュも同時に楽観アップデート
    updateCachedYudate(yudate.id, (old: any) => {
      if (!old) return old;
      return {
        ...old,
        isLiked: nextLiked,
        likeCount: nextCount
      };
    });

    if (isLiked) {
      unlikeMutation.mutate({ id: yudate.id }, {
        onError: () => {
          // エラー時のロールバック
          setLocalLiked(true);
          setLocalLikeCount(localLikeCount);
          updateCachedYudate(yudate.id, (old: any) => {
            if (!old) return old;
            return {
              ...old,
              isLiked: true,
              likeCount: localLikeCount
            };
          });
        },
        onSettled: invalidateFeeds
      });
    } else {
      likeMutation.mutate({ id: yudate.id }, {
        onError: () => {
          // エラー時のロールバック
          setLocalLiked(false);
          setLocalLikeCount(localLikeCount);
          updateCachedYudate(yudate.id, (old: any) => {
            if (!old) return old;
            return {
              ...old,
              isLiked: false,
              likeCount: localLikeCount
            };
          });
        },
        onSettled: invalidateFeeds
      });
    }
  };

  const handleReyudate = () => {
    if (!isFullYudate) return;
    
    const isReyudated = localReyudated;
    const nextReyudated = !isReyudated;
    const nextCount = Math.max(0, localReyudateCount + (nextReyudated ? 1 : -1));

    setLocalReyudated(nextReyudated);
    setLocalReyudateCount(nextCount);

    updateCachedYudate(yudate.id, (old: any) => {
      if (!old) return old;
      return {
        ...old,
        isReyudated: nextReyudated,
        reyudateCount: nextCount
      };
    });

    if (isReyudated) {
      unreyudateMutation.mutate({ id: yudate.id }, {
        onError: () => {
          setLocalReyudated(true);
          setLocalReyudateCount(localReyudateCount);
          updateCachedYudate(yudate.id, (old: any) => {
            if (!old) return old;
            return {
              ...old,
              isReyudated: true,
              reyudateCount: localReyudateCount
            };
          });
        },
        onSettled: invalidateFeeds
      });
    } else {
      reyudateMutation.mutate({ id: yudate.id }, {
        onError: () => {
          setLocalReyudated(false);
          setLocalReyudateCount(localReyudateCount);
          updateCachedYudate(yudate.id, (old: any) => {
            if (!old) return old;
            return {
              ...old,
              isReyudated: false,
              reyudateCount: localReyudateCount
            };
          });
        },
        onSettled: invalidateFeeds
      });
    }
  };

  const handleReaction = (emoji: string) => {
    if (!isFullYudate) return;
    const existing = fullYudate.reactions?.find((r) => r.emoji === emoji);
    const isReacted = !!existing?.isReacted;

    updateCachedYudate(yudate.id, (old: any) => {
      if (!old) return old;
      let nextReactions = [...(old.reactions || [])];
      const target = nextReactions.find((r) => r.emoji === emoji);

      if (isReacted) {
        if (target) {
          if (target.count <= 1) {
            nextReactions = nextReactions.filter((r) => r.emoji !== emoji);
          } else {
            target.count -= 1;
            target.isReacted = false;
          }
        }
      } else {
        if (target) {
          target.count += 1;
          target.isReacted = true;
        } else {
          nextReactions.push({ emoji, count: 1, isReacted: true });
        }
      }

      return {
        ...old,
        reactions: nextReactions
      };
    });

    if (isReacted) {
      removeReactionMutation.mutate({ id: yudate.id, emoji }, {
        onError: () => {
          invalidateFeeds();
        },
        onSettled: invalidateFeeds
      });
    } else {
      addReactionMutation.mutate({ id: yudate.id, data: { emoji } }, {
        onError: () => {
          invalidateFeeds();
        },
        onSettled: invalidateFeeds
      });
    }
  };

    const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}/yudate/${yudate.id}`;
    if (navigator.share) {
      try {
        await navigator.share({ url, text: yudate.content.slice(0, 100) });
      } catch {
        // User cancelled share
      }
    } else {
      try {
        await navigator.clipboard.writeText(url);
        toast({ title: "リンクをコピーしました" });
      } catch {
        toast({ title: "リンクのコピーに失敗しました", variant: "destructive" });
      }
    }
  };

  const performDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/yudates/${yudate.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast({ title: "ユデートを削除しました" });
      // フィードを更新
      queryClient.invalidateQueries({ queryKey: ['/api/yudates'] });
      queryClient.invalidateQueries({ queryKey: ['/api/explore'] });
      queryClient.invalidateQueries({ queryKey: ['/api/explore/popular'] });
      if (yudate.author.username) {
        queryClient.invalidateQueries({ queryKey: ['/api/users', yudate.author.username, 'yudates'] });
      }
      // 詳細ページにいたらホームへ
      if (isDetail) setLocation('/');
    } catch {
      toast({ title: "削除に失敗しました", variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  const timeAgo = formatRelativeTime(new Date(yudate.createdAt));
 
  const hasSuper = yudate.superYudateAmount !== undefined && yudate.superYudateAmount !== null && yudate.superYudateAmount > 0;
  const superStyle = hasSuper
    ? yudate.superYudateAmount >= 5000 ? "border-amber-500/80 bg-amber-500/5 dark:bg-amber-500/10 border-2 rounded-2xl" :
      yudate.superYudateAmount >= 1000 ? "border-pink-500/60 bg-pink-500/5 dark:bg-pink-500/10 border rounded-xl" :
      yudate.superYudateAmount >= 500 ? "border-orange-500/50 bg-orange-500/5 dark:bg-orange-500/10 border rounded-xl" :
      yudate.superYudateAmount >= 100 ? "border-teal-500/40 bg-teal-500/5 dark:bg-teal-500/10 border rounded-xl" :
      "border-blue-500/30 bg-blue-500/5 dark:bg-blue-500/10 border rounded-xl"
    : "";
 
  return (
    <article
      onClick={(e) => {
        if (isQuoted) {
          e.stopPropagation();
        }
        handleNavigate(e);
      }}
      className={`
        relative border-b border-border/50 bg-background transition-all overflow-hidden
        ${!isDetail ? 'cursor-pointer hover:bg-secondary/20' : ''}
        ${isQuoted ? 'border rounded-xl mt-3 mx-0 overflow-hidden shadow-sm hover:border-border/80' : ''}
        ${!isQuoted && hasSuper ? 'p-0' : !isQuoted ? 'p-4' : hasSuper ? 'p-0' : 'p-3'}
        ${isDetail ? 'text-lg px-4 pt-4 pb-2' : ''}
        ${superStyle}
      `}
    >
      {hasSuper && (
        <div className={`
          flex items-center gap-1.5 px-4 py-2 text-[11px] font-bold font-rounded text-white shadow-inner
          ${yudate.superYudateAmount >= 5000 ? 'bg-gradient-to-r from-red-600 via-amber-500 to-yellow-500 animate-pulse' : ''}
          ${yudate.superYudateAmount >= 1000 && yudate.superYudateAmount < 5000 ? 'bg-gradient-to-r from-purple-600 via-pink-500 to-rose-500' : ''}
          ${yudate.superYudateAmount >= 500 && yudate.superYudateAmount < 1000 ? 'bg-gradient-to-r from-amber-500 to-orange-500' : ''}
          ${yudate.superYudateAmount >= 100 && yudate.superYudateAmount < 500 ? 'bg-gradient-to-r from-teal-500 to-emerald-500' : ''}
          ${yudate.superYudateAmount >= 1 && yudate.superYudateAmount < 100 ? 'bg-gradient-to-r from-blue-500 to-indigo-500' : ''}
        `}>
          <span>スーパーユデート</span>
          <span className="ml-auto font-black text-xs tracking-wider">{yudate.superYudateAmount.toLocaleString()} YD</span>
        </div>
      )}
 
      <div className={`flex gap-3 ${!isQuoted && hasSuper ? 'p-4' : isQuoted && hasSuper ? 'p-3' : isQuoted ? 'p-0' : ''}`}>
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
          <div className="flex items-start justify-between gap-1 mb-1">
            <div className="flex items-baseline gap-1.5 min-w-0 flex-wrap">
              {isQuoted && (
                <Avatar className="w-5 h-5 mr-1 inline-block align-middle shrink-0">
                  <AvatarImage src={yudate.author.avatarUrl || ''} />
                  <AvatarFallback className="bg-primary/20 text-primary text-[10px]">
                    {yudate.author.displayName[0]}
                  </AvatarFallback>
                </Avatar>
              )}
              <Link href={`/profile/${yudate.author.username}`} className="font-bold hover:underline truncate z-10 max-w-[120px] sm:max-w-none inline-flex items-center gap-1">
                <span>{yudate.author.displayName}</span>
                <UserBadge badgeType={(yudate.author as any).badgeType} />
                {yudate.author.isPrivate && <Lock className="w-4 h-4 text-muted-foreground" />}
              </Link>
              <span className="text-muted-foreground text-[13px] sm:text-[15px] truncate">@{yudate.author.username}</span>
              <span className="text-muted-foreground text-[13px] sm:text-[15px] shrink-0">· {timeAgo}</span>
              {(yudate as any).visibility === 'followers' && (
                <span className="text-primary bg-primary/10 px-1.5 py-0.5 rounded flex items-center gap-1 text-[10px] sm:text-[11px] font-bold shrink-0 ml-1">
                  <Lock className="w-3 h-3" />
                  フォロワー限定
                </span>
              )}
            </div>

            {/* Right-side '...' Dropdown Menu */}
            {user && !isQuoted && (
              <div onClick={(e) => e.stopPropagation()} className="z-10 shrink-0">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="p-1.5 rounded-full hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    {isOwn ? (
                      <>
                        <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => setShowEditDialog(true)}>
                          <Edit className="w-4 h-4" />
                          ユデートを編集
                        </DropdownMenuItem>
                        <DropdownMenuItem className="gap-2 cursor-pointer" onClick={handlePinToggle}>
                          {isPinned ? (
                            <>
                              <PinOff className="w-4 h-4" />
                              固定解除
                            </>
                          ) : (
                            <>
                              <Pin className="w-4 h-4" />
                              固定する
                            </>
                          )}
                        </DropdownMenuItem>
                        <div className="-mx-1 my-1 h-px bg-muted" />
                        <DropdownMenuItem className="gap-2 cursor-pointer text-destructive focus:text-destructive" onClick={() => setShowDeleteDialog(true)}>
                          <Trash2 className="w-4 h-4" />
                          削除する
                        </DropdownMenuItem>
                      </>
                    ) : (
                      <>
                        <DropdownMenuItem className="gap-2 cursor-pointer" onClick={handleFollowToggle}>
                          {isFollowingAuthor ? (
                            <>
                              <UserMinus className="w-4 h-4" />
                              フォロー解除
                            </>
                          ) : (
                            <>
                              <UserPlus className="w-4 h-4" />
                              フォローする
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem className="gap-2 cursor-pointer" onClick={handleReport}>
                          <Flag className="w-4 h-4" />
                          通報する
                        </DropdownMenuItem>
                        <DropdownMenuItem className="gap-2 cursor-pointer text-destructive focus:text-destructive" onClick={(e) => { e.stopPropagation(); setShowBlockDialog(true); }}>
                          <Ban className="w-4 h-4" />
                          ブロックする
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>

          {yudate.replyToId !== null && !isQuoted && (
            <div className="text-[12px] text-primary/80 font-bold mt-1 mb-2 flex items-center gap-1 select-none">
              <span>返信</span>
            </div>
          )}


          {(yudate as any).isSpoiler && !showSpoiler ? (
            <div className="mt-2 mb-4">
              <Button variant="outline" className="w-full h-12 text-muted-foreground bg-secondary/50" onClick={(e) => { e.stopPropagation(); setShowSpoiler(true); }}>
                閲覧注意: クリックして表示
              </Button>
            </div>
          ) : (
            <>
              {/* Content with Markdown & KaTeX */}
              <MarkdownContent
                content={yudate.content}
                className={isDetail && !isQuoted ? 'text-xl leading-relaxed mt-2 mb-4' : 'text-[15px] leading-snug'}
              />

              {/* Media attachment */}
              {'imageUrl' in yudate && (yudate as any).imageUrl && (
                <div className="mt-3 rounded-xl overflow-hidden border border-border/50 bg-black/5 dark:bg-white/5">
                  {(() => {
                    const url = (yudate as any).imageUrl.toLowerCase();
                    if (url.endsWith('.mp4') || url.endsWith('.webm') || url.endsWith('.mov')) {
                      return (
                        <video
                          src={(yudate as any).imageUrl}
                          controls
                          className="w-full max-h-[500px] object-contain"
                          onClick={(e) => e.stopPropagation()}
                        />
                      );
                    } else if (url.endsWith('.mp3') || url.endsWith('.wav') || url.endsWith('.m4a') || url.endsWith('.ogg')) {
                      return (
                        <div className="p-4 flex justify-center">
                          <audio
                            src={(yudate as any).imageUrl}
                            controls
                            className="w-full"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                      );
                    } else {
                      return (
                        <img
                          src={(yudate as any).imageUrl}
                          alt="添付画像"
                          className="w-full max-h-80 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={(e) => { e.stopPropagation(); window.open((yudate as any).imageUrl!, '_blank'); }}
                        />
                      );
                    }
                  })()}
                </div>
              )}
            </>
          )}


          {/* Nested quoted yudate */}
          {isFullYudate && fullYudate.quotedYudate && !isQuoted && (
            <YudateCard yudate={fullYudate.quotedYudate} isQuoted={true} />
          )}

          {/* Reactions display */}
          {isFullYudate && fullYudate.reactions && fullYudate.reactions.length > 0 && !isQuoted && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {fullYudate.reactions.map((reaction) => (
                <button
                  key={reaction.emoji}
                  onClick={(e) => { e.stopPropagation(); e.currentTarget.blur(); handleReaction(reaction.emoji); }}
                  className={`
                    flex items-center gap-1 px-2.5 py-1 rounded-full text-sm border transition-colors
                    ${reaction.isReacted
                      ? 'bg-primary/15 border-primary/40 text-primary'
                      : 'bg-secondary/30 border-border/50 hover:bg-secondary/60'}
                  `}
                >
                  <span>{reaction.emoji}</span>
                  <span className="font-medium tabular-nums">{reaction.count}</span>
                </button>
              ))}
            </div>
          )}

          {/* Action Bar */}
          {isFullYudate && !isQuoted && (
            <div className={`flex items-center gap-0 text-muted-foreground ${isDetail ? 'border-t border-border/50 pt-3 mt-4 mb-2 justify-around' : 'mt-3 justify-between max-w-[380px] sm:max-w-[480px]'}`}>

              {/* Reply */}
              <button
                onClick={(e) => { e.stopPropagation(); e.currentTarget.blur(); setShowReplyDialog(true); }}
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
                    className={`flex items-center gap-1 group transition-colors min-w-[44px] ${localReyudated ? 'text-primary' : 'hover:text-primary'}`}
                  >
                    <div className="p-2 rounded-full transition-colors group-hover:bg-primary/10">
                      <Repeat2 className="w-[18px] h-[18px]" />
                    </div>
                    <ActionCount value={localReyudateCount} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent onClick={(e) => e.stopPropagation()}>
                  <DropdownMenuItem
                    className="gap-2 cursor-pointer"
                    onClick={(e) => { e.stopPropagation(); (e.currentTarget as any).blur(); handleReyudate(); }}
                  >
                    <Repeat2 className="w-4 h-4" />
                    {localReyudated ? 'リユデートを取り消す' : 'リユデート'}
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
                className={`flex items-center gap-1 group transition-colors min-w-[44px] ${localLiked ? 'text-pink-500' : 'hover:text-pink-500'}`}
              >
                <div className="p-2 rounded-full transition-colors group-hover:bg-pink-500/10">
                  <Heart className={`w-[18px] h-[18px] ${localLiked ? 'fill-current' : ''}`} />
                </div>
                <ActionCount value={localLikeCount} />
              </button>

              {/* Emoji Reaction — 全絵文字ピッカー */}
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-1 group transition-colors hover:text-yellow-500 min-w-[44px]"
                    title="リアクション"
                  >
                    <div className="p-2 rounded-full group-hover:bg-yellow-500/10 transition-colors">
                      <SmilePlus className="w-[18px] h-[18px]" />
                    </div>
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-auto p-0 border-none shadow-xl"
                  onClick={(e) => e.stopPropagation()}
                  align="start"
                  side="top"
                >
                  <EmojiPicker
                    onEmojiClick={(emojiData) => {
                      handleReaction(emojiData.emoji);
                    }}
                    autoFocusSearch={false}
                    skinTonesDisabled
                    previewConfig={{ showPreview: false }}
                    searchPlaceholder="絵文字を検索..."
                    width={320}
                    height={400}
                    categories={[
                      { category: Categories.SUGGESTED, name: 'よく使う' },
                      { category: Categories.SMILEYS_PEOPLE, name: '顔・人' },
                      { category: Categories.ANIMALS_NATURE, name: '動物・自然' },
                      { category: Categories.FOOD_DRINK, name: '食べ物・飲み物' },
                      { category: Categories.TRAVEL_PLACES, name: '旅行・場所' },
                      { category: Categories.ACTIVITIES, name: 'アクティビティ' },
                      { category: Categories.OBJECTS, name: 'もの' },
                      { category: Categories.SYMBOLS, name: '記号' },
                      { category: Categories.FLAGS, name: '旗' },
                    ]}
                  />
                </PopoverContent>
              </Popover>

              {/* Share */}
              <button
                onClick={handleShare}
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

      {/* Edit Yudate Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-[500px]" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>ユデートを編集</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="flex flex-col gap-4 mt-2">
            <textarea
              className="w-full min-h-[120px] p-3 rounded-xl border border-border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 text-[15px]"
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              placeholder="ユデートを編集..."
              maxLength={280}
              required
              disabled={isEditingSubmit}
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowEditDialog(false)}
                disabled={isEditingSubmit}
              >
                キャンセル
              </Button>
              <Button type="submit" disabled={isEditingSubmit}>
                {isEditingSubmit ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                保存
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
            <AlertDialog open={showBlockDialog} onOpenChange={setShowBlockDialog}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>{yudate.author.displayName}さんをブロックしますか？</AlertDialogTitle>
            <AlertDialogDescription>
              ブロックすると、お互いのユデートがタイムラインやプロフィールに表示されなくなります。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowBlockDialog(false)}>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isBlocking}
              onClick={(e) => {
                e.preventDefault();
                handleBlock();
              }}
            >
              {isBlocking ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              ブロックする
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>ユデートを削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              この操作は取り消せません。このユデートはタイムラインおよびサーバーから完全に削除されます。
              {yudate.replyToId === null && (
                <span className="block mt-2 font-bold text-destructive">
                  ※ ユデートを削除すると 5 YD が残高から減算されます。
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowDeleteDialog(false)}>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.stopPropagation();
                performDelete();
              }}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              削除する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
                  <p className="mt-1 text-[15px] whitespace-pre-wrap">{yudate.content}</p>
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
