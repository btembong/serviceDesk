import { Badge } from "@/components/ui/badge";

const statusConfig: Record<string, { label: string; variant: any }> = {
  OPEN:       { label: "Open",       variant: "secondary" },
  IN_REVIEW:  { label: "In Review",  variant: "warning" },
  ESCALATED:  { label: "Escalated",  variant: "urgent" },
  RESOLVED:   { label: "Resolved",   variant: "success" },
  REJECTED:   { label: "Rejected",   variant: "destructive" },
  CLOSED:     { label: "Closed",     variant: "outline" },
};

const priorityConfig: Record<string, { label: string; variant: any }> = {
  LOW:    { label: "Low",    variant: "outline" },
  NORMAL: { label: "Normal", variant: "secondary" },
  HIGH:   { label: "High",   variant: "warning" },
  URGENT: { label: "Urgent", variant: "urgent" },
};

export function StatusBadge({ status }: { status: string }) {
  const cfg = statusConfig[status] || { label: status, variant: "outline" };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

export function PriorityBadge({ priority }: { priority: string }) {
  const cfg = priorityConfig[priority] || { label: priority, variant: "outline" };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}
