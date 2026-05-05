<?php

use App\Enums\NivelRiscoIncendio;
use App\Enums\StatusIncendio;
use App\Models\Alerta;
use App\Models\AreaMonitorada;
use App\Models\DespachoBrigada;
use App\Models\Incendio;
use App\Models\LogAuditoria;
use App\Models\Usuario;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

function incendioAuthHeaders(?Usuario $usuario = null): array
{
    $usuario ??= Usuario::factory()->administrador()->create();

    return [
        'Authorization' => 'Bearer '.$usuario->createToken('test')->plainTextToken,
        'Accept' => 'application/json',
    ];
}

test('test_lista_incendios_paginados', function () {
    Incendio::factory()->count(25)->create();

    $response = $this->getJson('/api/incendios', incendioAuthHeaders());

    $response->assertOk()
        ->assertJsonPath('meta.per_page', 20)
        ->assertJsonPath('meta.total', 25);
});

test('test_filtra_por_status', function () {
    Incendio::factory()->create(['status' => StatusIncendio::Ativo]);
    Incendio::factory()->create(['status' => StatusIncendio::Resolvido]);

    $response = $this->getJson('/api/incendios?status=ativo', incendioAuthHeaders());

    $response->assertOk();
    expect($response->json('data'))->toHaveCount(1)
        ->and($response->json('data.0.status'))->toBe('ativo');
});

test('test_filtra_por_nivel_risco', function () {
    Incendio::factory()->create(['nivel_risco' => NivelRiscoIncendio::Alto]);
    Incendio::factory()->create(['nivel_risco' => NivelRiscoIncendio::Baixo]);

    $response = $this->getJson('/api/incendios?nivel_risco=alto', incendioAuthHeaders());

    $response->assertOk();
    expect($response->json('data'))->toHaveCount(1)
        ->and($response->json('data.0.nivel_risco'))->toBe('alto');
});

test('test_filtra_por_area', function () {
    $areaA = AreaMonitorada::factory()->create();
    $areaB = AreaMonitorada::factory()->create();
    Incendio::factory()->create(['area_id' => $areaA->id]);
    Incendio::factory()->create(['area_id' => $areaB->id]);

    $response = $this->getJson('/api/incendios?area_id='.$areaA->id, incendioAuthHeaders());

    $response->assertOk();
    expect($response->json('data'))->toHaveCount(1)
        ->and($response->json('data.0.area_id'))->toBe($areaA->id);
});

test('test_filtra_por_intervalo_de_data', function () {
    Incendio::factory()->create(['detectado_em' => '2024-06-15 12:00:00']);
    Incendio::factory()->create(['detectado_em' => '2025-06-15 12:00:00']);

    $response = $this->getJson('/api/incendios?de=2024-01-01&ate=2024-12-31', incendioAuthHeaders());

    $response->assertOk();
    expect($response->json('data'))->toHaveCount(1);
});

test('test_index_requer_autenticacao', function () {
    $this->getJson('/api/incendios')->assertUnauthorized();
});

test('test_retorna_incendio_com_relacionamentos', function () {
    $incendio = Incendio::factory()->create();

    $response = $this->getJson('/api/incendios/'.$incendio->id, incendioAuthHeaders());

    $response->assertOk()
        ->assertJsonPath('data.id', $incendio->id)
        ->assertJsonStructure([
            'data' => [
                'usuario' => ['id', 'nome', 'email', 'funcao'],
            ],
        ]);
});

test('test_retorna_404_para_incendio_inexistente', function () {
    $id = (string) Str::uuid();

    $this->getJson('/api/incendios/'.$id, incendioAuthHeaders())
        ->assertNotFound();
});

test('test_registra_incendio_com_dados_validos', function () {
    $usuario = Usuario::factory()->brigadista()->create();
    $area = AreaMonitorada::factory()->create();

    $response = $this->postJson('/api/incendios', [
        'latitude' => -16.5,
        'longitude' => -56.75,
        'detectado_em' => '2024-03-10T14:00:00Z',
        'nivel_risco' => 'medio',
        'area_id' => $area->id,
    ], incendioAuthHeaders($usuario));

    $response->assertCreated()
        ->assertJsonPath('data.latitude', '-16.5000000')
        ->assertJsonPath('data.nivel_risco', 'medio')
        ->assertJsonPath('data.status', 'ativo');

    expect(Alerta::query()->count())->toBe(1);
});

test('test_usuario_id_preenchido_automaticamente', function () {
    $autenticado = Usuario::factory()->brigadista()->create();
    $outro = Usuario::factory()->create();
    $area = AreaMonitorada::factory()->create();

    $response = $this->postJson('/api/incendios', [
        'latitude' => -16.5,
        'longitude' => -56.75,
        'detectado_em' => '2024-03-10T14:00:00Z',
        'nivel_risco' => 'alto',
        'area_id' => $area->id,
        'usuario_id' => $outro->id,
    ], incendioAuthHeaders($autenticado));

    $response->assertCreated()
        ->assertJsonPath('data.usuario_id', $autenticado->id);
});

test('test_status_inicial_sempre_ativo', function () {
    $usuario = Usuario::factory()->brigadista()->create();
    $area = AreaMonitorada::factory()->create();

    $response = $this->postJson('/api/incendios', [
        'latitude' => -16.5,
        'longitude' => -56.75,
        'detectado_em' => '2024-03-10T14:00:00Z',
        'nivel_risco' => 'alto',
        'area_id' => $area->id,
        'status' => 'resolvido',
    ], incendioAuthHeaders($usuario));

    $response->assertCreated()
        ->assertJsonPath('data.status', 'ativo');
});

test('test_registra_incendio_sem_area_id', function () {
    $usuario = Usuario::factory()->brigadista()->create();

    $this->postJson('/api/incendios', [
        'latitude' => -16.5,
        'longitude' => -56.75,
        'detectado_em' => '2024-03-10T14:00:00Z',
        'nivel_risco' => 'alto',
    ], incendioAuthHeaders($usuario))
        ->assertCreated()
        ->assertJsonPath('data.area_id', null);
});

test('test_retorna_422_com_area_inexistente', function () {
    $usuario = Usuario::factory()->brigadista()->create();
    $areaId = (string) Str::uuid();

    $this->postJson('/api/incendios', [
        'latitude' => -16.5,
        'longitude' => -56.75,
        'detectado_em' => '2024-03-10T14:00:00Z',
        'nivel_risco' => 'alto',
        'area_id' => $areaId,
    ], incendioAuthHeaders($usuario))
        ->assertUnprocessable();
});

test('test_registra_log_de_auditoria_no_registro', function () {
    $usuario = Usuario::factory()->brigadista()->create();
    $area = AreaMonitorada::factory()->create();

    $response = $this->postJson('/api/incendios', [
        'latitude' => -16.5,
        'longitude' => -56.75,
        'detectado_em' => '2024-03-10T14:00:00Z',
        'nivel_risco' => 'alto',
        'area_id' => $area->id,
    ], incendioAuthHeaders($usuario));

    $id = $response->json('data.id');

    $log = LogAuditoria::query()
        ->where('acao', 'registro_incendio')
        ->where('entidade_tipo', 'incendios')
        ->where('entidade_id', $id)
        ->first();

    expect($log)->not->toBeNull()
        ->and($log->usuario_id)->toBe($usuario->id);
});

test('test_atualiza_dados_do_incendio', function () {
    $incendio = Incendio::factory()->create([
        'latitude' => -10.0,
        'longitude' => -50.0,
        'nivel_risco' => NivelRiscoIncendio::Baixo,
    ]);

    $this->putJson('/api/incendios/'.$incendio->id, [
        'latitude' => -16.5,
        'longitude' => -56.75,
        'nivel_risco' => 'alto',
    ], incendioAuthHeaders())
        ->assertOk()
        ->assertJsonPath('data.latitude', '-16.5000000')
        ->assertJsonPath('data.nivel_risco', 'alto');
});

test('test_update_nao_altera_status', function () {
    $incendio = Incendio::factory()->create([
        'status' => StatusIncendio::Ativo,
    ]);

    $this->putJson('/api/incendios/'.$incendio->id, [
        'latitude' => -16.5,
        'status' => 'resolvido',
    ], incendioAuthHeaders())
        ->assertOk();

    expect($incendio->fresh()->status)->toBe(StatusIncendio::Ativo);
});

test('test_update_nao_altera_usuario_id', function () {
    $dono = Usuario::factory()->create();
    $outro = Usuario::factory()->create();
    $incendio = Incendio::factory()->create(['usuario_id' => $dono->id]);

    $this->putJson('/api/incendios/'.$incendio->id, [
        'latitude' => -16.5,
        'usuario_id' => $outro->id,
    ], incendioAuthHeaders())
        ->assertOk();

    expect($incendio->fresh()->usuario_id)->toBe($dono->id);
});

test('test_update_retorna_404_para_incendio_inexistente', function () {
    $id = (string) Str::uuid();

    $this->putJson('/api/incendios/'.$id, [
        'latitude' => -16.5,
    ], incendioAuthHeaders())
        ->assertNotFound();
});

test('test_atualiza_status_do_incendio', function () {
    $incendio = Incendio::factory()->create(['status' => StatusIncendio::Ativo]);

    $this->patchJson('/api/incendios/'.$incendio->id.'/status', [
        'status' => 'em_combate',
    ], incendioAuthHeaders())
        ->assertOk()
        ->assertJsonPath('data.status', 'em_combate');

    expect($incendio->fresh()->status)->toBe(StatusIncendio::EmCombate);
});

test('test_registra_status_anterior_e_novo_no_log', function () {
    $autor = Usuario::factory()->gestor()->create();
    $incendio = Incendio::factory()->create(['status' => StatusIncendio::Ativo]);

    $this->patchJson('/api/incendios/'.$incendio->id.'/status', [
        'status' => 'em_combate',
    ], incendioAuthHeaders($autor))
        ->assertOk();

    $log = LogAuditoria::query()
        ->where('acao', 'atualizacao_status_incendio')
        ->where('entidade_tipo', 'incendios')
        ->where('entidade_id', $incendio->id)
        ->first();

    expect($log)->not->toBeNull()
        ->and($log->dados_json)->toHaveKeys(['status_anterior', 'status_novo'])
        ->and($log->dados_json['status_anterior'])->toBe('ativo')
        ->and($log->dados_json['status_novo'])->toBe('em_combate')
        ->and($log->usuario_id)->toBe($autor->id);
});

test('test_retorna_422_com_status_invalido', function () {
    $incendio = Incendio::factory()->create();

    $this->patchJson('/api/incendios/'.$incendio->id.'/status', [
        'status' => 'invalido',
    ], incendioAuthHeaders())
        ->assertUnprocessable();
});

test('test_fluxo_linear_completo_de_status', function () {
    $incendio = Incendio::factory()->create(['status' => StatusIncendio::Ativo]);
    $headers = incendioAuthHeaders();

    $this->patchJson('/api/incendios/'.$incendio->id.'/status', [
        'status' => 'em_combate',
    ], $headers)->assertOk();

    $this->patchJson('/api/incendios/'.$incendio->id.'/status', [
        'status' => 'contido',
    ], $headers)->assertOk();

    $this->patchJson('/api/incendios/'.$incendio->id.'/status', [
        'status' => 'resolvido',
    ], $headers)->assertOk();

    expect($incendio->fresh()->status)->toBe(StatusIncendio::Resolvido);
});

test('permite_transicao_livre_entre_status', function () {
    $incendio = Incendio::factory()->create(['status' => StatusIncendio::Ativo]);

    $this->patchJson('/api/incendios/'.$incendio->id.'/status', [
        'status' => 'contido',
    ], incendioAuthHeaders())
        ->assertOk();

    expect($incendio->fresh()->status)->toBe(StatusIncendio::Contido);
});

test('permite_retrocesso_de_status', function () {
    $incendio = Incendio::factory()->create(['status' => StatusIncendio::EmCombate]);

    $this->patchJson('/api/incendios/'.$incendio->id.'/status', [
        'status' => 'ativo',
    ], incendioAuthHeaders())
        ->assertOk();

    expect($incendio->fresh()->status)->toBe(StatusIncendio::Ativo);
});

test('rejeita_inviavel_sem_observacao', function () {
    $incendio = Incendio::factory()->create(['status' => StatusIncendio::Ativo]);

    $this->patchJson('/api/incendios/'.$incendio->id.'/status', [
        'status' => 'inviavel',
    ], incendioAuthHeaders())
        ->assertUnprocessable();

    expect($incendio->fresh()->status)->toBe(StatusIncendio::Ativo);
});

test('aceita_inviavel_com_observacao', function () {
    $incendio = Incendio::factory()->create(['status' => StatusIncendio::Ativo]);

    $this->patchJson('/api/incendios/'.$incendio->id.'/status', [
        'status' => 'inviavel',
        'observacao' => 'Incêndio em morraria — acesso impossível.',
    ], incendioAuthHeaders())
        ->assertOk();

    expect($incendio->fresh()->status)->toBe(StatusIncendio::Inviavel);
});

test('test_brigadista_nao_pode_atualizar_status', function () {
    $brigadista = Usuario::factory()->brigadista()->create();
    $incendio = Incendio::factory()->create(['status' => StatusIncendio::Ativo]);

    $this->patchJson('/api/incendios/'.$incendio->id.'/status', [
        'status' => 'em_combate',
    ], incendioAuthHeaders($brigadista))
        ->assertForbidden();
});

test('test_atualiza_nivel_de_risco', function () {
    $incendio = Incendio::factory()->create(['nivel_risco' => NivelRiscoIncendio::Alto]);

    $this->patchJson('/api/incendios/'.$incendio->id.'/risco', [
        'nivel_risco' => 'baixo',
    ], incendioAuthHeaders())
        ->assertOk()
        ->assertJsonPath('data.nivel_risco', 'baixo');

    expect($incendio->fresh()->nivel_risco)->toBe(NivelRiscoIncendio::Baixo);
});

test('test_registra_risco_anterior_e_novo_no_log', function () {
    $autor = Usuario::factory()->gestor()->create();
    $incendio = Incendio::factory()->create(['nivel_risco' => NivelRiscoIncendio::Medio]);

    $this->patchJson('/api/incendios/'.$incendio->id.'/risco', [
        'nivel_risco' => 'alto',
    ], incendioAuthHeaders($autor))
        ->assertOk();

    $log = LogAuditoria::query()
        ->where('acao', 'atualizacao_risco_incendio')
        ->where('entidade_tipo', 'incendios')
        ->where('entidade_id', $incendio->id)
        ->first();

    expect($log)->not->toBeNull()
        ->and($log->dados_json)->toHaveKeys(['nivel_risco_anterior', 'nivel_risco_novo'])
        ->and($log->dados_json['nivel_risco_anterior'])->toBe('medio')
        ->and($log->dados_json['nivel_risco_novo'])->toBe('alto')
        ->and($log->usuario_id)->toBe($autor->id);
});

test('test_retorna_422_com_risco_invalido', function () {
    $incendio = Incendio::factory()->create();

    $this->patchJson('/api/incendios/'.$incendio->id.'/risco', [
        'nivel_risco' => 'critico',
    ], incendioAuthHeaders())
        ->assertUnprocessable();
});

test('test_incendio_historico_retorna_estrutura_para_brigadista', function () {
    $brigadista = Usuario::factory()->brigadista()->create();
    $incendio = Incendio::factory()->create();

    $this->getJson('/api/incendios/'.$incendio->id.'/historico', incendioAuthHeaders($brigadista))
        ->assertOk()
        ->assertJsonStructure([
            'registro' => ['detectado_em', 'registrado_por', 'area_nome'],
            'metricas' => ['primeira_chegada_em', 'horas_brigadas_no_local', 'horas_em_combate'],
            'eventos',
        ]);
});

test('test_incendio_historico_negado_para_usuario_comum', function () {
    $usuario = Usuario::factory()->create();
    $incendio = Incendio::factory()->create();

    $this->getJson('/api/incendios/'.$incendio->id.'/historico', incendioAuthHeaders($usuario))
        ->assertForbidden();
});

test('test_incendio_historico_requer_autenticacao', function () {
    $incendio = Incendio::factory()->create();

    $this->getJson('/api/incendios/'.$incendio->id.'/historico')
        ->assertUnauthorized();
});

test('gestor_remove_incendio_sem_despacho_aberto', function () {
    $gestor = Usuario::factory()->gestor()->create();
    $incendio = Incendio::factory()->create();

    $this->deleteJson('/api/incendios/'.$incendio->id, [], incendioAuthHeaders($gestor))
        ->assertNoContent();

    $this->assertSoftDeleted('incendios', ['id' => $incendio->id]);
});

test('remove_incendio_retorna_409_com_despacho_aberto', function () {
    $gestor = Usuario::factory()->gestor()->create();
    $incendio = Incendio::factory()->create();
    DespachoBrigada::factory()->create([
        'incendio_id' => $incendio->id,
        'finalizado_em' => null,
    ]);

    $this->deleteJson('/api/incendios/'.$incendio->id, [], incendioAuthHeaders($gestor))
        ->assertStatus(409)
        ->assertJsonStructure(['message']);

    expect(Incendio::find($incendio->id))->not->toBeNull();
});

test('gestor_restaura_incendio_excluido', function () {
    $gestor = Usuario::factory()->gestor()->create();
    $incendio = Incendio::factory()->create();
    $incendio->delete();

    $this->postJson('/api/incendios/'.$incendio->id.'/restore', [], incendioAuthHeaders($gestor))
        ->assertOk()
        ->assertJsonPath('data.id', $incendio->id);

    expect(Incendio::find($incendio->id))->not->toBeNull();
});

test('brigadista_nao_pode_remover_incendio', function () {
    $brigadista = Usuario::factory()->brigadista()->create();
    $incendio = Incendio::factory()->create();

    $this->deleteJson('/api/incendios/'.$incendio->id, [], incendioAuthHeaders($brigadista))
        ->assertForbidden();
});

test('restore_incendio_retorna_404_se_nao_estiver_excluido', function () {
    $gestor = Usuario::factory()->gestor()->create();
    $incendio = Incendio::factory()->create();

    $this->postJson('/api/incendios/'.$incendio->id.'/restore', [], incendioAuthHeaders($gestor))
        ->assertNotFound();
});

test('usuario_com_funcao_user_pode_listar_incendios_no_index', function () {
    $usuario = Usuario::factory()->verified()->create();
    Incendio::factory()->count(2)->create();

    $response = $this->getJson('/api/incendios', incendioAuthHeaders($usuario));

    $response->assertOk()
        ->assertJsonPath('meta.total', 2);
});

test('usuario_com_funcao_user_nao_pode_ver_detalhe_incendio', function () {
    $usuario = Usuario::factory()->verified()->create();
    $incendio = Incendio::factory()->create();

    $this->getJson('/api/incendios/'.$incendio->id, incendioAuthHeaders($usuario))
        ->assertForbidden();
});

test('test_detectado_de_filtra_incendios_posteriores', function () {
    Incendio::factory()->create(['detectado_em' => '2019-06-15 12:00:00']);
    $recente = Incendio::factory()->create(['detectado_em' => '2025-06-15 12:00:00']);

    $response = $this->getJson(
        '/api/incendios?detectado_de='.rawurlencode('2024-01-01T00:00:00Z'),
        incendioAuthHeaders(),
    );

    $response->assertOk();
    expect($response->json('data'))->toHaveCount(1)
        ->and($response->json('data.0.id'))->toBe($recente->id);
});

test('test_detectado_de_invalido_retorna_422', function () {
    $this->getJson('/api/incendios?detectado_de=invalido', incendioAuthHeaders())
        ->assertUnprocessable();
});
