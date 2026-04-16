<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ExpenseRecurringRule extends Model
{
    public const CADENCE_WEEKLY = 'weekly';

    public const CADENCE_MONTHLY = 'monthly';

    public const CADENCE_CUSTOM_DAYS = 'custom_days';

    public const CADENCES = [
        self::CADENCE_WEEKLY,
        self::CADENCE_MONTHLY,
        self::CADENCE_CUSTOM_DAYS,
    ];

    protected $fillable = [
        'tenant_id',
        'category_id',
        'customer_id',
        'title',
        'description',
        'payee',
        'amount',
        'payment_mode',
        'payment_status',
        'notes',
        'cadence',
        'interval_value',
        'start_date',
        'end_date',
        'next_run_at',
        'is_active',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'start_date' => 'date',
            'end_date' => 'date',
            'next_run_at' => 'datetime',
            'is_active' => 'boolean',
        ];
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(ExpenseCategory::class, 'category_id');
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class, 'customer_id');
    }

    public function expenses(): HasMany
    {
        return $this->hasMany(Expense::class, 'recurring_rule_id');
    }
}
