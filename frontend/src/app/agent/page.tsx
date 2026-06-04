"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Clock, AlertTriangle, User, Filter } from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge, PriorityBadge } from "@/components/shared/StatusBadge";
import { apiRequest } from "@/lib/api";
import { getToken } from "@/lib/auth";

const CATEGORY_LABELS: Record<string, string> = {
  ACCOUNT_VERIFICATION: "Account Verification",
  PIN_RESET: "PIN Reset",
  TRANSACTION_ISSUE: "Transaction Issue",
  CARD_SERVICES: "Card Services",
  LOAN_CREDIT: "Loan & Credit",
  DIGITAL_BANKING: "Digital Banking",
  INFO_UPDATE: "Info Update",
  COMPLAINT_FEEDBACK: "Complaint / Feedback",
};

export default function AgentDashboardPage() {
  const router = useRouter();
  const token = getToken();
  const [tickets, setTickets] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("OPEN");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [claiming, setClaimingId] = useState<string | null>(null);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "30" });
      if (statusFilter && statusFilter !== "all") params.set("status", statusFilter);
      if (priorityFilter && priorityFilter !== "all") params.set("priority", priorityFilter);

      const res = await apiRequest<{ tickets: any[]; total: number }>(
        `/tickets/admin?${params}`,
        { token: token! }
      );
      setTickets(res.tickets);
      setTotal(res.total);
    } catch {
      toast.error("Failed to load tickets");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTickets(); }, [statusFilter, priorityFilter]);

  // Poll every 30 seconds for new tickets and show a toast if count increases
  useEffect(() => {
    let lastTotal = total;
    const interval = setInterval(async () => {
      try {
        const params = new URLSearchParams({ limit: "30" });
        if (statusFilter && statusFilter !== "all") params.set("status", statusFilter);
        if (priorityFilter && priorityFilter !== "all") params.set("priority", priorityFilter);
        const res = await apiRequest<{ tickets: any[]; total: number }>(`/tickets/admin?${params}`, { token: token! });
        if (res.total > lastTotal) {
          toast.info(`${res.total - lastTotal} new ticket${res.total - lastTotal > 1 ? "s" : ""} in the queue.`);
          setTickets(res.tickets);
          setTotal(res.total);
        }
        lastTotal = res.total;
      } catch {}
    }, 30000);
    return () => clearInterval(interval);
  }, [statusFilter, priorityFilter, total]);

  const claimTicket = async (id: string) => {
    setClaimingId(id);
    try {
      await apiRequest(`/tickets/${id}/claim`, { method: "POST", token: token! });
      toast.success("Ticket claimed. Opening...");
      router.push(`/agent/tickets/${id}`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setClaimingId(null);
    }
  };

  const isSlaBreached = (deadline: string) => deadline && new Date(deadline) < new Date();
  const slaRemaining = (deadline: string) => {
    if (!deadline) return null;
    const diff = new Date(deadline).getTime() - Date.now();
    if (diff < 0) return "Overdue";
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  return (
    <AppShell allowedRoles={["AGENT", "ADMIN"]}>
      <div className="p-8 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-2xl font-bold">Ticket Queue</h2>
            <p className="text-muted-foreground text-sm">{total} ticket{total !== 1 ? "s" : ""} matching filters</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="OPEN">Open</SelectItem>
                <SelectItem value="IN_REVIEW">In Review</SelectItem>
                <SelectItem value="ESCALATED">Escalated</SelectItem>
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All priorities</SelectItem>
                <SelectItem value="URGENT">Urgent</SelectItem>
                <SelectItem value="HIGH">High</SelectItem>
                <SelectItem value="NORMAL">Normal</SelectItem>
                <SelectItem value="LOW">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : tickets.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">
              No tickets found for the current filters.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {tickets.map((ticket) => (
              <Card key={ticket.id} className={`transition-shadow hover:shadow-md ${isSlaBreached(ticket.slaDeadline) ? "border-red-300" : ""}`}>
                <CardContent className="py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        {ticket.priority === "URGENT" && <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />}
                        <span className="font-semibold text-sm">{ticket.ticketNumber}</span>
                        <PriorityBadge priority={ticket.priority} />
                        <StatusBadge status={ticket.status} />
                      </div>
                      <p className="text-sm font-medium">{ticket.subject}</p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                        <span>{CATEGORY_LABELS[ticket.category]}</span>
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {ticket.customer?.firstName} {ticket.customer?.lastName}
                        </span>
                        {ticket.slaDeadline && (
                          <span className={`flex items-center gap-1 ${isSlaBreached(ticket.slaDeadline) ? "text-red-600 font-semibold" : ""}`}>
                            <Clock className="h-3 w-3" />
                            {isSlaBreached(ticket.slaDeadline) ? "SLA Breached" : `SLA: ${slaRemaining(ticket.slaDeadline)}`}
                          </span>
                        )}
                        <span>{new Date(ticket.createdAt).toLocaleDateString("en-GB", { dateStyle: "medium" })}</span>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {!ticket.agentId ? (
                        <Button size="sm" onClick={() => claimTicket(ticket.id)} disabled={claiming === ticket.id}>
                          {claiming === ticket.id && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                          Claim
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => router.push(`/agent/tickets/${ticket.id}`)}>
                          Open
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
