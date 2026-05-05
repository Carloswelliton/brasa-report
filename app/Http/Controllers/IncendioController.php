<?php

namespace App\Http\Controllers;

use App\Enums\NivelRiscoIncendio;
use App\Enums\StatusIncendio;
use App\Enums\TipoAlerta;
use App\Http\Requests\Incendio\AtualizarRiscoRequest;
use App\Http\Requests\Incendio\AtualizarStatusRequest;
use App\Http\Requests\Incendio\StoreIncendioRequest;
use App\Http\Requests\Incendio\UpdateIncendioRequest;
use App\Http\Resources\IncendioResource;
use App\Models\Alerta;
use App\Models\DespachoBrigada;
use App\Models\Incendio;
use App\Models\LogAuditoria;
use App\Models\Usuario;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class IncendioController extends Controller
{
    /**
     * Papéis futuros: brigadista, gestor, admin
     */
    public function index(Request $request): JsonResponse
    {
        $query = Incendio::query()
            ->with(['area', 'localCritico', 'deteccaoSatelite']);

        if ($request->filled('status')) {
            $status = $request->string('status')->value();
            $query->where('status', $status);
        }

        if ($request->filled('nivel_risco')) {
            $nivelRisco = $request->string('nivel_risco')->value();
            $query->where('nivel_risco', $nivelRisco);
        }

        if ($request->filled('area_id')) {
            $areaId = $request->string('area_id')->value();
            $query->where('area_id', $areaId);
        }

        if ($request->filled('de')) {
            $de = $request->string('de')->value();
            $query->whereDate('detectado_em', '>=', $de);
        }

        if ($request->filled('ate')) {
            $ate = $request->string('ate')->value();
            $query->whereDate('detectado_em', '<=', $ate);
        }

        if ($request->filled('detectado_de')) {
            $request->validate([
                'detectado_de' => ['required', 'date'],
            ]);
            $detectadoDe = Carbon::parse($request->string('detectado_de')->value());
            $query->where('detectado_em', '>', $detectadoDe);
        }

        $incendios = $query
            ->orderByDesc('detectado_em')
            ->paginate(20);

        return IncendioResource::collection($incendios)->response();
    }

    /**
     * Papéis futuros: brigadista, gestor, admin
     */
    public function show(Incendio $incendio): IncendioResource
    {
        $incendio->load(['area', 'localCritico', 'deteccaoSatelite', 'usuario']);

        return new IncendioResource($incendio);
    }

    /**
     * Papéis futuros: brigadista, gestor, admin
     */
    public function store(StoreIncendioRequest $request): JsonResponse
    {
        /** @var Usuario $usuario */
        $usuario = $request->user();

        $dados = $request->validated();
        $dados['usuario_id'] = $usuario->id;
        $dados['status'] = StatusIncendio::Ativo;

        $incendio = Incendio::query()->create($dados);

        LogAuditoria::query()->create([
            'usuario_id' => $usuario->id,
            'acao' => 'registro_incendio',
            'entidade_tipo' => 'incendios',
            'entidade_id' => $incendio->id,
            'dados_json' => null,
        ]);

        $incendio->load(['area', 'localCritico', 'deteccaoSatelite', 'usuario']);

        $areaNome = $incendio->area?->nome ?? 'Área não informada';
        Alerta::query()->create([
            'tipo' => TipoAlerta::FogoDetectado,
            'mensagem' => "Novo incêndio registrado em {$areaNome}",
            'origem_id' => $incendio->id,
            'origem_tabela' => 'incendios',
            'entregue' => false,
        ]);

        return (new IncendioResource($incendio))
            ->response()
            ->setStatusCode(201);
    }

    /**
     * Papéis futuros: gestor, admin
     */
    public function update(UpdateIncendioRequest $request, Incendio $incendio): IncendioResource
    {
        $incendio->update($request->validated());

        /** @var Usuario $usuario */
        $usuario = $request->user();

        LogAuditoria::query()->create([
            'usuario_id' => $usuario->id,
            'acao' => 'atualizacao_incendio',
            'entidade_tipo' => 'incendios',
            'entidade_id' => $incendio->id,
            'dados_json' => null,
        ]);

        return new IncendioResource($incendio->fresh(['area', 'localCritico', 'deteccaoSatelite', 'usuario']));
    }

    public function destroy(Request $request, Incendio $incendio): JsonResponse|Response
    {
        if (DespachoBrigada::query()
            ->where('incendio_id', $incendio->id)
            ->whereNull('finalizado_em')
            ->exists()) {
            return response()->json([
                'message' => 'Não é possível remover um incêndio com despacho em aberto. Finalize os despachos antes.',
            ], 409);
        }

        /** @var Usuario $usuario */
        $usuario = $request->user();

        LogAuditoria::query()->create([
            'usuario_id' => $usuario->id,
            'acao' => 'remocao_incendio',
            'entidade_tipo' => 'incendios',
            'entidade_id' => $incendio->id,
            'dados_json' => null,
        ]);

        $incendio->delete();

        return response()->noContent();
    }

    public function restore(Request $request, string $id): IncendioResource
    {
        $incendio = Incendio::onlyTrashed()->findOrFail($id);

        /** @var Usuario $usuario */
        $usuario = $request->user();

        LogAuditoria::query()->create([
            'usuario_id' => $usuario->id,
            'acao' => 'restauracao_incendio',
            'entidade_tipo' => 'incendios',
            'entidade_id' => $incendio->id,
            'dados_json' => null,
        ]);

        $incendio->restore();

        return new IncendioResource($incendio->fresh(['area', 'localCritico', 'deteccaoSatelite', 'usuario']));
    }

    /**
     * Papéis futuros: brigadista, gestor, admin
     */
    public function atualizarStatus(AtualizarStatusRequest $request, Incendio $incendio): IncendioResource
    {
        $statusAnterior = $incendio->status;
        $statusNovo = StatusIncendio::from($request->validated('status'));

        $incendio->update([
            'status' => $statusNovo,
        ]);

        /** @var Usuario $usuario */
        $usuario = $request->user();

        LogAuditoria::query()->create([
            'usuario_id' => $usuario->id,
            'acao' => 'atualizacao_status_incendio',
            'entidade_tipo' => 'incendios',
            'entidade_id' => $incendio->id,
            'dados_json' => [
                'status_anterior' => $statusAnterior->value,
                'status_novo' => $statusNovo->value,
                'observacao' => $request->validated('observacao'),
            ],
        ]);

        return new IncendioResource($incendio->fresh(['area', 'localCritico', 'deteccaoSatelite', 'usuario']));
    }

    /**
     * Papéis futuros: gestor, admin
     */
    public function atualizarRisco(AtualizarRiscoRequest $request, Incendio $incendio): IncendioResource
    {
        $riscoAnterior = $incendio->nivel_risco;
        $riscoNovo = NivelRiscoIncendio::from($request->validated('nivel_risco'));

        $incendio->update([
            'nivel_risco' => $riscoNovo,
        ]);

        /** @var Usuario $usuario */
        $usuario = $request->user();

        LogAuditoria::query()->create([
            'usuario_id' => $usuario->id,
            'acao' => 'atualizacao_risco_incendio',
            'entidade_tipo' => 'incendios',
            'entidade_id' => $incendio->id,
            'dados_json' => [
                'nivel_risco_anterior' => $riscoAnterior->value,
                'nivel_risco_novo' => $riscoNovo->value,
            ],
        ]);

        return new IncendioResource($incendio->fresh(['area', 'localCritico', 'deteccaoSatelite', 'usuario']));
    }

    /**
     * Linha do tempo e métricas do incêndio (registro, status, risco, despachos).
     */
    public function historico(Incendio $incendio): JsonResponse
    {
        $incendio->load(['usuario', 'area']);

        $logsIncendio = LogAuditoria::query()
            ->where('entidade_tipo', 'incendios')
            ->where('entidade_id', $incendio->id)
            ->with('usuario')
            ->orderBy('criado_em')
            ->get();

        $despachos = DespachoBrigada::query()
            ->where('incendio_id', $incendio->id)
            ->with('brigada')
            ->orderBy('despachado_em')
            ->get();

        $eventos = [];

        if ($incendio->detectado_em !== null) {
            $eventos[] = [
                'em' => $incendio->detectado_em->toIso8601String(),
                'tipo' => 'registro',
                'rotulo' => 'Incêndio registrado',
                'detalhe' => 'Registrado por '.($incendio->usuario?->nome ?? '—'),
                'usuario_nome' => $incendio->usuario?->nome,
            ];
        }

        foreach ($logsIncendio as $log) {
            if ($log->acao === 'registro_incendio') {
                continue;
            }

            $nomeUsuario = $log->usuario?->nome;
            $dados = $log->dados_json ?? [];

            if ($log->acao === 'atualizacao_status_incendio') {
                $ant = $dados['status_anterior'] ?? '—';
                $novo = $dados['status_novo'] ?? '—';
                $observacao = $dados['observacao'] ?? null;
                $detalhe = "{$ant} → {$novo}";
                if ($observacao) {
                    $detalhe .= " — {$observacao}";
                }
                $eventos[] = [
                    'em' => $log->criado_em?->toIso8601String(),
                    'tipo' => 'mudanca_status',
                    'rotulo' => 'Status do incêndio alterado',
                    'detalhe' => $detalhe,
                    'usuario_nome' => $nomeUsuario,
                ];
            } elseif ($log->acao === 'atualizacao_risco_incendio') {
                $ant = $dados['nivel_risco_anterior'] ?? '—';
                $novo = $dados['nivel_risco_novo'] ?? '—';
                $eventos[] = [
                    'em' => $log->criado_em?->toIso8601String(),
                    'tipo' => 'mudanca_risco',
                    'rotulo' => 'Nível de risco alterado',
                    'detalhe' => "{$ant} → {$novo}",
                    'usuario_nome' => $nomeUsuario,
                ];
            } elseif ($log->acao === 'atualizacao_incendio') {
                $eventos[] = [
                    'em' => $log->criado_em?->toIso8601String(),
                    'tipo' => 'atualizacao',
                    'rotulo' => 'Dados do incêndio atualizados',
                    'detalhe' => null,
                    'usuario_nome' => $nomeUsuario,
                ];
            }
        }

        foreach ($despachos as $d) {
            $nomeBrigada = $d->brigada?->nome ?? '—';

            $eventos[] = [
                'em' => $d->despachado_em?->toIso8601String(),
                'tipo' => 'despacho',
                'rotulo' => 'Brigada despachada',
                'detalhe' => "Brigada {$nomeBrigada} a caminho do local",
                'usuario_nome' => null,
                'brigada_nome' => $nomeBrigada,
            ];

            if ($d->chegada_em !== null) {
                $eventos[] = [
                    'em' => $d->chegada_em->toIso8601String(),
                    'tipo' => 'chegada',
                    'rotulo' => 'Chegada ao local',
                    'detalhe' => "Brigada {$nomeBrigada} chegou ao local",
                    'usuario_nome' => null,
                    'brigada_nome' => $nomeBrigada,
                ];
            }

            if ($d->finalizado_em !== null) {
                $eventos[] = [
                    'em' => $d->finalizado_em->toIso8601String(),
                    'tipo' => 'finalizacao_despacho',
                    'rotulo' => 'Despacho finalizado',
                    'detalhe' => $d->observacoes
                        ? "Brigada {$nomeBrigada} — {$d->observacoes}"
                        : "Brigada {$nomeBrigada} finalizou a operação",
                    'usuario_nome' => null,
                    'brigada_nome' => $nomeBrigada,
                ];
            }
        }

        usort($eventos, function (array $a, array $b): int {
            $ta = $a['em'] ?? '';
            $tb = $b['em'] ?? '';

            return strcmp((string) $ta, (string) $tb);
        });

        $primeiraChegada = $despachos->min('chegada_em');

        $horasBrigadasNoLocal = 0.0;
        foreach ($despachos as $d) {
            if ($d->chegada_em !== null && $d->finalizado_em !== null) {
                $horasBrigadasNoLocal += $d->chegada_em->diffInMinutes($d->finalizado_em) / 60;
            }
        }

        $inicioCombateStatus = null;
        $fimCombateStatus = null;
        foreach ($logsIncendio as $log) {
            if ($log->acao !== 'atualizacao_status_incendio') {
                continue;
            }
            $dados = $log->dados_json ?? [];
            $novo = $dados['status_novo'] ?? null;
            if ($novo === StatusIncendio::EmCombate->value && $inicioCombateStatus === null) {
                $inicioCombateStatus = $log->criado_em;
            }
            if ($novo === StatusIncendio::Contido->value) {
                $fimCombateStatus = $log->criado_em;
            }
        }

        $horasEmCombate = null;
        if ($inicioCombateStatus instanceof Carbon) {
            if ($fimCombateStatus instanceof Carbon) {
                $horasEmCombate = round($inicioCombateStatus->diffInMinutes($fimCombateStatus) / 60, 2);
            } elseif ($incendio->status === StatusIncendio::EmCombate) {
                $horasEmCombate = round($inicioCombateStatus->diffInMinutes(Carbon::now()) / 60, 2);
            }
        }

        return response()->json([
            'registro' => [
                'detectado_em' => $incendio->detectado_em?->toIso8601String(),
                'registrado_por' => $incendio->usuario?->nome,
                'area_nome' => $incendio->area?->nome ?? '—',
            ],
            'metricas' => [
                'primeira_chegada_em' => $primeiraChegada instanceof Carbon ? $primeiraChegada->toIso8601String() : null,
                'horas_brigadas_no_local' => round($horasBrigadasNoLocal, 2),
                'horas_em_combate' => $horasEmCombate,
            ],
            'eventos' => array_values($eventos),
        ]);
    }
}
