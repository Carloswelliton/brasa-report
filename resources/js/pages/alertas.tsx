import { Head, Link, usePage } from '@inertiajs/react';
import { motion } from 'framer-motion';
import {
    Bell,
    Check,
    Droplets,
    Filter,
    Flame,
    Loader2,
    MapPin,
    Thermometer,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import axios, { ensureSanctumCsrfCookie } from '@/lib/axios-setup';
import { cn } from '@/lib/utils';
import { alertas as alertasRoute, mapa as mapaRoute } from '@/routes';
import type { BreadcrumbItem } from '@/types';
import type {
    AlertaApiItem,
    OrigemResumoAlerta,
    PaginatedAlertas,
    TipoAlerta,
} from '@/types/operacoes';

const tipoConfig: Record<
    TipoAlerta,
    { icon: typeof Flame; label: string; color: string }
> = {
    fogo_detectado: {
        icon: Flame,
        label: 'Fogo detectado',
        color: 'text-critical',
    },
    temperatura_alta: {
        icon: Thermometer,
        label: 'Temperatura alta',
        color: 'text-warning',
    },
    umidade_baixa: {
        icon: Droplets,
        label: 'Umidade baixa',
        color: 'text-warning',
    },
    proximidade_local_critico: {
        icon: MapPin,
        label: 'Proximidade a local crítico',
        color: 'text-critical',
    },
};

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Alertas', href: alertasRoute().url },
];

function textoOrigemDetalhe(alerta: AlertaApiItem): string {
    const r = alerta.origem_resumo;
    if (!r) {
        const ref = (alerta.origem_id ?? '').slice(0, 8);

        return `${alerta.origem_label} · identificador ${ref || '—'}…`;
    }

    if (r.tipo === 'incendio') {
        const partes: string[] = [];
        if (r.area_nome) {
            partes.push(`Área: ${r.area_nome}`);
        }
        if (r.local_critico_nome) {
            partes.push(`Local crítico: ${r.local_critico_nome}`);
        }
        partes.push(
            `Estado da ocorrência: ${r.status.replace(/_/g, ' ')}`,
        );
        if (r.detectado_em) {
            partes.push(
                `Detectado em: ${new Date(r.detectado_em).toLocaleString('pt-BR')}`,
            );
        }

        return partes.join(' · ');
    }

    if (r.tipo === 'leitura_meteorologica') {
        const partes: string[] = [
            `Temperatura ${r.temperatura} °C · Umidade ${r.umidade} %`,
        ];
        if (r.area_nome) {
            partes.push(`Área do incêndio: ${r.area_nome}`);
        }
        if (r.registrado_em) {
            partes.push(
                `Registrado em: ${new Date(r.registrado_em).toLocaleString('pt-BR')}`,
            );
        }

        return partes.join(' · ');
    }

    if (r.tipo === 'deteccao_satelite') {
        const partes: string[] = [];
        if (r.fonte) {
            partes.push(`Fonte: ${r.fonte}`);
        }
        partes.push(`Coordenadas: ${r.latitude}, ${r.longitude}`);
        partes.push(`Confiança: ${r.confianca}`);
        if (r.detectado_em) {
            partes.push(
                `Detectado em: ${new Date(r.detectado_em).toLocaleString('pt-BR')}`,
            );
        }

        return partes.join(' · ');
    }

    return '';
}

function linkMapaIncendio(
    resumo: OrigemResumoAlerta | null | undefined,
): string | null {
    if (resumo?.tipo === 'incendio') {
        return mapaRoute().url;
    }
    if (resumo?.tipo === 'leitura_meteorologica') {
        return mapaRoute().url;
    }

    return null;
}

type PageProps = { alertas?: PaginatedAlertas };

const alertasVazio: PaginatedAlertas = {
    data: [],
    meta: {
        current_page: 1,
        last_page: 1,
        per_page: 20,
        total: 0,
    },
    links: {
        first: null,
        last: null,
        prev: null,
        next: null,
    },
};

export default function Alertas() {
    const pageProps = usePage<PageProps>().props;
    const alertasIniciais = pageProps.alertas ?? alertasVazio;

    const [alertas, setAlertas] = useState<AlertaApiItem[]>(
        () => alertasIniciais.data ?? [],
    );
    const [meta, setMeta] = useState(
        alertasIniciais.meta ?? alertasVazio.meta,
    );
    const [filtroTipo, setFiltroTipo] = useState<TipoAlerta | null>(null);
    const [filtroEntregue, setFiltroEntregue] = useState<boolean | null>(() => {
        const params = new URLSearchParams(window.location.search);
        const v = params.get('entregue');
        if (v === 'false') return false;
        if (v === 'true') return true;
        return null;
    });
    const [carregando, setCarregando] = useState(false);
    const [carregandoMais, setCarregandoMais] = useState(false);
    const [acaoId, setAcaoId] = useState<string | null>(null);

    useEffect(() => {
        let ativo = true;

        const carregar = async (): Promise<void> => {
            setCarregando(true);
            try {
                await ensureSanctumCsrfCookie();

                const query: Record<string, string | number | boolean> = {
                    page: 1,
                };
                if (filtroTipo) {
                    query.tipo = filtroTipo;
                }
                if (filtroEntregue !== null) {
                    query.entregue = filtroEntregue;
                }

                let res: { data: PaginatedAlertas };
                try {
                    res = await axios.get<PaginatedAlertas>('/api/alertas', {
                        params: query,
                    });
                } catch (err) {
                    const axiosErr = err as { response?: { status?: number } };
                    if (axiosErr?.response?.status === 401) {
                        await ensureSanctumCsrfCookie();
                        res = await axios.get<PaginatedAlertas>(
                            '/api/alertas',
                            { params: query },
                        );
                    } else {
                        throw err;
                    }
                }

                if (!ativo) {
                    return;
                }

                setMeta(res.data.meta);
                setAlertas(res.data.data);
            } catch {
                if (ativo) {
                    toast.error('Não foi possível carregar os alertas.');
                }
            } finally {
                if (ativo) {
                    setCarregando(false);
                }
            }
        };

        void carregar();

        return () => {
            ativo = false;
        };
    }, [filtroTipo, filtroEntregue]);

    const naoEntregues = useMemo(
        () => alertas.filter((a) => !a.entregue).length,
        [alertas],
    );

    const marcarEntregue = async (id: string) => {
        setAcaoId(id);
        try {
            const res = await axios.patch<{ data: AlertaApiItem }>(
                `/api/alertas/${id}/entregue`,
            );
            const atualizado = res.data.data;
            setAlertas((prev) =>
                prev.map((a) => (a.id === id ? atualizado : a)),
            );
            toast.success('Alerta marcado como entendido.');
        } catch {
            toast.error('Não foi possível atualizar o alerta.');
        } finally {
            setAcaoId(null);
        }
    };

    const marcarTodosEntregues = async () => {
        const pendentes = alertas.filter((a) => !a.entregue);
        if (pendentes.length === 0) {
            return;
        }

        setCarregando(true);
        try {
            await Promise.all(
                pendentes.map((a) =>
                    axios.patch(`/api/alertas/${a.id}/entregue`),
                ),
            );
            setAlertas((prev) => prev.map((a) => ({ ...a, entregue: true })));
            toast.success('Todos os alertas visíveis foram marcados como entendidos.');
        } catch {
            toast.error('Não foi possível marcar todos os alertas.');
            try {
                const res = await axios.get<PaginatedAlertas>('/api/alertas', {
                    params: { page: 1 },
                });
                setAlertas(res.data.data);
                setMeta(res.data.meta);
            } catch {
                /* ignora */
            }
        } finally {
            setCarregando(false);
        }
    };

    const carregarMais = async () => {
        if (meta.current_page >= meta.last_page || carregandoMais) {
            return;
        }

        setCarregandoMais(true);
        try {
            await ensureSanctumCsrfCookie();

            const query: Record<string, string | number | boolean> = {
                page: meta.current_page + 1,
            };
            if (filtroTipo) {
                query.tipo = filtroTipo;
            }
            if (filtroEntregue !== null) {
                query.entregue = filtroEntregue;
            }

            const res = await axios.get<PaginatedAlertas>('/api/alertas', {
                params: query,
            });

            setAlertas((prev) => [...prev, ...res.data.data]);
            setMeta(res.data.meta);
        } catch {
            toast.error('Não foi possível carregar mais alertas.');
        } finally {
            setCarregandoMais(false);
        }
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Alertas" />
            <div className="space-y-6 p-4 lg:p-6">
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                >
                    <div>
                        <h1 className="flex items-center gap-2 text-2xl font-bold">
                            Alertas
                            {naoEntregues > 0 ? (
                                <span className="inline-flex size-6 items-center justify-center rounded-full bg-critical text-xs font-bold text-critical-foreground">
                                    {naoEntregues}
                                </span>
                            ) : null}
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            Notificações automáticas do sistema com indicação da
                            origem de cada alerta
                        </p>
                    </div>
                    {naoEntregues > 0 ? (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void marcarTodosEntregues()}
                            disabled={carregando}
                            className="gap-2"
                        >
                            {carregando ? (
                                <Loader2 className="size-4 animate-spin" />
                            ) : (
                                <Check className="size-4" />
                            )}
                            Marcar todos como entendidos
                        </Button>
                    ) : null}
                </motion.div>

                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                    <div className="flex items-center gap-2 overflow-x-auto pb-2">
                        <Filter className="size-4 shrink-0 text-muted-foreground" />
                        <span className="shrink-0 text-xs font-medium text-muted-foreground">
                            Tipo:
                        </span>
                        <button
                            type="button"
                            onClick={() => setFiltroTipo(null)}
                            className={cn(
                                'shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                                !filtroTipo
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
                            )}
                        >
                            Todos
                        </button>
                        {(Object.keys(tipoConfig) as TipoAlerta[]).map((key) => {
                            const cfg = tipoConfig[key];
                            return (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() =>
                                        setFiltroTipo(
                                            filtroTipo === key ? null : key,
                                        )
                                    }
                                    className={cn(
                                        'shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                                        filtroTipo === key
                                            ? 'bg-primary text-primary-foreground'
                                            : 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
                                    )}
                                >
                                    {cfg.label}
                                </button>
                            );
                        })}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-medium text-muted-foreground">
                            Estado:
                        </span>
                        <button
                            type="button"
                            onClick={() => setFiltroEntregue(null)}
                            className={cn(
                                'rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                                filtroEntregue === null
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
                            )}
                        >
                            Todos
                        </button>
                        <button
                            type="button"
                            onClick={() => setFiltroEntregue(false)}
                            className={cn(
                                'rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                                filtroEntregue === false
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
                            )}
                        >
                            Pendentes
                        </button>
                        <button
                            type="button"
                            onClick={() => setFiltroEntregue(true)}
                            className={cn(
                                'rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                                filtroEntregue === true
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
                            )}
                        >
                            Entendidos
                        </button>
                    </div>
                </div>

                {carregando && alertas.length === 0 ? (
                    <div className="flex justify-center py-12">
                        <Loader2 className="size-8 animate-spin text-muted-foreground" />
                    </div>
                ) : null}

                <div className="space-y-3">
                    {alertas.map((alerta, i) => {
                        const cfg =
                            tipoConfig[alerta.tipo] ?? tipoConfig.fogo_detectado;
                        const Icon = cfg.icon;
                        const hrefMapa = linkMapaIncendio(alerta.origem_resumo);

                        return (
                            <motion.div
                                key={alerta.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.03 }}
                                className={cn(
                                    'glass-panel flex flex-col gap-3 rounded-xl p-4 transition-all sm:flex-row sm:items-start',
                                    !alerta.entregue &&
                                        'border-primary/20 bg-primary/5',
                                )}
                            >
                                <div
                                    className={cn(
                                        'flex size-fit rounded-lg bg-secondary p-2.5',
                                        cfg.color,
                                    )}
                                >
                                    <Icon className="size-5" />
                                </div>
                                <div className="min-w-0 flex-1 space-y-2">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span
                                            className={cn(
                                                'text-xs font-semibold tracking-wider uppercase',
                                                cfg.color,
                                            )}
                                        >
                                            {cfg.label}
                                        </span>
                                        {!alerta.entregue ? (
                                            <span className="status-pulse size-2 rounded-full bg-primary" />
                                        ) : null}
                                    </div>
                                    <p className="text-sm leading-relaxed">
                                        {alerta.mensagem}
                                    </p>
                                    <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                                        <p className="font-semibold text-foreground">
                                            Origem: {alerta.origem_label}
                                        </p>
                                        <p className="mt-1">
                                            {textoOrigemDetalhe(alerta)}
                                        </p>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Enviado em:{' '}
                                        {new Date(
                                            alerta.enviado_em,
                                        ).toLocaleString('pt-BR')}
                                    </p>
                                    {hrefMapa ? (
                                        <Link
                                            href={hrefMapa}
                                            className="inline-flex text-xs font-medium text-primary underline-offset-4 hover:underline"
                                        >
                                            Abrir mapa
                                        </Link>
                                    ) : null}
                                </div>
                                {!alerta.entregue ? (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() =>
                                            void marcarEntregue(alerta.id)
                                        }
                                        disabled={acaoId === alerta.id}
                                        className="shrink-0 gap-1"
                                    >
                                        {acaoId === alerta.id ? (
                                            <Loader2 className="size-4 animate-spin" />
                                        ) : (
                                            <Check className="size-4" />
                                        )}
                                        <span className="sr-only sm:not-sr-only">
                                            Entendido
                                        </span>
                                    </Button>
                                ) : null}
                            </motion.div>
                        );
                    })}
                </div>

                {meta.current_page < meta.last_page ? (
                    <div className="flex justify-center">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void carregarMais()}
                            disabled={carregandoMais}
                            className="gap-2"
                        >
                            {carregandoMais ? (
                                <Loader2 className="size-4 animate-spin" />
                            ) : null}
                            Carregar mais
                        </Button>
                    </div>
                ) : null}

                {!carregando && alertas.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
                        <Bell className="size-10 opacity-40" />
                        <p className="text-sm">Nenhum alerta neste filtro.</p>
                    </div>
                ) : null}
            </div>
        </AppLayout>
    );
}
