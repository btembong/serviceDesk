"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, ScrollText, Search, ChevronLeft, ChevronRight } from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { cn } from "@/lib/utils";

const METHOD_COLORS: Record<string, string> = {
  POST:   "bg-green-100 text-green-800",
  PATCH:  "bg-yellow-100 text-yellow-800",
  PUT:    "bg-blue-100 text-blue-800",
  DELETE: "bg-red-100 text-red-800",
};

function parseAction(action: string): { method: string; path: string } {
  const parts = action?.split(" ") ?? [];
  return { method: parts[0] ?? "", path: parts.slice(1).join(" ") };
}

export default function AdminAuditLogsPage() {
  const token = getToken();
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [methodFilter, setMethodFilter] = useState("");
  const limit = 50;

  const fetchLogs = () => {
    setLoading(true);
    const params = new URLSearchParams({ limit: String(limit), page: String(page) });

    apiRequest<{ logs: any[]; total: number }>(`/admin/audit-logs?${params}`, { token: token! })
      .then(({ logs, total }) => { setLogs(logs); setTotal(total); })
      .catch(() => toast.error("Failed to load audit logs"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchLogs(); }, [page]);

  const filtered = logs.filter((l) => {
    const { method } = parseAction(l.action);
    const matchesMethod = !methodFilter || methodFilter === "all" || method === methodFilter;
    const matchesSearch = !search ||
      l.action?.toLowerCase().includes(search.toLowerCase()) ||
      l.entityType?.toLowerCase().includes(search.toLowerCase()) ||
      l.user?.email?.toLowerCase().includes(search.toLowerCase()) ||
      l.ipAddress?.includes(search);
    return matchesMethod && matchesSearch;
  });

  const totalPages = Math.ceil(total / limit);

  return (
    <AppShell allowedRoles={["ADMIN"]}>
      <div className="p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-50 p-2.5 rounded-full">
              <ScrollText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Audit Logs</h2>
              <p className="text-muted-foreground text-sm mt-0.5">{total} log entries</p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search action, user, IP…"
                className="pl-9 w-64"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={methodFilter} onValueChange={setMethodFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="All methods" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All methods</SelectItem>
                <SelectItem value="POST">POST</SelectItem>
                <SelectItem value="PATCH">PATCH</SelectItem>
                <SelectItem value="PUT">PUT</SelectItem>
                <SelectItem value="DELETE">DELETE</SelectItem>
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
              <div className="py-16 text-center text-muted-foreground">No audit logs found.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium text-muted-foreground">Timestamp</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">User</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Method</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Action / Path</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Entity</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map((log) => {
                    const { method, path } = parseAction(log.action);
                    return (
                      <tr key={log.id} className="hover:bg-muted/20 transition-colors">
                        <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleString("en-GB", {
                            dateStyle: "short",
                            timeStyle: "medium",
                          })}
                        </td>
                        <td className="p-3 text-xs">
                          <p className="font-medium">{log.user ? `${log.user.firstName} ${log.user.lastName}` : "System"}</p>
                          <p className="text-muted-foreground">{log.user?.email}</p>
                        </td>
                        <td className="p-3">
                          {method && (
                            <span className={cn(
                              "inline-flex items-center rounded px-1.5 py-0.5 text-xs font-mono font-semibold",
                              METHOD_COLORS[method] || "bg-gray-100 text-gray-800"
                            )}>
                              {method}
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-xs max-w-[240px]">
                          <p className="font-mono text-muted-foreground truncate">{path}</p>
                          <p className="text-muted-foreground text-xs truncate">{log.description}</p>
                        </td>
                        <td className="p-3 text-xs text-muted-foreground">
                          {log.entityType && <span className="capitalize">{log.entityType}</span>}
                          {log.entityId && <p className="font-mono truncate max-w-[80px]">{log.entityId}</p>}
                        </td>
                        <td className="p-3 text-xs font-mono text-muted-foreground">{log.ipAddress || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline" size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1 || loading}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <Button
                variant="outline" size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages || loading}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
