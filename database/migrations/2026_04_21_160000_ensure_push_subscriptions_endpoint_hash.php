<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('push_subscriptions')) {
            return;
        }

        if (! Schema::hasColumn('push_subscriptions', 'endpoint_hash')) {
            Schema::table('push_subscriptions', function (Blueprint $table): void {
                $table->char('endpoint_hash', 64)->nullable()->after('endpoint');
            });
        }

        DB::table('push_subscriptions')
            ->whereNull('endpoint_hash')
            ->update(['endpoint_hash' => DB::raw('SHA2(endpoint, 256)')]);

        $hasUnique = collect(DB::select("SHOW INDEX FROM `push_subscriptions` WHERE `Key_name` = 'push_subscriptions_user_id_endpoint_hash_unique'"))
            ->isNotEmpty();

        if (! $hasUnique) {
            DB::statement('ALTER TABLE `push_subscriptions` ADD UNIQUE `push_subscriptions_user_id_endpoint_hash_unique` (`user_id`, `endpoint_hash`)');
        }
    }

    public function down(): void
    {
        // Keep compatibility data/index; no-op by design.
    }
};

