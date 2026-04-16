<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InvoicePayment extends Model
{
    public const METHOD_CASH = 'cash';

    public const METHOD_BANK_TRANSFER = 'bank_transfer';

    public const METHOD_MPESA = 'mpesa';

    public const METHOD_CARD = 'card';

    public const METHOD_CHEQUE = 'cheque';

    public const METHOD_OTHER = 'other';

    public const METHOD_OPENING_BALANCE = 'opening_balance';

    /** @var list<string> */
    public const METHODS = [
        self::METHOD_CASH,
        self::METHOD_BANK_TRANSFER,
        self::METHOD_MPESA,
        self::METHOD_CARD,
        self::METHOD_CHEQUE,
        self::METHOD_OTHER,
        self::METHOD_OPENING_BALANCE,
    ];

    protected $fillable = [
        'tenant_id',
        'invoice_id',
        'receipt_ref',
        'amount',
        'payment_method',
        'paid_at',
        'notes',
        'transaction_id',
        'sent_to_customer_at',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'paid_at' => 'datetime',
            'sent_to_customer_at' => 'datetime',
        ];
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class);
    }
}
