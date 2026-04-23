<?php

namespace App\Services\Tenants;

use App\Mail\TillFlowPasswordSetupMail;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class TenantUserInvitationService
{
    /**
     * Create a tenant user, assign roles, and send the password-setup email.
     *
     * @param  list<int>  $requestedRoleIds
     *
     * @throws ValidationException
     */
    public function invite(Tenant $tenant, string $name, string $email, array $requestedRoleIds): User
    {
        $email = trim($email);
        if ($email === '') {
            throw ValidationException::withMessages([
                'email' => ['A valid email is required to send an invitation.'],
            ]);
        }

        if (User::query()->where('email', $email)->exists()) {
            throw ValidationException::withMessages([
                'email' => ['This email is already registered.'],
            ]);
        }

        $roleIds = $this->resolveTenantRoleIds($tenant, $requestedRoleIds);

        return DB::transaction(function () use ($tenant, $name, $email, $roleIds): User {
            $user = User::query()->create([
                'tenant_id' => $tenant->id,
                'name' => $name,
                'email' => $email,
                'password' => Str::password(64),
            ]);

            $this->syncRolesForUserOrFail($user, $tenant, $roleIds);

            $user->load('roles:id,slug,name,tenant_id');

            try {
                $plainToken = Password::broker()->createToken($user);
                $actionUrl = $this->tillflowPasswordSetupUrl($user->email, $plainToken);
                Mail::to($user->email)->send(new TillFlowPasswordSetupMail($user, $tenant, $actionUrl, 'invite'));
            } catch (\Throwable $e) {
                report($e);
                $user->tokens()->delete();
                $user->delete();

                throw ValidationException::withMessages([
                    'email' => ['Could not send the invitation email. Check mail configuration and try again.'],
                ]);
            }

            return $user;
        });
    }

    /**
     * Assign tenant roles (e.g. after creating a user with a known password).
     *
     * @param  list<int>  $requestedRoleIds
     */
    public function assignRolesToUser(User $user, Tenant $tenant, array $requestedRoleIds): void
    {
        $roleIds = $this->resolveTenantRoleIds($tenant, $requestedRoleIds);
        $this->syncRolesForUserOrFail($user, $tenant, $roleIds);
    }

    /**
     * @param  list<int>  $requestedRoleIds
     * @return list<int>
     */
    private function resolveTenantRoleIds(Tenant $tenant, array $requestedRoleIds): array
    {
        $requestedRoleIds = array_values(array_unique(array_map('intval', $requestedRoleIds)));

        $roleIds = Role::query()
            ->where('tenant_id', $tenant->id)
            ->whereIn('id', $requestedRoleIds)
            ->pluck('id')
            ->all();

        if (count($roleIds) !== count($requestedRoleIds)) {
            throw ValidationException::withMessages([
                'role_ids' => ['One or more roles are invalid for this tenant.'],
            ]);
        }

        return $roleIds;
    }

    /**
     * @param  list<int>  $roleIds
     */
    private function syncRolesForUserOrFail(User $user, Tenant $tenant, array $roleIds): void
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
                    throw ValidationException::withMessages([
                        'role_ids' => ['Cannot remove the last admin for this tenant.'],
                    ]);
                }
            }
        }

        $user->roles()->sync($roleIds);
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
}
