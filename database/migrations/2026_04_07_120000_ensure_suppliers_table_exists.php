<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Repairs environments where `2026_04_03_210000_create_suppliers_table` is recorded in `migrations`
 * but the `suppliers` table was never created (e.g. different database, failed run, restored dump).
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('suppliers')) {
            return;
        }

        Schema::create('suppliers', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('code', 32);
            $table->string('name');
            $table->string('email')->nullable();
            $table->string('phone', 64);
            $table->string('location')->nullable();
            $table->string('status', 16);
            $table->string('avatar_url', 2048)->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['tenant_id', 'code']);
            $table->index(['tenant_id', 'name']);
        });

        $driver = Schema::getConnection()->getDriverName();
        if ($driver === 'mysql' || $driver === 'mariadb') {
            DB::statement('CREATE UNIQUE INDEX suppliers_tenant_id_email_unique ON suppliers (tenant_id, email(191))');
            DB::statement('CREATE UNIQUE INDEX suppliers_tenant_id_phone_unique ON suppliers (tenant_id, phone)');
        } else {
            Schema::table('suppliers', function (Blueprint $table): void {
                $table->unique(['tenant_id', 'email']);
                $table->unique(['tenant_id', 'phone']);
            });
        }
    }

    public function down(): void
    {
        // No-op: table may have existed before this repair migration.
    }
};
