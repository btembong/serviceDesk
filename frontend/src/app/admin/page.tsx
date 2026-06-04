"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Inbox, ScanSearch, FileCheck2, AlertTriangle,
  ScanFace, CalendarClock, Users, Loader2,
} from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  COMPLAINT_FEEDBACK: "Complaint",
};


export default function AdminDashboardPage() {
  const token = getToken();
  const [stats, setStats] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiRequest<any>("/admin/stats", { token: token! }),
      apiRequest<any>("/admin/analytics", { token: token! }),
    ]).then(([s, a]) => {
      setStats(s);
      setAnalytics(a);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <AppShell allowedRoles={["ADMIN"]}>
      <div className="p-8 flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    </AppShell>
  );

  const categoryData: { name: string; count: number }[] =
    analytics?.byCategory?.map((item: any) => ({
      name: CATEGORY_LABELS[item.category] || item.category,
      count: item._count.id,
    })) || [];

  const categoryMax = Math.max(1, ...categoryData.map((d) => d.count));

  return (
    <AppShell allowedRoles={["ADMIN"]}>
      <div className="p-8 space-y-8">
        <div>
          <h2 className="text-2xl font-bold">Admin Overview</h2>
          <p className="text-muted-foreground text-sm mt-1">Platform health at a glance</p>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <StatCard icon={<Inbox className="h-5 w-5 text-primary" />} label="Open" value={stats?.totalOpen} />
          <StatCard icon={<ScanSearch className="h-5 w-5 text-primary" />} label="In Review" value={stats?.totalInReview} />
          <StatCard icon={<FileCheck2 className="h-5 w-5 text-primary" />} label="Resolved" value={stats?.totalResolved} />
          <StatCard icon={<AlertTriangle className="h-5 w-5 text-primary" />} label="Urgent" value={stats?.totalUrgent} />
          <StatCard icon={<CalendarClock className="h-5 w-5 text-primary" />} label="Today" value={stats?.totalToday} />
          <StatCard icon={<ScanFace className="h-5 w-5 text-primary" />} label="KYC Pending" value={stats?.kycPending} />
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { href: "/admin/tickets", label: "All Tickets", icon: Inbox },
            { href: "/admin/users", label: "Users", icon: Users },
            { href: "/admin/kyc-queue", label: "KYC Queue", icon: ScanFace },
            { href: "/admin/audit-logs", label: "Audit Logs", icon: FileCheck2 },
          ].map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="pt-5 pb-5 flex items-center gap-3">
                  <Icon className="h-5 w-5 text-primary" />
                  <span className="font-medium text-sm">{label}</span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* Category breakdown */}
        <Card>
          <CardHeader><CardTitle className="text-base">Tickets by Category</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {categoryData.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data yet.</p>
            ) : (
              categoryData
                .sort((a, b) => b.count - a.count)
                .map(({ name, count }) => (
                  <div key={name} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{name}</span>
                      <span className="font-semibold tabular-nums">{count}</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-indigo-50 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${Math.round((count / categoryMax) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value?: number }) {
  return (
    <Card>
      <CardContent className="pt-5 pb-5">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-50 rounded-full p-2.5 shrink-0">{icon}</div>
          <div>
            <p className="text-xl font-bold">{value ?? "—"}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
