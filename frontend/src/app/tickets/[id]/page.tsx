"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, MessageSquare, Send, Loader2, ShieldCheck, RotateCcw, Clock, AlertTriangle } from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
  INFO_UPDATE: "Information Update",
  COMPLAINT_FEEDBACK: "Complaint / Feedback",
};

const STATUS_STEPS = ["OPEN", "IN_REVIEW", "RESOLVED"];

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const token = getToken();
  const user = getUser();
  const [ticket, setTicket] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [reopening, setReopening] = useState(false);

  useEffect(() => {
    apiRequest<{ ticket: any }>(`/tickets/${id}`, { token: token! })
      .then(({ ticket }) => setTicket(ticket))
      .catch(() => toast.error("Could not load ticket"))
      .finally(() => setLoading(false));
  }, [id]);

  const sendComment = async () => {
    if (!comment.trim()) return;
    setSubmitting(true);
    try {
      const res = await apiRequest<{ comment: any }>(`/tickets/${id}/comment`, {
        method: "POST",
        body: { body: comment },
        token: token!,
      });
      setTicket((t: any) => ({ ...t, comments: [...(t.comments || []), res.comment] }));
      setComment("");
      toast.success("Comment added");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReopen = async () => {
    setReopening(true);
    try {
      await apiRequest(`/tickets/${id}/reopen`, { method: "POST", token: token! });
      toast.success("Ticket reopened");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setReopening(false);
    }
  };

  const currentStep = STATUS_STEPS.indexOf(ticket?.status);

  if (loading) return (
    <AppShell>
      <div className="p-8 flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    </AppShell>
  );

  if (!ticket) return (
    <AppShell>
      <div className="p-8 text-center text-muted-foreground">Ticket not found.</div>
    </AppShell>
  );

  return (
    <AppShell>
      <div className="p-8 max-w-3xl mx-auto space-y-6">
        <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        {/* Ticket header */}
        <div className="space-y-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-xl font-bold">{ticket.subject}</h2>
            <PriorityBadge priority={ticket.priority} />
            <StatusBadge status={ticket.status} />
          </div>
          <p className="text-sm text-muted-foreground font-mono">{ticket.ticketNumber} &mdash; {CATEGORY_LABELS[ticket.category]}</p>
          <p className="text-xs text-muted-foreground">Submitted {new Date(ticket.createdAt).toLocaleDateString("en-GB", { dateStyle: "medium" })}</p>
        </div>

        {/* SLA countdown */}
        {ticket.slaDeadline && !["RESOLVED", "CLOSED", "REJECTED"].includes(ticket.status) && (() => {
          const diff = new Date(ticket.slaDeadline).getTime() - Date.now();
          const breached = diff < 0;
          const h = Math.floor(Math.abs(diff) / 3600000);
          const m = Math.floor((Math.abs(diff) % 3600000) / 60000);
          const label = breached ? `Overdue by ${h > 0 ? `${h}h ` : ""}${m}m` : `${h > 0 ? `${h}h ` : ""}${m}m remaining`;
          return (
            <div className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium ${breached ? "bg-red-50 text-red-700 border border-red-200" : "bg-indigo-50 text-primary border border-indigo-100"}`}>
              {breached ? <AlertTriangle className="h-4 w-4 shrink-0" /> : <Clock className="h-4 w-4 shrink-0" />}
              <span>SLA deadline: {label}</span>
              <span className="ml-auto text-xs font-normal opacity-70">{new Date(ticket.slaDeadline).toLocaleString("en-GB")}</span>
            </div>
          );
        })()}

        {/* Progress tracker */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              {STATUS_STEPS.map((s, i) => (
                <div key={s} className="flex-1 flex flex-col items-center gap-2">
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${
                    i <= currentStep ? "bg-primary border-primary text-white" : "border-border text-muted-foreground"
                  }`}>
                    {i + 1}
                  </div>
                  <span className="text-xs text-center text-muted-foreground capitalize">{s.replace("_", " ")}</span>
                  {i < STATUS_STEPS.length - 1 && (
                    <div className={`absolute h-0.5 w-1/3 mt-4 ${i < currentStep ? "bg-primary" : "bg-border"}`} />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Description */}
        <Card>
          <CardHeader><CardTitle className="text-base">Description</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-foreground whitespace-pre-wrap">{ticket.description}</p>
          </CardContent>
        </Card>

        {/* KYC status */}
        {ticket.kycRecord && (
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Identity Verification</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-sm">KYC Status</span>
                <Badge variant={ticket.kycRecord.status === "VERIFIED" ? "success" : ticket.kycRecord.status === "FAILED" ? "destructive" : "warning"}>
                  {ticket.kycRecord.status}
                </Badge>
              </div>
              {ticket.kycRecord.faceMatchScore && (
                <p className="text-xs text-muted-foreground mt-1">Face match confidence: {ticket.kycRecord.faceMatchScore.toFixed(1)}%</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Comments */}
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><MessageSquare className="h-4 w-4" /> Comments</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {(!ticket.comments || ticket.comments.length === 0) ? (
              <p className="text-sm text-muted-foreground">No comments yet.</p>
            ) : (
              <div className="space-y-3">
                {ticket.comments.map((c: any) => (
                  <div key={c.id} className={`p-3 rounded-lg text-sm ${c.author?.id === user?.id ? "bg-primary/5 border border-primary/10 ml-8" : "bg-muted mr-8"}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-xs">{c.author?.firstName} {c.author?.lastName}</span>
                      <span className="text-xs text-muted-foreground">{new Date(c.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="whitespace-pre-wrap">{c.body}</p>
                  </div>
                ))}
              </div>
            )}

            {ticket.status !== "RESOLVED" && ticket.status !== "CLOSED" && (
              <div className="space-y-2 pt-2 border-t">
                <Textarea
                  rows={3}
                  placeholder="Add a comment..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
                <Button size="sm" onClick={sendComment} disabled={submitting || !comment.trim()}>
                  {submitting ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Send className="mr-2 h-3 w-3" />}
                  Send
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Reopen */}
        {ticket.status === "RESOLVED" && ticket.reopenCount < 1 && user?.role === "CUSTOMER" && (
          <div className="flex justify-end">
            <Button variant="outline" onClick={handleReopen} disabled={reopening}>
              {reopening && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <RotateCcw className="mr-2 h-4 w-4" /> Reopen ticket
            </Button>
          </div>
        )}
      </div>
    </AppShell>
  );
}
