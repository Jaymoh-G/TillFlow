<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('users')) {
            return;
        }

        Schema::table('users', function (Blueprint $table): void {
            if (! Schema::hasColumn('users', 'phone')) {
                $table->string('phone')->nullable()->after('email');
            }
            if (! Schema::hasColumn('users', 'address_line')) {
                $table->string('address_line')->nullable();
            }
            if (! Schema::hasColumn('users', 'location')) {
                $table->string('location')->nullable();
            }
        });
    }

    public function down(): void
    {
        // Additive columns — leave in place on rollback to avoid data loss.
    }
};
