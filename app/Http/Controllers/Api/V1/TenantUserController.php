<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Mail\TillFlowPasswordSetupMail;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class TenantUserController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');

        $users = User::query()
            ->where('tenant_id', $tenant->id)
            ->with('roles:id,slug,name,tenant_id')
            ->orderBy('name')
            ->get(['id', 'tenant_id', 'name', 'email']);

        return response()->json([
            'success' => true,
            'message' => 'Users retrieved.',
            'data' => ['users' => $users],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'role_ids' => ['sometimes', 'array'],
            'role_ids.*' => ['integer', Rule::exists('roles', 'id')],
        ]);

        $requestedRoleIds = array_map('intval', $data['role_ids'] ?? []);

        $roleResolution = $this->resolveTenantRoleIds($tenant, $requestedRoleIds);
        if ($roleResolution instanceof JsonResponse) {
            return $roleResolution;
        }

        $user = User::query()->create([
            'tenant_id' => $tenant->id,
            'name' => $data['name'],
            'email' => $data['email'],
            'password' => Str::password(64),
        ]);

        $syncError = $this->syncRolesForUser($user, $tenant, $roleResolution);
        if ($syncError instanceof JsonResponse) {
            $user->delete();

            return $syncError;
        }

        $user->load('roles:id,slug,name,tenant_id');

        try {
            $plainToken = Password::broker()->createToken($user);
            $actionUrl = $this->tillflowPasswordSetupUrl($user->email, $plainToken);
            Mail::to($user->email)->send(new TillFlowPasswordSetupMail($user, $tenant, $actionUrl, 'invite'));
        } catch (\Throwable $e) {
            report($e);
            $user->tokens()->delete();
            $user->delete();

            return response()->json([
                'success' => false,
                'message' => 'Could not send the invitation email. Check mail configuration and try again.',
            ], 422);
        }

        return response()->json([
            'success' => true,
            'message' => 'User invited. An email was sent with a link to set their password.',
            'data' => ['user' => $this->userPayload($user)],
        ], 201);
    }

    public function syncRoles(Request $request, User $user): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');
        if ((int) $user->tenant_id !== (int) $tenant->id) {
            abort(404);
        }

        $data = $request->validate([
            'role_ids' => ['required', 'array'],
            'role_ids.*' => ['integer', Rule::exists('roles', 'id')],
        ]);

        $roleResolution = $this->resolveTenantRoleIds($tenant, $data['role_ids']);
        if ($roleResolution instanceof JsonResponse) {
            return $roleResolution;
        }

        $syncError = $this->syncRolesForUser($user, $tenant, $roleResolution);
        if ($syncError instanceof JsonResponse) {
            return $syncError;
        }

        $user->load('roles:id,slug,name,tenant_id');

        return response()->json([
            'success' => true,
            'message' => 'User roles updated.',
            'data' => ['user' => $this->userPayload($user)],
        ]);
    }

    /**
     * @param  list<int>  $requestedRoleIds
     * @return list<int>|JsonResponse
     */
    private function resolveTenantRoleIds(Tenant $tenant, array $requestedRoleIds): array|JsonResponse
    {
        $requestedRoleIds = array_values(array_unique(array_map('intval', $requestedRoleIds)));

        $roleIds = Role::query()
            ->where('tenant_id', $tenant->id)
            ->whereIn('id', $requestedRoleIds)
            ->pluck('id')
            ->all();

        if (count($roleIds) !== count($requestedRoleIds)) {
            return response()->json([
                'success' => false,
                'message' => 'One or more roles are invalid for this tenant.',
            ], 422);
        }

        return $roleIds;
    }

    /**
     * @param  list<int>  $roleIds
     */
    private function syncRolesForUser(User $user, Tenant $tenant, array $roleIds): ?JsonResponse
    {
        $adminRole = Role::query()
            ->where('tenant_id', $tenant->id)
            ->where('slug', 'admin')
            ->first();

        if ($adminRole) {
            $hadAdmin = $user->exists && $user->roles()->where('roles.id', $adminRole->id)->exists();
            $willHaveAdmin = in_array($adminRole->id, $roleIds, true);
            if ($hadAdmin && ! $willHaveAdmin) {
                $otherAdmins = DB::table('role_user')
                    ->where('role_id', $adminRole->id)
                    ->where('user_id', '!=', $user->id)
                    ->count();
                if ($otherAdmins === 0) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Cannot remove the last admin for this tenant.',
                    ], 422);
                }
            }
        }

        $user->roles()->sync($roleIds);

        return null;
    }

    private function tillflowPasswordSetupUrl(string $email, string $plainToken): string
    {
        $base = (string) config('tillflow.frontend_url');
        $path = '/tillflow/invite/accept';

        return $base.$path.'?'.http_build_query([
            'token' => $plainToken,
            'email' => $email,
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function userPayload(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'roles' => $user->roles->map(fn (Role $r) => [
                'id' => $r->id,
                'slug' => $r->slug,
                'name' => $r->name,
            ])->values(),
        ];
    }
}
