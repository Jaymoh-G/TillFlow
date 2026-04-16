<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class StockTransfer extends Model
{
    protected $fillable = [
        'tenant_id',
        'from_store_id',
        'to_store_id',
        'ref_number',
        'notes',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function fromStore(): BelongsTo
    {
        return $this->belongsTo(StoreManager::class, 'from_store_id');
    }

    public function toStore(): BelongsTo
    {
        return $this->belongsTo(StoreManager::class, 'to_store_id');
    }

    public function lines(): HasMany
    {
        return $this->hasMany(StockTransferLine::class);
    }
}
