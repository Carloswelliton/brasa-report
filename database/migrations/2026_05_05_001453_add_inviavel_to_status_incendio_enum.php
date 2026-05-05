<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TYPE status_incendio ADD VALUE IF NOT EXISTS 'inviavel'");
    }

    public function down(): void
    {
        // PostgreSQL não suporta remoção de valores de enum nativamente.
    }
};
