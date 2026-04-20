<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Plan extends Model
{
    protected $fillable = [
        'name',
        'slug',
        'price_amount',
        'currency',
        'billing_interval',
        'allowed_permission_slugs',
        'features',
        'included_stores',
        'max_stores',
        'extra_store_price_amount',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'allowed_permission_slugs' => 'array',
            'features' => 'array',
            'price_amount' => 'decimal:2',
            'extra_store_price_amount' => 'decimal:2',
            'is_active' => 'boolean',
            'included_stores' => 'integer',
            'max_stores' => 'integer',
        ];
    }

    public function subscriptions(): HasMany
    {
        return $this->hasMany(TenantSubscription::class);
    }
}
