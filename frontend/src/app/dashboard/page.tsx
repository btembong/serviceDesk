"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { CirclePlus, Inbox, ScanSearch, FileCheck2, ClipboardList } from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

export default function DashboardPage() {
  const user = getUser();
  const token = getToken();
  const [tickets, setTickets] = useState<any[]>([]);
  const [stats, setStats] = useState({ open: 0, inReview: 0, resolved: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !token) return;
    apiRequest<{ tickets: any[]; total: number }>(`/tickets/user/${user.id}`, { token })
      .then(({ tickets }) => {
        setTickets(tickets);
        setStats({
          open: tickets.filter((t) => t.status === "OPEN").length,
          inReview: tickets.filter((t) => t.status === "IN_REVIEW" || t.status === "ESCALATED").length,
          resolved: tickets.filter((t) => t.status === "RESOLVED").length,
        });
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppShell allowedRoles={["CUSTOMER"]}>
      <div className="p-8 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">
              Welcome back, {user?.firstName}
            </h2>
            <p className="text-muted-foreground text-sm mt-1">Here&apos;s an overview of your support tickets</p>
          </div>
          <Link href="/tickets/new">
            <Button>
              <CirclePlus className="mr-2 h-4 w-4" /> New Ticket
            </Button>
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard icon={<Inbox className="h-5 w-5 text-primary" />} label="Open" value={stats.open} />
          <StatCard icon={<ScanSearch className="h-5 w-5 text-primary" />} label="In Review" value={stats.inReview} />
          <StatCard icon={<FileCheck2 className="h-5 w-5 text-primary" />} label="Resolved" value={stats.resolved} />
        </div>

        {/* Ticket list */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>My Tickets</CardTitle>
            <Link href="/tickets" className="text-sm text-primary hover:underline">View all</Link>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-12 text-center text-muted-foreground text-sm">Loading tickets...</div>
            ) : tickets.length === 0 ? (
              <div className="py-12 text-center space-y-3">
                <ClipboardList className="h-10 w-10 text-muted-foreground mx-auto" />
                <p className="text-muted-foreground">No tickets yet</p>
                <Link href="/tickets/new">
                  <Button size="sm">Submit your first ticket</Button>
                </Link>
              </div>
            ) : (
              <div className="divide-y">
                {tickets.slice(0, 8).map((ticket) => (
                  <Link key={ticket.id} href={`/tickets/${ticket.id}`}>
                    <div className="flex items-center justify-between py-3 hover:bg-muted/50 px-2 rounded transition-colors">
                      <div className="space-y-0.5">
                        <p className="text-sm font-medium">{ticket.ticketNumber}</p>
                        <p className="text-sm text-muted-foreground">{ticket.subject}</p>
                        <p className="text-xs text-muted-foreground">{CATEGORY_LABELS[ticket.category]}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-4">
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

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-4">
          <div className="bg-indigo-50 rounded-full p-3">{icon}</div>
          <div>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-sm text-muted-foreground">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
