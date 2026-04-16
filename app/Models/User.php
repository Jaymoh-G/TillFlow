<?php

namespace App\Models;

use Illuminate\Auth\Passwords\CanResetPassword;
use Illuminate\Contracts\Auth\CanResetPassword as CanResetPasswordContract;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable implements CanResetPasswordContract
{
    use CanResetPassword;
    use HasApiTokens;
    use HasFactory;
    use Notifiable;

    protected $fillable = [
        'tenant_id',
        'name',
        'email',
        'password',
        'phone',
        'address_line',
        'location',
        'avatar_path',
        'allowed_store_ids',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'allowed_store_ids' => 'array',
        ];
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function roles(): BelongsToMany
    {
        return $this->belongsToMany(Role::class);
    }

    /**
     * Flattened permission slugs from all roles (current request).
     *
     * @return list<string>
     */
    public function permissionSlugs(): array
    {
        $this->loadMissing('roles.permissions');

        return $this->roles
            ->flatMap(fn (Role $role) => $role->permissions->pluck('slug'))
            ->unique()
            ->values()
            ->all();
    }

    public function hasPermission(string $slug): bool
    {
        $slugs = $this->flattenAssignedPermissionSlugs();

        if ($slugs->contains($slug)) {
            return true;
        }

        // Tenant administrators can manage users and roles (routes use `users.manage`).
        if ($slug === 'users.manage' && $slugs->contains('tenant.manage')) {
            return true;
        }

        if (str_ends_with($slug, '.view')) {
            $manage = substr($slug, 0, -strlen('.view')).'.manage';

            return $slugs->contains($manage);
        }

        return false;
    }

    /**
     * @return \Illuminate\Support\Collection<int, string>
     */
    private function flattenAssignedPermissionSlugs(): \Illuminate\Support\Collection
    {
        $this->loadMissing('roles.permissions');

        return $this->roles
            ->flatMap(fn (Role $role) => $role->permissions->pluck('slug'))
            ->unique();
    }
}
