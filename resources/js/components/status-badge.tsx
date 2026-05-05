import { cn } from '@/lib/utils';
import type { StatusIncendio } from '@/types/dashboard';

type StatusBadgeProps = {
    status: StatusIncendio;
    className?: string;
};

const statusConfig: Record<
    StatusIncendio,
    { label: string; className: string }
> = {
    ativo: {
        label: 'Ativo',
        className: 'border-critical/30 bg-critical/15 text-critical',
    },
    em_combate: {
        label: 'Em Combate',
        className: 'border-warning/30 bg-warning/15 text-warning',
    },
    contido: {
        label: 'Contido',
        className: 'border-contained/30 bg-contained/15 text-contained',
    },
    resolvido: {
        label: 'Resolvido',
        className: 'border-resolved/30 bg-resolved/15 text-resolved',
    },
    inviavel: {
        label: 'Inviável',
        className: 'border-muted-foreground/30 bg-muted text-muted-foreground',
    },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
    const config = statusConfig[status];

    return (
        <span
            className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold',
                config.className,
                className,
            )}
        >
            {status === 'ativo' || status === 'em_combate' ? (
                <span className="status-pulse size-1.5 rounded-full bg-critical" />
            ) : null}
            {config.label}
        </span>
    );
}
