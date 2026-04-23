<?php

namespace App\Services\Tenants;

use App\Models\Role;
use App\Models\Tenant;
use App\Models\TenantContact;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class TenantContactService
{
    public function __construct(
        private readonly TenantUserInvitationService $invitations,
    ) {}

    /**
     * @param  array{
     *   first_name: string,
     *   last_name: string,
     *   position?: string|null,
     *   email?: string|null,
     *   phone?: string|null,
     *   is_primary: bool,
     *   send_password_setup_email?: bool,
     *   password?: string|null,
     *   role_ids?: list<int>|null,
     * }  $payload
     */
    public function createContact(Tenant $tenant, array $payload, ?UploadedFile $avatar = null): TenantContact
    {
        app(TenantRoleProvisioningService::class)->ensureForTenant($tenant);

        return DB::transaction(function () use ($tenant, $payload, $avatar): TenantContact {
            $first = trim($payload['first_name']);
            $last = trim($payload['last_name']);
            $email = $this->normalizeEmail($payload['email'] ?? null);
            $phone = $this->nullableTrim($payload['phone'] ?? null);
            $position = $this->nullableTrim($payload['position'] ?? null);
            $isPrimary = (bool) ($payload['is_primary'] ?? false);

            $sendInvite = filter_var($payload['send_password_setup_email'] ?? false, FILTER_VALIDATE_BOOLEAN);
            $password = isset($payload['password']) && is_string($payload['password']) && $payload['password'] !== ''
                ? $payload['password']
                : null;

            if ($isPrimary && ($email === null || $email === '')) {
                throw ValidationException::withMessages([
                    'email' => ['Primary contacts must have an email address for billing correspondence.'],
                ]);
            }

            $this->assertTenantEmailUnique($tenant, $email);

            $createLogin = $sendInvite || ($password !== null && $password !== '');
            if ($sendInvite && $password !== null && $password !== '') {
                throw ValidationException::withMessages([
                    'password' => ['Remove the password when sending a set-password email, or turn off the email option.'],
                ]);
            }

            if ($createLogin && ($email === null || $email === '')) {
                throw ValidationException::withMessages([
                    'email' => ['Email is required when creating a login or sending an invitation.'],
                ]);
            }

            if ($createLogin && ! $sendInvite && ($password === null || strlen($password) < 8)) {
                throw ValidationException::withMessages([
                    'password' => ['Set a password of at least 8 characters, or choose to send a set-password email instead.'],
                ]);
            }

            $avatarPath = $this->storeAvatar($avatar);

            $contact = TenantContact::query()->create([
                'tenant_id' => $tenant->id,
                'first_name' => $first,
                'last_name' => $last,
                'position' => $position,
                'email' => $email,
                'phone' => $phone,
                'avatar_path' => $avatarPath,
                'is_primary' => false,
                'user_id' => null,
            ]);

            if ($isPrimary) {
                $this->clearPrimaryExcept($tenant, $contact->id);
                $contact->is_primary = true;
                $contact->save();
            }

            $roleIds = $this->resolveRoleIdsForPayload($tenant, $payload['role_ids'] ?? null);

            if ($createLogin) {
                $displayName = trim($first.' '.$last);
                if ($sendInvite) {
                    $user = $this->invitations->invite($tenant, $displayName, $email, $roleIds);
                } else {
                    if (User::query()->where('email', $email)->exists()) {
                        throw ValidationException::withMessages([
                            'email' => ['This email is already registered.'],
                        ]);
                    }
                    $user = User::query()->create([
                        'tenant_id' => $tenant->id,
                        'name' => $displayName,
                        'email' => $email,
                        'password' => $password,
                        'phone' => $phone,
                    ]);
                    $this->invitations->assignRolesToUser($user, $tenant, $roleIds);
                }

                $contact->user_id = $user->id;
                if ($avatarPath !== null && $user->avatar_path === null) {
                    $user->avatar_path = $avatarPath;
                    $user->save();
                }
                $contact->save();
            }

            $this->mirrorTenantBillingFromPrimary($tenant->fresh());

            return $contact->fresh(['user:id,name,email,avatar_path']);
        });
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    public function updateContact(TenantContact $contact, array $payload, ?UploadedFile $avatar = null): TenantContact
    {
        $tenant = $contact->tenant;

        return DB::transaction(function () use ($contact, $tenant, $payload, $avatar): TenantContact {
            if (isset($payload['first_name'])) {
                $contact->first_name = trim((string) $payload['first_name']);
            }
            if (isset($payload['last_name'])) {
                $contact->last_name = trim((string) $payload['last_name']);
            }
            if (array_key_exists('position', $payload)) {
                $contact->position = $this->nullableTrim(is_string($payload['position']) ? $payload['position'] : null);
            }
            if (array_key_exists('phone', $payload)) {
                $contact->phone = $this->nullableTrim(is_string($payload['phone']) ? $payload['phone'] : null);
            }

            if (array_key_exists('email', $payload)) {
                $email = $this->normalizeEmail(is_string($payload['email']) ? $payload['email'] : null);
                if ($email !== $contact->email) {
                    $this->assertTenantEmailUnique($tenant, $email, $contact->id);
                    $contact->email = $email;
                }
            }

            if ($avatar instanceof UploadedFile) {
                $this->deleteStoredAvatarIfOwned($contact->avatar_path);
                $contact->avatar_path = $this->storeAvatar($avatar);
                if ($contact->user_id && $contact->user) {
                    $contact->user->avatar_path = $contact->avatar_path;
                    $contact->user->save();
                }
            }

            if (isset($payload['is_primary']) && filter_var($payload['is_primary'], FILTER_VALIDATE_BOOLEAN)) {
                $this->clearPrimaryExcept($tenant, $contact->id);
                $contact->is_primary = true;
            }

            if ($contact->is_primary && ($contact->email === null || $contact->email === '')) {
                throw ValidationException::withMessages([
                    'email' => ['Primary contacts must have an email address.'],
                ]);
            }

            $contact->save();

            $this->mirrorTenantBillingFromPrimary($tenant->fresh());

            return $contact->fresh(['user:id,name,email,avatar_path']);
        });
    }

    public function deleteContact(TenantContact $contact): void
    {
        DB::transaction(function () use ($contact): void {
            $tenant = $contact->tenant;
            $wasPrimary = $contact->is_primary;
            $this->deleteStoredAvatarIfOwned($contact->avatar_path);
            $contact->delete();
            if ($wasPrimary) {
                $this->mirrorTenantBillingFromPrimary($tenant->fresh());
            }
        });
    }

    /**
     * Sync tenants.company_email / company_phone from primary contact (billing mirror).
     */
    public function mirrorTenantBillingFromPrimary(Tenant $tenant): void
    {
        $primary = TenantContact::query()
            ->where('tenant_id', $tenant->id)
            ->where('is_primary', true)
            ->first();

        if ($primary !== null && $primary->email) {
            $tenant->company_email = $primary->email;
            if ($primary->phone) {
                $tenant->company_phone = $primary->phone;
            }
            $tenant->save();

            return;
        }

        // No primary with email — leave tenant billing columns unchanged (legacy compatibility).
    }

    /**
     * @return list<int>
     */
    private function resolveRoleIdsForPayload(Tenant $tenant, ?array $requested): array
    {
        if ($requested !== null && $requested !== []) {
            $ids = Role::query()
                ->where('tenant_id', $tenant->id)
                ->whereIn('id', array_map('intval', $requested))
                ->pluck('id')
                ->all();
            if (count($ids) !== count(array_unique(array_map('intval', $requested)))) {
                throw ValidationException::withMessages([
                    'role_ids' => ['One or more roles are invalid for this tenant.'],
                ]);
            }

            return array_map('intval', $ids);
        }

        $tenantRole = Role::query()
            ->where('tenant_id', $tenant->id)
            ->where('slug', 'tenant')
            ->first();
        if (! $tenantRole) {
            throw ValidationException::withMessages([
                'role_ids' => ['Default tenant role is missing. Run role provisioning.'],
            ]);
        }

        return [(int) $tenantRole->id];
    }

    private function clearPrimaryExcept(Tenant $tenant, int $exceptContactId): void
    {
        TenantContact::query()
            ->where('tenant_id', $tenant->id)
            ->where('id', '!=', $exceptContactId)
            ->update(['is_primary' => false]);
    }

    private function assertTenantEmailUnique(Tenant $tenant, ?string $email, ?int $ignoreContactId = null): void
    {
        if ($email === null || $email === '') {
            return;
        }

        $q = TenantContact::query()
            ->where('tenant_id', $tenant->id)
            ->where('email', $email);
        if ($ignoreContactId !== null) {
            $q->where('id', '!=', $ignoreContactId);
        }
        if ($q->exists()) {
            throw ValidationException::withMessages([
                'email' => ['This email is already used by another contact for this company.'],
            ]);
        }
    }

    private function normalizeEmail(?string $v): ?string
    {
        if ($v === null) {
            return null;
        }
        $t = strtolower(trim($v));

        return $t === '' ? null : $t;
    }

    private function nullableTrim(?string $v): ?string
    {
        if ($v === null) {
            return null;
        }
        $t = trim($v);

        return $t === '' ? null : $t;
    }

    private function storeAvatar(?UploadedFile $avatar): ?string
    {
        if (! $avatar instanceof UploadedFile || ! $avatar->isValid()) {
            return null;
        }

        $path = $avatar->store('tenant-contacts/avatars', 'public');

        return $path ?: null;
    }

    private function deleteStoredAvatarIfOwned(?string $path): void
    {
        if ($path === null || $path === '') {
            return;
        }
        if (Storage::disk('public')->exists($path)) {
            Storage::disk('public')->delete($path);
        }
    }
}
