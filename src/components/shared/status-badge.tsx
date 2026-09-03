import { CheckCircle2, Circle, Clock, AlertTriangle, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { FeeStatus, AttendanceStatus } from "@/types/database";

const FEE_STATUS_CONFIG: Record<FeeStatus, { label: string; variant: "success" | "warning" | "danger" | "neutral"; icon: typeof CheckCircle2 }> = {
  paid: { label: "Paid", variant: "success", icon: CheckCircle2 },
  partial: { label: "Partially Paid", variant: "warning", icon: Clock },
  pending: { label: "Pending", variant: "neutral", icon: Circle },
  overdue: { label: "Overdue", variant: "danger", icon: AlertTriangle },
};

export function FeeStatusBadge({ status }: { status: FeeStatus }) {
  const config = FEE_STATUS_CONFIG[status];
  const Icon = config.icon;
  return (
    <Badge variant={config.variant}>
      <Icon className="size-3" />
      {config.label}
    </Badge>
  );
}

export function AttendanceStatusBadge({ status }: { status: AttendanceStatus }) {
  return status === "present" ? (
    <Badge variant="success">
      <CheckCircle2 className="size-3" /> Present
    </Badge>
  ) : (
    <Badge variant="danger">
      <XCircle className="size-3" /> Absent
    </Badge>
  );
}

export function ActiveStatusBadge({ isActive }: { isActive: boolean }) {
  return isActive ? (
    <Badge variant="success" dot>Active</Badge>
  ) : (
    <Badge variant="neutral" dot>Inactive</Badge>
  );
}
