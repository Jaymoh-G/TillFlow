<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Purchase extends Model
{
    protected $fillable = [
        'tenant_id',
        'supplier_id',
        'reference',
        'purchase_date',
        'status',
        'purchase_type',
        'order_tax',
        'order_discount',
        'shipping',
        'description',
        'grand_total',
        'paid_amount',
        'due_amount',
        'payment_status',
        'last_sent_to',
        'last_sent_cc',
        'last_sent_at',
    ];

    protected function casts(): array
    {
        return [
            'purchase_date' => 'date',
            'order_tax' => 'decimal:2',
            'order_discount' => 'decimal:2',
            'shipping' => 'decimal:2',
            'grand_total' => 'decimal:2',
            'paid_amount' => 'decimal:2',
            'due_amount' => 'decimal:2',
            'last_sent_at' => 'datetime',
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

    public function lines(): HasMany
    {
        return $this->hasMany(PurchaseLine::class)->orderBy('sort_order')->orderBy('id');
    }

    public function receipts(): HasMany
    {
        return $this->hasMany(PurchaseReceipt::class)->orderByDesc('received_at')->orderByDesc('id');
    }

    public function payments(): HasMany
    {
        return $this->hasMany(PurchasePayment::class)->orderByDesc('paid_at')->orderByDesc('id');
    }

    public function returns(): HasMany
    {
        return $this->hasMany(PurchaseReturn::class)->orderByDesc('return_date')->orderByDesc('id');
    }
}
