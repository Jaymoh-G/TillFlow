<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('leads', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('code', 32);
            $table->string('name');
            $table->string('email')->nullable();
            $table->string('company')->nullable();
            $table->string('phone', 64);
            $table->string('location')->nullable();
            $table->string('status', 32);
            $table->timestamp('last_contacted_at')->nullable();
            $table->foreignId('converted_customer_id')->nullable()->constrained('customers')->nullOnDelete();
            $table->timestamp('converted_at')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['tenant_id', 'code']);
            $table->index(['tenant_id', 'status']);
            $table->index(['tenant_id', 'name']);
        });

        $driver = Schema::getConnection()->getDriverName();
        if ($driver === 'mysql' || $driver === 'mariadb') {
            DB::statement('CREATE UNIQUE INDEX leads_tenant_id_email_unique ON leads (tenant_id, email(191))');
        } else {
            Schema::table('leads', function (Blueprint $table): void {
                $table->unique(['tenant_id', 'email']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('leads');
    }
};
