import { Link } from '@inertiajs/react';
import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

type StatsCardProps = {
    label: string;
    value: string | number;
    icon: LucideIcon;
    variant?: 'default' | 'critical' | 'warning' | 'success';
    subtitle?: string;
    href?: string;
};

const variantStyles = {
    default: 'border-border',
    critical: 'border-critical/30 glow-red',
    warning: 'border-contained/30 glow-amber',
    success: 'border-resolved/30',
};

const iconVariantStyles = {
    default: 'bg-secondary text-secondary-foreground',
    critical: 'bg-critical/15 text-critical',
    warning: 'bg-contained/15 text-contained',
    success: 'bg-resolved/15 text-resolved',
};

export function StatsCard({
    label,
    value,
    icon: Icon,
    variant = 'default',
    subtitle,
    href,
}: StatsCardProps) {
    const className = cn(
        'glass-panel rounded-xl p-4 transition-all hover:scale-[1.02]',
        href && 'cursor-pointer hover:ring-1 hover:ring-border',
        variantStyles[variant],
    );

    const content = (
        <div className="flex items-start justify-between">
            <div>
                <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                    {label}
                </p>
                <p className="mt-1 text-2xl font-bold">{value}</p>
                {subtitle ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                        {subtitle}
                    </p>
                ) : null}
            </div>
            <div
                className={cn(
                    'rounded-lg p-2.5',
                    iconVariantStyles[variant],
                )}
            >
                <Icon className="size-5" />
            </div>
        </div>
    );

    if (href) {
        return (
            <Link href={href} className={className} prefetch>
                {content}
            </Link>
        );
    }

    return <div className={className}>{content}</div>;
}
