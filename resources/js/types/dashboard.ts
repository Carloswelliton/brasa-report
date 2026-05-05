export type StatusIncendio = 'ativo' | 'em_combate' | 'contido' | 'resolvido' | 'inviavel';

export type NivelRisco = 'alto' | 'medio' | 'baixo';

export interface ClimaDashboard {
    temperatura_c: number;
    umidade_pct: number;
    atualizado_em: string;
}

export interface IncendioResumo {
    id: string;
    status: StatusIncendio;
    nivel_risco: NivelRisco;
    descricao: string;
    area_nome: string;
    registrado_por: string;
    criado_em: string;
}

export interface AlertaResumo {
    id: string;
    mensagem: string;
    criado_em: string;
    lido: boolean;
}

export interface IncendioRecente {
    id: string;
    status: StatusIncendio;
    nivel_risco: NivelRisco;
    descricao: string;
    area_nome: string;
    registrado_por: string;
    detectado_em: string;
}

export interface AlertaRecente {
    id: string;
    tipo: string;
    mensagem: string;
    enviado_em: string;
    entregue: boolean;
}

export interface EstatisticasDashboard {
    incendios_ativos: number;
    incendios_contidos: number;
    incendios_resolvidos: number;
    alertas_nao_lidos: number;
    brigadas_disponiveis: number;
    brigadas_em_campo: number;
    temperatura_media: number;
    umidade_media: number;
}

export interface DashboardDados {
    incendios: {
        total: number;
        ativos: number;
        contidos: number;
        resolvidos: number;
    };
    alertas: {
        total: number;
        nao_entregues: number;
    };
    ultimo_registro: string | null;
    incendios_recentes: IncendioRecente[];
    alertas_recentes: AlertaRecente[];
    clima: ClimaDashboard | null;
}
