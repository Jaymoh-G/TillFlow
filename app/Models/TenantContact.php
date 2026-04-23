<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TenantContact extends Model
{
    protected $fillable = [
        'tenant_id',
        'first_name',
        'last_name',
        'position',
        'email',
        'phone',
        'avatar_path',
        'is_primary',
        'user_id',
    ];

    protected function casts(): array
    {
        return [
            'is_primary' => 'boolean',
        ];
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function displayName(): string
    {
        return trim($this->first_name.' '.$this->last_name);
    }
}
