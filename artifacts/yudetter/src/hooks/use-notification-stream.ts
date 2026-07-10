import { useEffect } from "react";
import { useSession } from "@/lib/auth-client";
import { useToast } from "./use-toast";
import { useQueryClient } from "@tanstack/react-query";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export function useNotificationStream() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!session) return;

    // SSEエンドポイントに接続
    const eventSource = new EventSource(`${BASE}/api/notifications/stream`, {
      withCredentials: true,
    });

    eventSource.onmessage = (event) => {
      // 最初のハートビートや空のメッセージは無視
      if (!event.data || event.data === ":") return;

      try {
        const data = JSON.parse(event.data);
        
        // トースト通知を表示
        toast({
          title: "新しい通知",
          description: `${data.actorName}${data.actionMessage}`,
        });

        // 未読バッジなどを即座に更新させるためにReact Queryのキャッシュを無効化
        queryClient.invalidateQueries({ queryKey: ["notifications", "unread-count"] });
        queryClient.invalidateQueries({ queryKey: ["notifications", "list"] });
      } catch (err) {
        console.error("Failed to parse SSE message", err);
      }
    };

    eventSource.onerror = () => {
      // エラー時は自動再接続が行われるが、必要に応じてログ出力
      console.log("SSE Connection lost, attempting to reconnect...");
    };

    return () => {
      eventSource.close();
    };
  }, [session, toast, queryClient]);
}
