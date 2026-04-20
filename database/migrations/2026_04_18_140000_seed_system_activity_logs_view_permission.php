<?php

use App\Models\Permission;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Insert the permission row and grant it to every role that already has {@see reports.view}
     * (same audience as reporting / audit-style features).
     */
    public function up(): void
    {
        $activity = Permission::query()->updateOrCreate(
            ['slug' => 'system.activity_logs.view'],
            ['name' => 'View activity logs']
        );

        $reports = Permission::query()->where('slug', 'reports.view')->first();
        if ($reports === null) {
            return;
        }

        $roleIds = DB::table('permission_role')
            ->where('permission_id', $reports->id)
            ->distinct()
            ->pluck('role_id');

        $now = now();
        foreach ($roleIds as $roleId) {
            DB::table('permission_role')->updateOrInsert(
                [
                    'permission_id' => $activity->id,
                    'role_id' => (int) $roleId,
                ],
                [
                    'created_at' => $now,
                    'updated_at' => $now,
                ]
            );
        }
    }

    public function down(): void
    {
        $activity = Permission::query()->where('slug', 'system.activity_logs.view')->first();
        if ($activity === null) {
            return;
        }

        DB::table('permission_role')->where('permission_id', $activity->id)->delete();
        $activity->delete();
    }
};
