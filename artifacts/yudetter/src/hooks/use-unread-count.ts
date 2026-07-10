import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/lib/auth-client";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export function useUnreadNotificationCount() {
  const { data: session } = useSession();
  
  return useQuery<number>({
    queryKey: ["notifications", "unread-count"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/notifications/unread-count`, {
        credentials: "include",
      });
      if (!res.ok) return 0;
      const data = await res.json();
      return data.count ?? 0;
    },
    enabled: !!session,
    refetchInterval: 30_000, // 30秒ごとにポーリング
    staleTime: 10_000,
  });
}
