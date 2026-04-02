<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('units', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('short_name');
            $table->timestamps();
            $table->softDeletes();

            $table->index(['tenant_id', 'short_name']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('units');
    }
};

