<?php

namespace App\Enums;

enum StatusIncendio: string
{
    case Ativo = 'ativo';
    case EmCombate = 'em_combate';
    case Contido = 'contido';
    case Resolvido = 'resolvido';
    case Inviavel = 'inviavel';
}
