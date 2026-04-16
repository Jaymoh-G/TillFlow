<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SalesReturn extends Model
{
    protected $fillable = [
        'tenant_id',
        'sales_return_no',
        'invoice_id',
        'pos_order_id',
        'product_id',
        'store_id',
        'customer_id',
        'product_name',
        'quantity',
        'returned_at',
        'status',
        'total_amount',
        'amount_paid',
        'amount_due',
        'payment_status',
        'notes',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'returned_at' => 'datetime',
            'total_amount' => 'decimal:2',
            'amount_paid' => 'decimal:2',
            'amount_due' => 'decimal:2',
            'quantity' => 'integer',
        ];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function store(): BelongsTo
    {
        return $this->belongsTo(StoreManager::class, 'store_id');
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class);
    }

    public function posOrder(): BelongsTo
    {
        return $this->belongsTo(PosOrder::class, 'pos_order_id');
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function lines(): HasMany
    {
        return $this->hasMany(SalesReturnLine::class, 'sales_return_id');
    }
}
