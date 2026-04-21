<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Tenant extends Model
{
    public const STATUS_ACTIVE = 'active';

    public const STATUS_SUSPENDED = 'suspended';

    protected $fillable = [
        'name',
        'slug',
        'ui_settings',
        'status',
        'suspended_reason',
        'last_active_at',
        'company_email',
        'company_phone',
        'company_fax',
        'company_website',
        'company_address_line',
        'company_country',
        'company_state',
        'company_city',
        'company_postal_code',
    ];

    protected function casts(): array
    {
        return [
            'ui_settings' => 'array',
            'last_active_at' => 'datetime',
        ];
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    public function roles(): HasMany
    {
        return $this->hasMany(Role::class);
    }

    public function subscriptions(): HasMany
    {
        return $this->hasMany(TenantSubscription::class);
    }
}
