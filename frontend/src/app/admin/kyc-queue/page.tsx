"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, ShieldCheck, ShieldX } from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/api";
import { getToken } from "@/lib/auth";

export default function KycQueuePage() {
  const token = getToken();
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});

  useEffect(() => {
    apiRequest<{ records: any[] }>("/admin/kyc-queue", { token: token! })
      .then(({ records }) => setRecords(records))
      .catch(() => toast.error("Failed to load KYC queue"))
      .finally(() => setLoading(false));
  }, []);

  const action = async (id: string, decision: "VERIFIED" | "FAILED") => {
    setActioning(id);
    try {
      await apiRequest(`/admin/kyc/${id}`, {
        method: "PATCH",
        body: { decision, reason: reasons[id] || undefined },
        token: token!,
      });
      setRecords((r) => r.filter((rec) => rec.id !== id));
      toast.success(`KYC ${decision.toLowerCase()}`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActioning(null);
    }
  };

  return (
    <AppShell allowedRoles={["AGENT", "ADMIN"]}>
      <div className="p-8 space-y-6">
        <div>
          <h2 className="text-2xl font-bold">KYC Manual Review Queue</h2>
          <p className="text-muted-foreground text-sm mt-1">
            {records.length} case{records.length !== 1 ? "s" : ""} awaiting review
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : records.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">
              No KYC cases pending manual review.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {records.map((rec) => (
              <Card key={rec.id}>
                <CardContent className="py-5 space-y-4">
                  <div className="flex items-start justify-between flex-wrap gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{rec.ticket?.ticketNumber}</span>
                        <Badge variant="warning">Manual Review</Badge>
                      </div>
                      <p className="text-sm">{rec.user?.firstName} {rec.user?.lastName}</p>
                      <p className="text-xs text-muted-foreground">{rec.user?.email}</p>
                      <p className="text-xs text-muted-foreground">
                        Face match score: <span className="font-semibold">{rec.faceMatchScore?.toFixed(1) ?? "N/A"}%</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <Input
                        placeholder="Rejection reason (if failing)"
                        className="w-56 text-sm h-8"
                        value={reasons[rec.id] || ""}
                        onChange={(e) => setReasons((r) => ({ ...r, [rec.id]: e.target.value }))}
                      />
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 text-white"
                        onClick={() => action(rec.id, "VERIFIED")}
                        disabled={actioning === rec.id}
                      >
                        {actioning === rec.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                        <span className="ml-1.5">Verify</span>
                      </Button>
                      <Button
                        size="sm" variant="outline"
                        className="border-red-300 text-red-700 hover:bg-red-50"
                        onClick={() => action(rec.id, "FAILED")}
                        disabled={actioning === rec.id}
                      >
                        <ShieldX className="h-4 w-4" />
                        <span className="ml-1.5">Reject</span>
                      </Button>
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
