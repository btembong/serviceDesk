"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft, CheckCircle, XCircle, AlertTriangle,
  MessageSquare, Send, Loader2, ShieldCheck, GitMerge, User,
} from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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

export default function AgentTicketPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const token = getToken();
  const agent = getUser();

  const [ticket, setTicket] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [mergeId, setMergeId] = useState("");
  const [priorityReason, setPriorityReason] = useState("");
  const [newPriority, setNewPriority] = useState("");

  useEffect(() => {
    apiRequest<{ ticket: any }>(`/tickets/${id}`, { token: token! })
      .then(({ ticket }) => setTicket(ticket))
      .catch(() => toast.error("Could not load ticket"))
      .finally(() => setLoading(false));
  }, [id]);

  const updateStatus = async (status: string) => {
    setUpdating(true);
    try {
      const res = await apiRequest<{ ticket: any }>(`/tickets/${id}`, {
        method: "PATCH",
        body: { status },
        token: token!,
      });
      setTicket(res.ticket);
      toast.success(`Ticket marked as ${status.toLowerCase().replace("_", " ")}`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUpdating(false);
    }
  };

  const updatePriority = async () => {
    if (!newPriority) return;
    setUpdating(true);
    try {
      const res = await apiRequest<{ ticket: any }>(`/tickets/${id}`, {
        method: "PATCH",
        body: { priority: newPriority, priorityReason },
        token: token!,
      });
      setTicket(res.ticket);
      toast.success("Priority updated");
      setNewPriority("");
      setPriorityReason("");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUpdating(false);
    }
  };

  const sendComment = async () => {
    if (!comment.trim()) return;
    setSubmitting(true);
    try {
      const res = await apiRequest<{ comment: any }>(`/tickets/${id}/comment`, {
        method: "POST",
        body: { body: comment, isInternal },
        token: token!,
      });
      setTicket((t: any) => ({ ...t, comments: [...(t.comments || []), res.comment] }));
      setComment("");
      toast.success(isInternal ? "Internal note added" : "Reply sent to customer");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const mergeTicket = async () => {
    if (!mergeId.trim()) return;
    try {
      await apiRequest(`/tickets/${id}/merge`, {
        method: "POST",
        body: { mergeIntoId: mergeId },
        token: token!,
      });
      toast.success("Tickets merged");
      router.push("/agent");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  if (loading) return (
    <AppShell allowedRoles={["AGENT", "ADMIN"]}>
      <div className="p-8 flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    </AppShell>
  );

  if (!ticket) return (
    <AppShell allowedRoles={["AGENT", "ADMIN"]}>
      <div className="p-8 text-center text-muted-foreground">Ticket not found.</div>
    </AppShell>
  );

  return (
    <AppShell allowedRoles={["AGENT", "ADMIN"]}>
      <div className="p-8 max-w-4xl mx-auto space-y-6">
        <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to queue
        </button>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-xl font-bold">{ticket.ticketNumber}</h2>
              <PriorityBadge priority={ticket.priority} />
              <StatusBadge status={ticket.status} />
            </div>
            <p className="text-base font-medium">{ticket.subject}</p>
            <p className="text-sm text-muted-foreground">{CATEGORY_LABELS[ticket.category]}</p>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 flex-wrap">
            <Button
              size="sm" variant="outline"
              className="border-green-300 text-green-700 hover:bg-green-50"
              onClick={() => updateStatus("RESOLVED")} disabled={updating || ticket.status === "RESOLVED"}
            >
              <CheckCircle className="mr-1.5 h-4 w-4" /> Resolve
            </Button>
            <Button
              size="sm" variant="outline"
              className="border-yellow-300 text-yellow-700 hover:bg-yellow-50"
              onClick={() => updateStatus("ESCALATED")} disabled={updating || ticket.status === "ESCALATED"}
            >
              <AlertTriangle className="mr-1.5 h-4 w-4" /> Escalate
            </Button>
            <Button
              size="sm" variant="outline"
              className="border-red-300 text-red-700 hover:bg-red-50"
              onClick={() => updateStatus("REJECTED")} disabled={updating || ticket.status === "REJECTED"}
            >
              <XCircle className="mr-1.5 h-4 w-4" /> Reject
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-5">
            {/* Description */}
            <Card>
              <CardHeader><CardTitle className="text-sm">Description</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{ticket.description}</p>
              </CardContent>
            </Card>

            {/* KYC Result */}
            {ticket.kycRecord && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4" /> KYC Verification
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <Badge variant={ticket.kycRecord.status === "VERIFIED" ? "success" : ticket.kycRecord.status === "FAILED" ? "destructive" : "warning"}>
                      {ticket.kycRecord.status}
                    </Badge>
                  </div>
                  {ticket.kycRecord.faceMatchScore && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Face match</span>
                      <span className="font-medium">{ticket.kycRecord.faceMatchScore.toFixed(1)}%</span>
                    </div>
                  )}
                  {ticket.kycRecord.ocrName && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Name on ID</span>
                      <span>{ticket.kycRecord.ocrName}</span>
                    </div>
                  )}
                  {ticket.kycRecord.ocrIdNumber && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">ID number</span>
                      <span className="font-mono">{ticket.kycRecord.ocrIdNumber}</span>
                    </div>
                  )}
                  {ticket.kycRecord.failureReason && (
                    <div className="bg-red-50 border border-red-200 rounded p-2 text-red-700 text-xs">
                      {ticket.kycRecord.failureReason}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Comments */}
            <Card>
              <CardHeader><CardTitle className="text-sm flex items-center gap-2"><MessageSquare className="h-4 w-4" /> Comments</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {(!ticket.comments || ticket.comments.length === 0) ? (
                  <p className="text-sm text-muted-foreground">No comments yet.</p>
                ) : (
                  <div className="space-y-3">
                    {ticket.comments.map((c: any) => (
                      <div key={c.id} className={`p-3 rounded-lg text-sm border ${c.isInternal ? "bg-amber-50 border-amber-200" : "bg-muted border-border"}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-xs">{c.author?.firstName} {c.author?.lastName}</span>
                          <Badge variant="outline" className="text-xs py-0">{c.author?.role}</Badge>
                          {c.isInternal && <Badge variant="warning" className="text-xs py-0">Internal</Badge>}
                          <span className="text-xs text-muted-foreground ml-auto">{new Date(c.createdAt).toLocaleString()}</span>
                        </div>
                        <p className="whitespace-pre-wrap">{c.body}</p>
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-2 pt-2 border-t">
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isInternal}
                        onChange={(e) => setIsInternal(e.target.checked)}
                        className="accent-primary"
                      />
                      Internal note (not visible to customer)
                    </label>
                  </div>
                  <Textarea
                    rows={3}
                    placeholder={isInternal ? "Add internal note..." : "Reply to customer..."}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                  />
                  <Button size="sm" onClick={sendComment} disabled={submitting || !comment.trim()}>
                    {submitting ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : <Send className="mr-1.5 h-3 w-3" />}
                    {isInternal ? "Add note" : "Send reply"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Customer info */}
            <Card>
              <CardHeader><CardTitle className="text-sm flex items-center gap-2"><User className="h-4 w-4" /> Customer</CardTitle></CardHeader>
              <CardContent className="text-sm space-y-2">
                <p className="font-medium">{ticket.customer?.firstName} {ticket.customer?.lastName}</p>
                <p className="text-muted-foreground">{ticket.customer?.email}</p>
                <p className="text-xs text-muted-foreground">
                  Submitted {new Date(ticket.createdAt).toLocaleDateString("en-GB", { dateStyle: "medium" })}
                </p>
              </CardContent>
            </Card>

            {/* Priority change */}
            <Card>
              <CardHeader><CardTitle className="text-sm">Change Priority</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Select value={newPriority} onValueChange={setNewPriority}>
                  <SelectTrigger><SelectValue placeholder="Select priority" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Low</SelectItem>
                    <SelectItem value="NORMAL">Normal</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                    <SelectItem value="URGENT">Urgent</SelectItem>
                  </SelectContent>
                </Select>
                {["HIGH", "URGENT"].includes(newPriority) && (
                  <div className="space-y-1">
                    <Label className="text-xs">Reason (required)</Label>
                    <Input
                      placeholder="Reason for escalating priority"
                      value={priorityReason}
                      onChange={(e) => setPriorityReason(e.target.value)}
                    />
                  </div>
                )}
                <Button size="sm" className="w-full" onClick={updatePriority}
                  disabled={!newPriority || (["HIGH", "URGENT"].includes(newPriority) && !priorityReason) || updating}>
                  Update priority
                </Button>
              </CardContent>
            </Card>

            {/* Merge ticket */}
            <Card>
              <CardHeader><CardTitle className="text-sm flex items-center gap-2"><GitMerge className="h-4 w-4" /> Merge Ticket</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Input
                  placeholder="Target ticket ID"
                  value={mergeId}
                  onChange={(e) => setMergeId(e.target.value)}
                />
                <Button size="sm" variant="outline" className="w-full" onClick={mergeTicket} disabled={!mergeId.trim()}>
                  Merge into target
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
