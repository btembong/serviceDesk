"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  BellRing, Loader2, CheckCheck, TicketCheck,
  ShieldCheck, ShieldX, KeyRound, Info,
} from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api";
import { getToken, getUser } from "@/lib/auth";
import { cn } from "@/lib/utils";

const TYPE_CONFIG: Record<string, { icon: any; color: string; bg: string }> = {
  TICKET_CREATED:  { icon: TicketCheck,  color: "text-indigo-600",  bg: "bg-indigo-50" },
  TICKET_UPDATED:  { icon: TicketCheck,  color: "text-indigo-600",  bg: "bg-indigo-50" },
  TICKET_RESOLVED: { icon: TicketCheck,  color: "text-green-600",   bg: "bg-green-50" },
  TICKET_REJECTED: { icon: TicketCheck,  color: "text-red-600",     bg: "bg-red-50" },
  KYC_VERIFIED:    { icon: ShieldCheck,  color: "text-green-600",   bg: "bg-green-50" },
  KYC_FAILED:      { icon: ShieldX,      color: "text-red-600",     bg: "bg-red-50" },
  OTP_SENT:        { icon: KeyRound,     color: "text-yellow-600",  bg: "bg-yellow-50" },
  SLA_BREACH:      { icon: BellRing,     color: "text-red-600",     bg: "bg-red-50" },
};

export default function NotificationsPage() {
  const user = getUser();
  const token = getToken();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  useEffect(() => {
    if (!user || !token) return;
    apiRequest<{ notifications: any[]; unreadCount: number }>(
      `/notifications/${user.id}`,
      { token }
    )
      .then(({ notifications, unreadCount }) => {
        setNotifications(notifications);
        setUnreadCount(unreadCount);
      })
      .catch(() => toast.error("Failed to load notifications"))
      .finally(() => setLoading(false));
  }, []);

  const markRead = async (id: string) => {
    try {
      await apiRequest(`/notifications/${id}/read`, { method: "PATCH", token: token! });
      setNotifications((n) =>
        n.map((notif) => notif.id === id ? { ...notif, read: true } : notif)
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      // silent
    }
  };

  const markAllRead = async () => {
    setMarkingAll(true);
    try {
      await apiRequest(`/notifications/read-all/${user?.id}`, { method: "PATCH", token: token! });
      setNotifications((n) => n.map((notif) => ({ ...notif, read: true })));
      setUnreadCount(0);
      toast.success("All notifications marked as read");
    } catch {
      toast.error("Failed to mark all as read");
    } finally {
      setMarkingAll(false);
    }
  };

  return (
    <AppShell>
      <div className="p-8 space-y-6 max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-50 p-2.5 rounded-full">
              <BellRing className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Notifications</h2>
              <p className="text-muted-foreground text-sm mt-0.5">
                {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
              </p>
            </div>
          </div>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={markAllRead} disabled={markingAll}>
              {markingAll
                ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                : <CheckCheck className="mr-2 h-3.5 w-3.5" />
              }
              Mark all read
            </Button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : notifications.length === 0 ? (
          <Card>
            <CardContent className="py-20 text-center space-y-3">
              <BellRing className="h-12 w-12 text-muted-foreground mx-auto" />
              <p className="font-medium text-muted-foreground">No notifications yet</p>
              <p className="text-sm text-muted-foreground">
                You will be notified here when your tickets are updated.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {notifications.map((notif) => {
              const cfg = TYPE_CONFIG[notif.type] || { icon: Info, color: "text-indigo-600", bg: "bg-indigo-50" };
              const Icon = cfg.icon;

              return (
                <button
                  key={notif.id}
                  onClick={() => !notif.read && markRead(notif.id)}
                  className={cn(
                    "w-full text-left flex items-start gap-4 px-4 py-4 rounded-lg border transition-colors",
                    notif.read
                      ? "bg-white border-border hover:bg-muted/30"
                      : "bg-indigo-50/60 border-indigo-100 hover:bg-indigo-50"
                  )}
                >
                  <div className={cn("p-2 rounded-full shrink-0 mt-0.5", cfg.bg)}>
                    <Icon className={cn("h-4 w-4", cfg.color)} />
                  </div>
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className={cn("text-sm font-semibold", !notif.read && "text-indigo-900")}>
                        {notif.title}
                      </p>
                      {!notif.read && (
                        <span className="h-2 w-2 rounded-full bg-indigo-500 shrink-0" />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground leading-snug">{notif.body}</p>
                    <p className="text-xs text-muted-foreground pt-0.5">
                      {new Date(notif.createdAt).toLocaleString("en-GB", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
