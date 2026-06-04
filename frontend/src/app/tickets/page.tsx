"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { CirclePlus, ClipboardList, Search, Loader2 } from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge, PriorityBadge } from "@/components/shared/StatusBadge";
import { apiRequest } from "@/lib/api";
import { getToken, getUser } from "@/lib/auth";

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

export default function TicketsPage() {
  const user = getUser();
  const token = getToken();
  const [tickets, setTickets] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  useEffect(() => {
    if (!user || !token) return;
    setLoading(true);
    const params = new URLSearchParams({ limit: "50" });
    if (statusFilter && statusFilter !== "all") params.set("status", statusFilter);
    if (categoryFilter && categoryFilter !== "all") params.set("category", categoryFilter);

    apiRequest<{ tickets: any[]; total: number }>(
      `/tickets/user/${user.id}?${params}`,
      { token }
    )
      .then(({ tickets, total }) => { setTickets(tickets); setTotal(total); })
      .finally(() => setLoading(false));
  }, [statusFilter, categoryFilter]);

  const filtered = tickets.filter((t) =>
    !search ||
    t.ticketNumber.toLowerCase().includes(search.toLowerCase()) ||
    t.subject.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppShell allowedRoles={["CUSTOMER"]}>
      <div className="p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-2xl font-bold">My Tickets</h2>
            <p className="text-muted-foreground text-sm mt-1">{total} ticket{total !== 1 ? "s" : ""} total</p>
          </div>
          <Link href="/tickets/new">
            <Button>
              <CirclePlus className="mr-2 h-4 w-4" /> New Ticket
            </Button>
          </Link>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by number or subject"
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
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
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* List */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center h-48">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-16 text-center space-y-3">
                <ClipboardList className="h-10 w-10 text-muted-foreground mx-auto" />
                <p className="text-muted-foreground font-medium">No tickets found</p>
                <Link href="/tickets/new">
                  <Button size="sm" variant="outline">Submit a ticket</Button>
                </Link>
              </div>
            ) : (
              <div className="divide-y">
                {filtered.map((ticket) => (
                  <Link key={ticket.id} href={`/tickets/${ticket.id}`}>
                    <div className="flex items-center justify-between px-5 py-4 hover:bg-muted/40 transition-colors">
                      <div className="space-y-1 min-w-0 flex-1 pr-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-muted-foreground shrink-0">{ticket.ticketNumber}</span>
                          <span className="text-xs text-muted-foreground">·</span>
                          <span className="text-xs text-muted-foreground truncate">{CATEGORY_LABELS[ticket.category]}</span>
                        </div>
                        <p className="text-sm font-medium truncate">{ticket.subject}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(ticket.createdAt).toLocaleDateString("en-GB", { dateStyle: "medium" })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <PriorityBadge priority={ticket.priority} />
                        <StatusBadge status={ticket.status} />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
