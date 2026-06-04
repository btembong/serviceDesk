"use client";
import { useEffect, useState } from "react";
import { Loader2, BarChart3, TrendingUp, Clock, CheckCircle2 } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from "recharts";
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

const STATUS_COLORS: Record<string, string> = {
  OPEN: "#6366f1", IN_REVIEW: "#f59e0b", ESCALATED: "#ef4444",
  RESOLVED: "#22c55e", REJECTED: "#6b7280", CLOSED: "#d1d5db",
};

const PRIORITY_COLORS: Record<string, string> = {
  URGENT: "#ef4444", HIGH: "#f97316", NORMAL: "#6366f1", LOW: "#94a3b8",
};

export default function AdminAnalyticsPage() {
  const token = getToken();
  const [analytics, setAnalytics] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiRequest<any>("/admin/analytics", { token: token! }),
      apiRequest<any>("/admin/stats", { token: token! }),
    ])
      .then(([a, s]) => { setAnalytics(a); setStats(s); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <AppShell allowedRoles={["ADMIN"]}>
      <div className="p-8 flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    </AppShell>
  );

  const categoryData = analytics?.byCategory?.map((item: any) => ({
    name: CATEGORY_LABELS[item.category] || item.category,
    count: item._count.id,
  })) || [];

  const statusData = analytics?.byStatus?.map((item: any) => ({
    name: item.status,
    value: item._count.id,
  })) || [];

  const priorityData = analytics?.byPriority?.map((item: any) => ({
    name: item.priority,
    count: item._count.id,
    fill: PRIORITY_COLORS[item.priority] || "#6366f1",
  })) || [];

  const resolutionRate = stats
    ? Math.round(((stats.totalResolved || 0) / Math.max(1, (stats.totalOpen || 0) + (stats.totalResolved || 0) + (stats.totalInReview || 0))) * 100)
    : 0;

  return (
    <AppShell allowedRoles={["ADMIN"]}>
      <div className="p-8 space-y-8">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="bg-indigo-50 p-2.5 rounded-full">
            <BarChart3 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Analytics</h2>
            <p className="text-muted-foreground text-sm mt-0.5">Platform performance overview</p>
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            icon={<TrendingUp className="h-5 w-5 text-indigo-600" />}
            label="Resolution Rate"
            value={`${resolutionRate}%`}
            sub="of all tickets resolved"
            bg="bg-indigo-50"
          />
          <KpiCard
            icon={<CheckCircle2 className="h-5 w-5 text-green-600" />}
            label="Resolved"
            value={stats?.totalResolved ?? "—"}
            sub="tickets closed"
            bg="bg-green-50"
          />
          <KpiCard
            icon={<Clock className="h-5 w-5 text-yellow-600" />}
            label="In Review"
            value={stats?.totalInReview ?? "—"}
            sub="being processed"
            bg="bg-yellow-50"
          />
          <KpiCard
            icon={<BarChart3 className="h-5 w-5 text-purple-600" />}
            label="Today"
            value={stats?.totalToday ?? "—"}
            sub="new tickets today"
            bg="bg-purple-50"
          />
        </div>

        {/* Charts grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* By Category */}
          <Card>
            <CardHeader><CardTitle className="text-base">Volume by Category</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={categoryData} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={130} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* By Status */}
          <Card>
            <CardHeader><CardTitle className="text-base">Distribution by Status</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%" cy="50%"
                    outerRadius={100}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                    labelLine={false}
                  >
                    {statusData.map((entry: any, i: number) => (
                      <Cell key={i} fill={STATUS_COLORS[entry.name] || "#6366f1"} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* By Priority */}
          <Card>
            <CardHeader><CardTitle className="text-base">Volume by Priority</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={priorityData} margin={{ left: 0, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {priorityData.map((entry: any, i: number) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* KYC summary */}
          <Card>
            <CardHeader><CardTitle className="text-base">KYC Summary</CardTitle></CardHeader>
            <CardContent className="space-y-4 pt-2">
              {[
                { label: "Pending Review", value: stats?.kycPending, color: "bg-yellow-400" },
                { label: "Total Open Tickets", value: stats?.totalOpen, color: "bg-indigo-400" },
                { label: "Escalated", value: stats?.totalEscalated, color: "bg-red-400" },
                { label: "Resolved Today", value: stats?.totalToday, color: "bg-green-400" },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
                    <span className="text-sm">{label}</span>
                  </div>
                  <span className="font-semibold text-sm">{value ?? "—"}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

function KpiCard({ icon, label, value, sub, bg }: {
  icon: React.ReactNode; label: string; value: any; sub: string; bg: string;
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-5">
        <div className="flex items-start gap-3">
          <div className={`${bg} rounded-full p-2.5 shrink-0`}>{icon}</div>
          <div>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-xs font-medium">{label}</p>
            <p className="text-xs text-muted-foreground">{sub}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
