<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PurchaseReturn extends Model
{
    protected $fillable = [
        'tenant_id',
        'supplier_id',
        'purchase_id',
        'reference',
        'return_date',
        'status',
        'grand_total',
        'paid_amount',
        'due_amount',
        'refund_amount',
        'payment_status',
        'description',
    ];

    protected function casts(): array
    {
        return [
            'return_date' => 'date',
            'grand_total' => 'decimal:2',
            'paid_amount' => 'decimal:2',
            'due_amount' => 'decimal:2',
            'refund_amount' => 'decimal:2',
        ];
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class);
    }

    public function purchase(): BelongsTo
    {
        return $this->belongsTo(Purchase::class);
    }

    public function lines(): HasMany
    {
        return $this->hasMany(PurchaseReturnLine::class);
    }
}
