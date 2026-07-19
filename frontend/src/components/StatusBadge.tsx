type StatusTone = "neutral" | "good" | "warning" | "danger";

interface StatusBadgeProps {
  children: string;
  tone?: StatusTone;
}

function StatusBadge({ children, tone = "neutral" }: StatusBadgeProps) {
  return <span className={`status-badge status-badge-${tone}`}>{children}</span>;
}

export default StatusBadge;
