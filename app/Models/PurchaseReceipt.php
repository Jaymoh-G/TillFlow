<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PurchaseReceipt extends Model
{
    protected $fillable = [
        'tenant_id',
        'purchase_id',
        'received_at',
        'reference',
        'note',
        'created_by_user_id',
    ];

    protected function casts(): array
    {
        return [
            'received_at' => 'date',
        ];
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function purchase(): BelongsTo
    {
        return $this->belongsTo(Purchase::class);
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_user_id');
    }

    public function lines(): HasMany
    {
        return $this->hasMany(PurchaseReceiptLine::class);
    }
}
