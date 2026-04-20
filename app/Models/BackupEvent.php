<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BackupEvent extends Model
{
    protected $fillable = [
        'kind',
        'status',
        'disk_name',
        'path',
        'size_bytes',
        'message',
        'tenant_id',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }
}
