<?php

/**
 * TillFlow — inventory locations only (no email/phone/status on this table).
 *
 * Run: php artisan migrate
 *
 * To recreate in dev: rollback this migration, or drop `stores` and remove its row
 * from the `migrations` table, then migrate again (backup first).
 *
 * Assign `code` in application code (e.g. ST-001 per tenant), not from the client.
 */

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('stores', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id');
            $table->string('code', 32);
            $table->string('name');
            $table->string('location')->nullable();
            $table->timestamps();

            $table->unique(['tenant_id', 'code']);
            $table->index('tenant_id');

            // If you have a `tenants` table, uncomment:
            // $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stores');
    }
};
