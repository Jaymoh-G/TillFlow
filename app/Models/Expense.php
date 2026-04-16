<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Expense extends Model
{
    public const PAYMENT_STATUS_PAID = 'Paid';

    public const PAYMENT_STATUS_UNPAID = 'Unpaid';

    public const PAYMENT_STATUS_PARTIAL = 'Partial';

    public const PAYMENT_MODE_CASH = 'cash';

    public const PAYMENT_MODE_BANK_TRANSFER = 'bank_transfer';

    public const PAYMENT_MODE_MPESA = 'mpesa';

    public const PAYMENT_MODE_CARD = 'card';

    public const PAYMENT_MODE_CHEQUE = 'cheque';

    public const PAYMENT_MODE_OTHER = 'other';

    public const PAYMENT_STATUSES = [
        self::PAYMENT_STATUS_PAID,
        self::PAYMENT_STATUS_UNPAID,
        self::PAYMENT_STATUS_PARTIAL,
    ];

    public const PAYMENT_MODES = [
        self::PAYMENT_MODE_CASH,
        self::PAYMENT_MODE_BANK_TRANSFER,
        self::PAYMENT_MODE_MPESA,
        self::PAYMENT_MODE_CARD,
        self::PAYMENT_MODE_CHEQUE,
        self::PAYMENT_MODE_OTHER,
    ];

    protected $fillable = [
        'tenant_id',
        'expense_date',
        'category_id',
        'customer_id',
        'payee',
        'title',
        'description',
        'amount',
        'payment_mode',
        'payment_status',
        'receipt_path',
        'notes',
        'recurring_rule_id',
        'recurring_period_key',
        'created_by',
        'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'expense_date' => 'date',
            'amount' => 'decimal:2',
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

    public function recurringRule(): BelongsTo
    {
        return $this->belongsTo(ExpenseRecurringRule::class, 'recurring_rule_id');
    }
}
