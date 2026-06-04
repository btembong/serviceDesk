"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, ScanFace, ShieldCheck, ShieldX, ExternalLink } from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/api";
import { getToken } from "@/lib/auth";

export default function AgentKycQueuePage() {
  const token = getToken();
  const router = useRouter();
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
    if (decision === "FAILED" && !reasons[id]?.trim()) {
      toast.error("Please provide a rejection reason before failing.");
      return;
    }
    setActioning(id);
    try {
      await apiRequest(`/admin/kyc/${id}`, {
        method: "PATCH",
        body: { decision, reason: reasons[id] || undefined },
        token: token!,
      });
      setRecords((r) => r.filter((rec) => rec.id !== id));
      toast.success(`KYC ${decision === "VERIFIED" ? "verified" : "rejected"}`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActioning(null);
    }
  };

  return (
    <AppShell allowedRoles={["AGENT", "ADMIN"]}>
      <div className="p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="bg-indigo-50 p-2.5 rounded-full">
            <ScanFace className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">KYC Review Queue</h2>
            <p className="text-muted-foreground text-sm mt-0.5">
              {records.length} case{records.length !== 1 ? "s" : ""} pending manual review
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : records.length === 0 ? (
          <Card>
            <CardContent className="py-20 text-center space-y-3">
              <ScanFace className="h-12 w-12 text-muted-foreground mx-auto" />
              <p className="font-medium text-muted-foreground">No KYC cases pending review</p>
              <p className="text-sm text-muted-foreground">All cases have been actioned.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {records.map((rec) => (
              <Card key={rec.id} className="border-indigo-100">
                <CardContent className="py-5">
                  <div className="flex flex-col gap-4">
                    {/* Top row — identity + ticket link */}
                    <div className="flex items-start justify-between flex-wrap gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold">{rec.user?.firstName} {rec.user?.lastName}</span>
                          <Badge variant="warning">Manual Review Required</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{rec.user?.email}</p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1 flex-wrap">
                          <span>Ticket: <span className="font-mono font-medium text-foreground">{rec.ticket?.ticketNumber}</span></span>
                          <span>ID type: <span className="font-medium text-foreground">{rec.idType?.replace(/_/g, " ") || "N/A"}</span></span>
                          <span>Face match: <span className={`font-semibold ${rec.faceMatchScore >= 60 ? "text-yellow-600" : "text-red-600"}`}>
                            {rec.faceMatchScore != null ? `${rec.faceMatchScore.toFixed(1)}%` : "N/A"}
                          </span></span>
                          <span>Submitted: {new Date(rec.createdAt).toLocaleDateString("en-GB", { dateStyle: "medium" })}</span>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => router.push(`/agent/tickets/${rec.ticket?.id}`)}
                      >
                        <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                        View ticket
                      </Button>
                    </div>

                    {/* OCR data if available */}
                    {(rec.ocrName || rec.ocrIdNumber || rec.ocrDob) && (
                      <div className="bg-indigo-50 rounded-lg px-4 py-3 grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                        {rec.ocrName && (
                          <div>
                            <p className="text-xs text-muted-foreground">Name on ID</p>
                            <p className="font-medium">{rec.ocrName}</p>
                          </div>
                        )}
                        {rec.ocrIdNumber && (
                          <div>
                            <p className="text-xs text-muted-foreground">ID number</p>
                            <p className="font-mono font-medium">{rec.ocrIdNumber}</p>
                          </div>
                        )}
                        {rec.ocrDob && (
                          <div>
                            <p className="text-xs text-muted-foreground">Date of birth</p>
                            <p className="font-medium">{rec.ocrDob}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Action row */}
                    <div className="flex items-center gap-3 flex-wrap pt-1 border-t">
                      <Input
                        placeholder="Rejection reason (required if rejecting)"
                        className="flex-1 min-w-[220px] h-9 text-sm"
                        value={reasons[rec.id] || ""}
                        onChange={(e) => setReasons((r) => ({ ...r, [rec.id]: e.target.value }))}
                      />
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 text-white gap-1.5"
                        onClick={() => action(rec.id, "VERIFIED")}
                        disabled={actioning === rec.id}
                      >
                        {actioning === rec.id
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <ShieldCheck className="h-3.5 w-3.5" />
                        }
                        Verify
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-red-200 text-red-700 hover:bg-red-50 gap-1.5"
                        onClick={() => action(rec.id, "FAILED")}
                        disabled={actioning === rec.id}
                      >
                        <ShieldX className="h-3.5 w-3.5" />
                        Reject
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
