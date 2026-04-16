<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('store_managers', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('code', 32);
            $table->string('store_name');
            $table->string('username', 64);
            $table->string('password');
            $table->string('email')->nullable();
            $table->string('phone', 64);
            $table->string('location')->nullable();
            $table->string('status', 16);
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['tenant_id', 'code']);
            $table->unique(['tenant_id', 'username']);
            $table->index(['tenant_id', 'store_name']);
        });

        $driver = Schema::getConnection()->getDriverName();
        if ($driver === 'mysql' || $driver === 'mariadb') {
            DB::statement('CREATE UNIQUE INDEX store_managers_tenant_id_email_unique ON store_managers (tenant_id, email(191))');
            DB::statement('CREATE UNIQUE INDEX store_managers_tenant_id_phone_unique ON store_managers (tenant_id, phone)');
        } else {
            Schema::table('store_managers', function (Blueprint $table): void {
                $table->unique(['tenant_id', 'email']);
                $table->unique(['tenant_id', 'phone']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('store_managers');
    }
};
