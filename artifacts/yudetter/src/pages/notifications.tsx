import { useGetNotifications, useMarkNotificationsRead, useGetFollowRequests, useApproveFollowRequest, useRejectFollowRequest } from "@workspace/api-client-react";
import { Loader2, Heart, Repeat2, User, MessageCircle, Quote, Bell, ShoppingBag, Coins } from "lucide-react";
import { useEffect } from "react";
import { Link } from "wouter";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export default function NotificationsPage() {
  const { data, isLoading } = useGetNotifications();
  const markReadMutation = useMarkNotificationsRead();
  const queryClient = useQueryClient();

  const { data: followRequests, refetch: refetchRequests } = useGetFollowRequests();
  const approveMutation = useApproveFollowRequest();
  const rejectMutation = useRejectFollowRequest();

  const handleApprove = (username: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    approveMutation.mutate({ username }, {
      onSuccess: () => refetchRequests()
    });
  };

  const handleReject = (username: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    rejectMutation.mutate({ username }, {
      onSuccess: () => refetchRequests()
    });
  };


  useEffect(() => {
    // Mark as read when opening page, then reset the badge count
    markReadMutation.mutate(undefined, {
      onSuccess: () => {
        queryClient.setQueryData(["notifications", "unread-count"], 0);
      },
    });
  }, []);


  const getCleanType = (type: string) => {
    if (type.startsWith("market_sell:")) return "market_sell";
    if (type.startsWith("super_yudate:")) return "super_yudate";
    return type;
  };

  const getIcon = (type: string) => {
    const cleanType = getCleanType(type);
    switch(cleanType) {
      case 'like': return <Heart className="w-7 h-7 text-pink-500 fill-pink-500" />;
      case 'reyudate': return <Repeat2 className="w-7 h-7 text-primary" />;
      case 'follow': return <User className="w-7 h-7 text-blue-500 fill-blue-500" />;
      case 'reply': return <MessageCircle className="w-7 h-7 text-blue-500 fill-blue-500" />;
      case 'quote': return <Quote className="w-7 h-7 text-primary" />;
      case 'market_sell': return <ShoppingBag className="w-7 h-7 text-emerald-500 fill-emerald-500" />;
      case 'super_yudate': return <Coins className="w-7 h-7 text-amber-500 fill-amber-500" />;
      default: return <Bell className="w-7 h-7 text-primary" />;
    }
  };

  const getMessage = (notification: any) => {
    const actorName = notification.actor.displayName;
    const cleanType = getCleanType(notification.type);
    switch(cleanType) {
      case 'like': return <><span className="font-bold">{actorName}</span>さんがあなたのユデートをいいねしました</>;
      case 'reyudate': return <><span className="font-bold">{actorName}</span>さんがリユデートしました</>;
      case 'follow': return <><span className="font-bold">{actorName}</span>さんにフォローされました</>;
      case 'reply': return <><span className="font-bold">{actorName}</span>さんが返信しました</>;
      case 'quote': return <><span className="font-bold">{actorName}</span>さんが引用リユデートしました</>;
      case 'market_sell': {
        const itemTitle = notification.type.split(":")[1] || "商品";
        return <><span className="font-bold">{actorName}</span>さんがあなたの商品「{itemTitle}」を購入しました</>;
      }
      case 'super_yudate': {
        const amount = notification.type.split(":")[1] || "0";
        return (
          <>
            <span className="font-bold">{actorName}</span>さんから
            <span className="font-black text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded mx-1">{Number(amount).toLocaleString()} YD</span>
            のスーパーユデートを受け取りました！
          </>
        );
      }
      default: return "";
    }
  };

  return (
    <div className="w-full">
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b border-border/50">
        <div className="flex items-center px-4 h-[53px]">
          <h1 className="font-rounded font-bold text-xl">通知</h1>
        </div>
      </div>

      
      <div className="flex flex-col">
        {followRequests && followRequests.length > 0 && (
          <div className="border-b border-border/50 bg-secondary/10">
            <div className="px-4 py-2 text-sm font-bold text-muted-foreground border-b border-border/50">フォローリクエスト</div>
            {followRequests.map((reqUser: any) => (
              <div key={reqUser.id} className="flex items-center justify-between p-4 border-b border-border/50">
                <Link href={`/profile/${reqUser.username}`} className="flex items-center gap-3">
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={reqUser.avatarUrl || ''} />
                    <AvatarFallback className="bg-primary/20 text-primary">{reqUser.displayName[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <span className="font-bold">{reqUser.displayName}</span>
                    <span className="text-muted-foreground text-sm">@{reqUser.username}</span>
                  </div>
                </Link>
                <div className="flex gap-2">
                  <Button size="icon" variant="default" onClick={(e) => handleApprove(reqUser.username, e)}>
                    <Check className="w-4 h-4" />
                  </Button>
                  <Button size="icon" variant="outline" onClick={(e) => handleReject(reqUser.username, e)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center p-8 text-primary">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        ) : !data?.items.length ? (
          <div className="p-8 text-center text-muted-foreground">
            <p className="font-rounded font-bold text-xl mb-2 text-foreground">まだ通知はありません</p>
          </div>
        ) : (
          data.items.map((notification) => {
            const cleanType = getCleanType(notification.type);
            const isUnread = !notification.read;
            
            let itemBgClass = "hover:bg-secondary/15 transition-colors border-b border-border/50";
            if (cleanType === "super_yudate") {
              const amount = Number(notification.type.split(":")[1]) || 0;
              itemBgClass += amount >= 5000 
                ? " bg-amber-500/5 dark:bg-amber-500/10 border-l-4 border-l-amber-500/80 border-b border-amber-500/10"
                : amount >= 1000 
                ? " bg-pink-500/5 dark:bg-pink-500/10 border-l-4 border-l-pink-500/70 border-b border-pink-500/10"
                : " bg-amber-500/[0.02] dark:bg-amber-500/5 border-l-4 border-l-amber-500/40";
            } else if (cleanType === "market_sell") {
              itemBgClass += " bg-emerald-500/5 dark:bg-emerald-500/10 border-l-4 border-l-emerald-500/70 border-b border-emerald-500/10";
            } else if (isUnread) {
              itemBgClass += " bg-primary/[0.03]";
            }

            const href = cleanType === 'follow'
              ? `/profile/${notification.actor.username}`
              : cleanType === 'market_sell'
              ? `/wallet`
              : `/yudate/${notification.yudate?.id}`;

            return (
              <Link 
                key={notification.id} 
                href={href}
                className={`flex gap-3 p-4 ${itemBgClass}`}
              >
                <div className="w-8 shrink-0 flex justify-end pt-1">
                  {getIcon(notification.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <Avatar className="w-8 h-8 mb-2">
                    <AvatarImage src={notification.actor.avatarUrl || ''} />
                    <AvatarFallback className="bg-primary/20 text-primary text-xs">{notification.actor.displayName[0]}</AvatarFallback>
                  </Avatar>
                  <div className="text-[14px] leading-relaxed mb-1.5">{getMessage(notification)}</div>
                  {notification.yudate && (
                    <div className="text-[13px] text-muted-foreground line-clamp-2 bg-secondary/10 p-2 rounded-lg border border-border/30 mt-1">
                      {notification.yudate.content}
                    </div>
                  )}
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}