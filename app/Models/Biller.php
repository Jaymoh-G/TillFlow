<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class Biller extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'tenant_id',
        'code',
        'name',
        'company',
        'email',
        'phone',
        'location',
        'status',
        'avatar_url',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }
}
