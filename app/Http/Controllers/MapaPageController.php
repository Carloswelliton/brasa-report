<?php

namespace App\Http\Controllers;

use App\Enums\FuncaoUsuario;
use App\Models\Incendio;
use App\Models\Usuario;
use App\Services\OpenMeteo\OpenMeteoCurrentWeatherService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class MapaPageController extends Controller
{
    public function __construct(
        private readonly OpenMeteoCurrentWeatherService $openMeteoCurrentWeather,
    ) {}

    public function __invoke(Request $request): Response
    {
        $query = Incendio::query()->with(['area', 'localCritico']);

        if ($request->filled('status')) {
            $statuses = explode(',', $request->string('status')->value());
            $query->whereIn('status', $statuses);
        }

        $incendios = $query
            ->orderByDesc('detectado_em')
            ->get()
            ->map(fn (Incendio $i): array => [
                'id' => $i->id,
                'latitude' => (float) $i->latitude,
                'longitude' => (float) $i->longitude,
                'status' => $i->status->value,
                'nivel_risco' => $i->nivel_risco->value,
                'detectado_em' => $i->detectado_em?->toIso8601String(),
                'area_nome' => $i->area?->nome ?? '—',
                'local_critico_nome' => $i->localCritico?->nome,
            ]);

        $condicoesClimaticas = $this->openMeteoCurrentWeather->obterAtual();

        /** @var Usuario $auth */
        $auth = $request->user();

        $podeGerenciar = in_array($auth->funcao, [
            FuncaoUsuario::Gestor,
            FuncaoUsuario::Administrador,
        ], true);

        return Inertia::render('mapa', [
            'incendios' => $incendios,
            'condicoesClimaticas' => $condicoesClimaticas,
            'podeGerenciar' => $podeGerenciar,
        ]);
    }
}
