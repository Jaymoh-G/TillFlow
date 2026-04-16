<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->string('phone', 64)->nullable()->after('email');
            $table->text('address_line')->nullable()->after('phone');
            $table->string('country', 32)->nullable()->after('address_line');
            $table->string('state', 64)->nullable()->after('country');
            $table->string('city', 64)->nullable()->after('state');
            $table->string('postal_code', 32)->nullable()->after('city');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->dropColumn([
                'phone',
                'address_line',
                'country',
                'state',
                'city',
                'postal_code',
            ]);
        });
    }
};
