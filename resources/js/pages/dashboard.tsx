import { Head, Link } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
    Bell,
    Droplets,
    Flame,
    MapPin,
    ShieldAlert,
    Thermometer,
    TrendingUp,
    Users,
} from 'lucide-react';

import { RiskBadge } from '@/components/risk-badge';
import { StatsCard } from '@/components/stats-card';
import { StatusBadge } from '@/components/status-badge';
import AppLayout from '@/layouts/app-layout';
import axios from '@/lib/axios-setup';
import { alertas as alertasRoute, dashboard, mapa as mapaRoute } from '@/routes';
import type { BreadcrumbItem } from '@/types';
import type { DashboardDados } from '@/types/dashboard';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Painel',
        href: dashboard().url,
    },
];

interface DashboardProps {
    dados: DashboardDados;
}

export default function Dashboard({ dados }: DashboardProps) {
    const [dashboardDados, setDashboardDados] = useState<DashboardDados>(dados);
    const [isLoading, setIsLoading] = useState(false);
    const [hasError, setHasError] = useState(false);

    useEffect(() => {
        let isMounted = true;

        async function carregar(): Promise<void> {
            setIsLoading(true);
            setHasError(false);
            try {
                const response = await axios.get<DashboardDados>('/api/dashboard');
                if (isMounted) {
                    setDashboardDados(response.data);
                }
            } catch {
                if (isMounted) {
                    setHasError(true);
                }
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        }

        void carregar();

        return () => {
            isMounted = false;
        };
    }, []);

    const clima = dashboardDados.clima;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Painel" />
            <div className="space-y-6 p-4 lg:p-6">
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35 }}
                >
                    <h1 className="text-2xl font-bold">Painel de Controle</h1>
                    <p className="text-sm text-muted-foreground">
                        Serra do Amolar — Corumbá, MS
                    </p>
                    {dashboardDados.ultimo_registro ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                            Último registro de incêndio:{' '}
                            {new Date(
                                dashboardDados.ultimo_registro,
                            ).toLocaleString(
                                'pt-BR',
                            )}
                        </p>
                    ) : null}
                    {hasError ? (
                        <p className="mt-1 text-xs text-warning">
                            Não foi possível atualizar os dados agora.
                        </p>
                    ) : null}
                </motion.div>

                <motion.div
                    className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.1 }}
                >
                    <StatsCard
                        label="Incêndios Ativos"
                        value={dashboardDados.incendios.ativos}
                        icon={Flame}
                        variant="critical"
                        href={`${mapaRoute().url}?status=ativo,em_combate`}
                    />
                    <StatsCard
                        label="Alertas Pendentes"
                        value={dashboardDados.alertas.nao_entregues}
                        icon={Bell}
                        variant="warning"
                        href={`${alertasRoute().url}?entregue=false`}
                    />
                    <StatsCard
                        label="Ocorrências Contidas"
                        value={dashboardDados.incendios.contidos}
                        icon={ShieldAlert}
                        href={`${mapaRoute().url}?status=contido`}
                    />
                    <StatsCard
                        label="Incêndios Resolvidos"
                        value={dashboardDados.incendios.resolvidos}
                        icon={Users}
                        variant="success"
                        href={`${mapaRoute().url}?status=resolvido`}
                    />
                </motion.div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                    <motion.div
                        className="glass-panel rounded-xl p-5"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.2 }}
                    >
                        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold">
                            <TrendingUp className="size-4 text-primary" />
                            Condições Climáticas
                        </h3>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Thermometer className="size-4 text-critical" />
                                    <span className="text-sm text-muted-foreground">
                                        Temperatura
                                    </span>
                                </div>
                                <span className="text-lg font-bold text-critical">
                                {clima ? `${Math.round(clima.temperatura_c)}°C` : '—'}
                                </span>
                            </div>
                            <div className="h-2 w-full rounded-full bg-secondary">
                                <div
                                    className="h-2 rounded-full bg-linear-to-r from-warning to-critical"
                                    style={{
                                    width: clima
                                        ? `${Math.min(100, Math.max(0, (clima.temperatura_c / 50) * 100))}%`
                                        : '0%',
                                    }}
                                />
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Droplets className="size-4 text-primary" />
                                    <span className="text-sm text-muted-foreground">
                                        Umidade
                                    </span>
                                </div>
                                <span className="text-lg font-bold text-warning">
                                {clima ? `${clima.umidade_pct}%` : '—'}
                                </span>
                            </div>
                            <div className="h-2 w-full rounded-full bg-secondary">
                                <div
                                    className="h-2 rounded-full bg-linear-to-r from-critical to-warning"
                                    style={{
                                    width: clima
                                        ? `${Math.min(100, Math.max(0, clima.umidade_pct))}%`
                                        : '0%',
                                    }}
                                />
                            </div>

                        {clima && clima.umidade_pct < 25 ? (
                            <div className="mt-2 rounded-lg border border-critical/20 bg-critical/10 p-3">
                                <p className="text-xs font-medium text-critical">
                                    Risco extremo de incêndio — umidade abaixo
                                    de 25%
                                </p>
                            </div>
                        ) : null}
                        {clima ? (
                            <p className="mt-2 text-xs text-muted-foreground">
                                Atualizado:{' '}
                                {new Date(clima.atualizado_em).toLocaleString('pt-BR')}
                            </p>
                        ) : (
                            <p className="mt-2 text-xs text-muted-foreground">
                                {isLoading ? 'Carregando clima…' : 'Clima indisponível.'}
                            </p>
                        )}
                        </div>
                    </motion.div>

                    <motion.div
                        className="glass-panel rounded-xl p-5 lg:col-span-2"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.3 }}
                    >
                        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold">
                            <Flame className="size-4 text-primary" />
                            Ocorrências Recentes
                        </h3>
                        <div className="space-y-3">
                            {dashboardDados.incendios_recentes.map((inc) => (
                                <Link
                                    key={inc.id}
                                    href={`${mapaRoute().url}?incendio=${inc.id}`}
                                    prefetch
                                    className="flex items-start gap-3 rounded-lg bg-secondary/50 p-3 transition-colors hover:bg-secondary/80"
                                >
                                    <div className="mt-0.5">
                                        <MapPin className="size-4 text-muted-foreground" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="text-sm font-medium">
                                                {inc.area_nome}
                                            </span>
                                            <StatusBadge status={inc.status} />
                                            <RiskBadge
                                                nivel={inc.nivel_risco}
                                            />
                                        </div>
                                        <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                                            {inc.descricao}
                                        </p>
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            {new Date(
                                                inc.detectado_em,
                                            ).toLocaleString('pt-BR')}{' '}
                                            — {inc.registrado_por}
                                        </p>
                                    </div>
                                </Link>
                            ))}
                            {dashboardDados.incendios_recentes.length === 0 ? (
                                <p className="text-xs text-muted-foreground">
                                    Nenhuma ocorrência recente.
                                </p>
                            ) : null}
                        </div>
                    </motion.div>
                </div>

                <motion.div
                    className="glass-panel rounded-xl p-5"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.4 }}
                >
                    <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold">
                        <Bell className="size-4 text-primary" />
                        Alertas Recentes
                    </h3>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        {dashboardDados.alertas_recentes.map((alerta) => (
                            <div
                                key={alerta.id}
                                className={`rounded-lg border p-3 transition-colors ${
                                    alerta.entregue
                                        ? 'border-border bg-secondary/30'
                                        : 'border-primary/20 bg-primary/5'
                                }`}
                            >
                                <div className="flex items-start gap-2">
                                    {!alerta.entregue ? (
                                        <span className="status-pulse mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
                                    ) : null}
                                    <div>
                                        <p className="text-sm font-medium">
                                            {alerta.mensagem}
                                        </p>
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            {new Date(
                                                alerta.enviado_em,
                                            ).toLocaleString('pt-BR')}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {dashboardDados.alertas_recentes.length === 0 ? (
                            <p className="text-xs text-muted-foreground">
                                Nenhum alerta recente.
                            </p>
                        ) : null}
                    </div>
                </motion.div>
            </div>
        </AppLayout>
    );
}
