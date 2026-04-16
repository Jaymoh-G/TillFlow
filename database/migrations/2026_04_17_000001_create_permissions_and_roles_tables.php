<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('permissions')) {
            Schema::create('permissions', function (Blueprint $table): void {
                $table->id();
                $table->string('slug', 64)->unique();
                $table->string('name');
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('roles')) {
            Schema::create('roles', function (Blueprint $table): void {
                $table->id();
                $table->unsignedBigInteger('tenant_id')->index();
                $table->string('slug', 64);
                $table->string('name');
                $table->timestamps();
                $table->unique(['tenant_id', 'slug']);
            });
        }

        if (! Schema::hasTable('permission_role')) {
            Schema::create('permission_role', function (Blueprint $table): void {
                $table->foreignId('permission_id')->constrained()->cascadeOnDelete();
                $table->foreignId('role_id')->constrained()->cascadeOnDelete();
                $table->primary(['permission_id', 'role_id']);
            });
        }

        if (! Schema::hasTable('role_user')) {
            Schema::create('role_user', function (Blueprint $table): void {
                $table->foreignId('user_id')->constrained()->cascadeOnDelete();
                $table->foreignId('role_id')->constrained()->cascadeOnDelete();
                $table->primary(['user_id', 'role_id']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('role_user');
        Schema::dropIfExists('permission_role');
        Schema::dropIfExists('roles');
        Schema::dropIfExists('permissions');
    }
};
