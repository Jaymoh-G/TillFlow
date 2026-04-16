<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('billers', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('code', 32);
            $table->string('name');
            $table->string('company');
            $table->string('email')->nullable();
            $table->string('phone', 64);
            $table->string('location')->nullable();
            $table->string('status', 16);
            $table->string('avatar_url', 2048)->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['tenant_id', 'code']);
            $table->index(['tenant_id', 'name']);
            $table->index(['tenant_id', 'company']);
        });

        $driver = Schema::getConnection()->getDriverName();
        if ($driver === 'mysql' || $driver === 'mariadb') {
            DB::statement('CREATE UNIQUE INDEX billers_tenant_id_email_unique ON billers (tenant_id, email(191))');
            DB::statement('CREATE UNIQUE INDEX billers_tenant_id_phone_unique ON billers (tenant_id, phone)');
        } else {
            Schema::table('billers', function (Blueprint $table): void {
                $table->unique(['tenant_id', 'email']);
                $table->unique(['tenant_id', 'phone']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('billers');
    }
};
