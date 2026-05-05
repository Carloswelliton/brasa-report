<?php

namespace App\Http\Requests\Incendio;

use App\Enums\StatusIncendio;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class AtualizarStatusRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $statusNovoValor = $this->input('status');

        return [
            'status' => ['required', 'string', Rule::enum(StatusIncendio::class)],
            'observacao' => [
                $statusNovoValor === StatusIncendio::Inviavel->value ? 'required' : 'nullable',
                'string',
                'max:1000',
            ],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'observacao.required' => 'Uma observação é obrigatória ao declarar um incêndio como inviável.',
        ];
    }
}
