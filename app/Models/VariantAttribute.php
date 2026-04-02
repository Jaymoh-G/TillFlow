<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class VariantAttribute extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'tenant_id',
        'name',
        'values',
        'is_active',
    ];

    protected $casts = [
        'values' => 'array',
        'is_active' => 'boolean',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }
}

