<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('backup_events', function (Blueprint $table) {
            $table->id();
            $table->string('kind', 48);
            $table->string('status', 24)->default('success');
            $table->string('disk_name')->nullable();
            $table->string('path', 2048)->nullable();
            $table->unsignedBigInteger('size_bytes')->nullable();
            $table->text('message')->nullable();
            $table->foreignId('tenant_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamps();

            $table->index(['kind', 'created_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('backup_events');
    }
};
