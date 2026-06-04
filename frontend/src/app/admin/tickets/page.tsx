"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Loader2, TicketCheck, Filter, Search, User, Clock, AlertTriangle, UserCheck,
} from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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

export default function AdminTicketsPage() {
  const router = useRouter();
  const token = getToken();
  const [tickets, setTickets] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [search, setSearch] = useState("");
  const [assigning, setAssigning] = useState<string | null>(null);

  const fetchTickets = () => {
    setLoading(true);
    const params = new URLSearchParams({ limit: "100" });
    if (statusFilter && statusFilter !== "all") params.set("status", statusFilter);
    if (priorityFilter && priorityFilter !== "all") params.set("priority", priorityFilter);

    apiRequest<{ tickets: any[]; total: number }>(`/tickets/admin?${params}`, { token: token! })
      .then(({ tickets, total }) => { setTickets(tickets); setTotal(total); })
      .catch(() => toast.error("Failed to load tickets"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchTickets();
    // Load agents list once
    apiRequest<{ users: any[] }>("/admin/users?role=AGENT&limit=100", { token: token! })
      .then(({ users }) => setAgents(users))
      .catch(() => {});
  }, [statusFilter, priorityFilter]);

  const isSlaBreached = (deadline: string) => deadline && new Date(deadline) < new Date();

  const assignAgent = async (ticketId: string, agentId: string) => {
    setAssigning(ticketId);
    try {
      await apiRequest(`/tickets/${ticketId}`, {
        method: "PATCH",
        body: { agentId },
        token: token!,
      });
      setTickets((ts) =>
        ts.map((t) => {
          if (t.id !== ticketId) return t;
          const agent = agents.find((a) => a.id === agentId);
          return { ...t, agentId, agent };
        })
      );
      toast.success("Ticket assigned.");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setAssigning(null);
    }
  };

  const filtered = tickets.filter((t) =>
    !search ||
    t.ticketNumber?.toLowerCase().includes(search.toLowerCase()) ||
    t.subject?.toLowerCase().includes(search.toLowerCase()) ||
    `${t.customer?.firstName} ${t.customer?.lastName}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppShell allowedRoles={["ADMIN"]}>
      <div className="p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-50 p-2.5 rounded-full">
              <TicketCheck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">All Tickets</h2>
              <p className="text-muted-foreground text-sm mt-0.5">{total} ticket{total !== 1 ? "s" : ""} total</p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search ticket / customer"
                className="pl-9 w-64"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="OPEN">Open</SelectItem>
                <SelectItem value="IN_REVIEW">In Review</SelectItem>
                <SelectItem value="ESCALATED">Escalated</SelectItem>
                <SelectItem value="RESOLVED">Resolved</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="All priorities" />
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

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center h-48">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground">
                No tickets found for the current filters.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium text-muted-foreground">Ticket</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Customer</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Category</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Priority</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">SLA</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Assign Agent</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map((ticket) => (
                    <tr key={ticket.id} className="hover:bg-muted/30 transition-colors">
                      <td
                        className="p-3 cursor-pointer"
                        onClick={() => router.push(`/agent/tickets/${ticket.id}`)}
                      >
                        <div className="flex items-center gap-1.5">
                          {ticket.priority === "URGENT" && <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />}
                          <span className="font-mono font-medium text-xs">{ticket.ticketNumber}</span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate max-w-[180px]">{ticket.subject}</p>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-xs">{ticket.customer?.firstName} {ticket.customer?.lastName}</span>
                        </div>
                      </td>
                      <td className="p-3 text-muted-foreground text-xs">{CATEGORY_LABELS[ticket.category] || ticket.category}</td>
                      <td className="p-3"><PriorityBadge priority={ticket.priority} /></td>
                      <td className="p-3"><StatusBadge status={ticket.status} /></td>
                      <td className="p-3">
                        {ticket.slaDeadline ? (
                          <span className={`flex items-center gap-1 text-xs ${isSlaBreached(ticket.slaDeadline) ? "text-red-600 font-semibold" : "text-muted-foreground"}`}>
                            <Clock className="h-3 w-3" />
                            {isSlaBreached(ticket.slaDeadline) ? "Breached" : new Date(ticket.slaDeadline).toLocaleDateString("en-GB", { dateStyle: "short" })}
                          </span>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </td>
                      <td className="p-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-2 min-w-[180px]">
                          <Select
                            value={ticket.agentId ?? "unassigned"}
                            onValueChange={(val) => val !== "unassigned" && assignAgent(ticket.id, val)}
                          >
                            <SelectTrigger className="h-7 text-xs w-36">
                              <SelectValue placeholder="Assign…" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="unassigned">
                                <span className="italic text-muted-foreground">Unassigned</span>
                              </SelectItem>
                              {agents.map((agent) => (
                                <SelectItem key={agent.id} value={agent.id}>
                                  {agent.firstName} {agent.lastName}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {assigning === ticket.id && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />}
                          {ticket.agentId && assigning !== ticket.id && (
                            <UserCheck className="h-3.5 w-3.5 text-green-600 shrink-0" />
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">
                        {new Date(ticket.createdAt).toLocaleDateString("en-GB", { dateStyle: "medium" })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
