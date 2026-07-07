import { useGetNotifications, useMarkNotificationsRead } from "@workspace/api-client-react";
import { Loader2, Heart, Repeat2, User, MessageCircle, Quote, Bell } from "lucide-react";
import { useEffect } from "react";
import { Link } from "wouter";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function NotificationsPage() {
  const { data, isLoading } = useGetNotifications();
  const markReadMutation = useMarkNotificationsRead();

  useEffect(() => {
    // Mark as read when opening page
    markReadMutation.mutate();
  }, []);

  const getIcon = (type: string) => {
    switch(type) {
      case 'like': return <Heart className="w-7 h-7 text-pink-500 fill-pink-500" />;
      case 'reyudate': return <Repeat2 className="w-7 h-7 text-primary" />;
      case 'follow': return <User className="w-7 h-7 text-blue-500 fill-blue-500" />;
      case 'reply': return <MessageCircle className="w-7 h-7 text-blue-500 fill-blue-500" />;
      case 'quote': return <Quote className="w-7 h-7 text-primary" />;
      default: return <Bell className="w-7 h-7 text-primary" />;
    }
  };

  const getMessage = (notification: any) => {
    const actorName = notification.actor.displayName;
    switch(notification.type) {
      case 'like': return <><span className="font-bold">{actorName}</span>さんがあなたのユデートをいいねしました</>;
      case 'reyudate': return <><span className="font-bold">{actorName}</span>さんがリユデートしました</>;
      case 'follow': return <><span className="font-bold">{actorName}</span>さんにフォローされました</>;
      case 'reply': return <><span className="font-bold">{actorName}</span>さんが返信しました</>;
      case 'quote': return <><span className="font-bold">{actorName}</span>さんが引用リユデートしました</>;
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
        {isLoading ? (
          <div className="flex justify-center p-8 text-primary">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        ) : !data?.items.length ? (
          <div className="p-8 text-center text-muted-foreground">
            <p className="font-rounded font-bold text-xl mb-2 text-foreground">まだ通知はありません</p>
          </div>
        ) : (
          data.items.map((notification) => (
            <Link 
              key={notification.id} 
              href={notification.type === 'follow' ? `/profile/${notification.actor.username}` : `/yudate/${notification.yudate?.id}`}
              className={`flex gap-3 p-4 border-b border-border/50 hover:bg-secondary/20 transition-colors ${!notification.read ? 'bg-primary/5' : ''}`}
            >
              <div className="w-8 shrink-0 flex justify-end pt-1">
                {getIcon(notification.type)}
              </div>
              <div className="flex-1">
                <Avatar className="w-8 h-8 mb-2">
                  <AvatarImage src={notification.actor.avatarUrl || ''} />
                  <AvatarFallback className="bg-primary/20 text-primary text-xs">{notification.actor.displayName[0]}</AvatarFallback>
                </Avatar>
                <div className="text-[15px] mb-2">{getMessage(notification)}</div>
                {notification.yudate && (
                  <div className="text-[15px] text-muted-foreground line-clamp-3">
                    {notification.yudate.content}
                  </div>
                )}
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}