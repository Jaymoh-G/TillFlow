<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PosOrder extends Model
{
    public const STATUS_COMPLETED = 'Completed';

    public const STATUS_VOIDED = 'Voided';

    /** @var list<string> */
    public const STATUSES = [
        self::STATUS_COMPLETED,
        self::STATUS_VOIDED,
    ];

    protected $fillable = [
        'tenant_id',
        'store_id',
        'order_no',
        'status',
        'customer_id',
        'customer_name',
        'customer_email',
        'subtotal_amount',
        'tax_amount',
        'discount_amount',
        'total_amount',
        'tendered_amount',
        'change_amount',
        'currency',
        'created_by',
        'completed_at',
        'voided_at',
        'notes',
        'sent_to_customer_at',
    ];

    protected function casts(): array
    {
        return [
            'subtotal_amount' => 'decimal:2',
            'tax_amount' => 'decimal:2',
            'discount_amount' => 'decimal:2',
            'total_amount' => 'decimal:2',
            'tendered_amount' => 'decimal:2',
            'change_amount' => 'decimal:2',
            'completed_at' => 'datetime',
            'voided_at' => 'datetime',
            'sent_to_customer_at' => 'datetime',
        ];
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function store(): BelongsTo
    {
        return $this->belongsTo(StoreManager::class, 'store_id');
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function cashier(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function items(): HasMany
    {
        return $this->hasMany(PosOrderItem::class)->orderBy('position')->orderBy('id');
    }

    public function payments(): HasMany
    {
        return $this->hasMany(PosOrderPayment::class)->orderByDesc('paid_at')->orderByDesc('id');
    }
}
