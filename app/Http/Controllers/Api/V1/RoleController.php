<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Permission;
use App\Models\Role;
use App\Models\Tenant;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class RoleController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');

        $roles = Role::query()
            ->where('tenant_id', $tenant->id)
            ->with('permissions:id,slug,name')
            ->orderBy('name')
            ->get();

        return response()->json([
            'success' => true,
            'message' => 'Roles retrieved.',
            'data' => ['roles' => $roles],
        ]);
    }

    public function update(Request $request, Role $role): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');

        if ((int) $role->tenant_id !== (int) $tenant->id) {
            abort(404);
        }

        $data = $request->validate([
            'permission_ids' => ['required', 'array'],
            'permission_ids.*' => ['integer', Rule::exists('permissions', 'id')],
        ]);

        $ids = Permission::query()
            ->whereIn('id', $data['permission_ids'])
            ->pluck('id')
            ->all();

        $role->permissions()->sync($ids);

        $role->load('permissions:id,slug,name');

        return response()->json([
            'success' => true,
            'message' => 'Role updated.',
            'data' => ['role' => $role],
        ]);
    }
}
