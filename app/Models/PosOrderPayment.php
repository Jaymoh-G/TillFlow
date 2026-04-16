<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PosOrderPayment extends Model
{
    public const METHOD_CASH = 'cash';

    public const METHOD_MPESA = 'mpesa';

    public const METHOD_CARD = 'card';

    public const METHOD_BANK_TRANSFER = 'bank_transfer';

    public const METHOD_CHEQUE = 'cheque';

    public const METHOD_OTHER = 'other';

    /** @var list<string> */
    public const METHODS = [
        self::METHOD_CASH,
        self::METHOD_MPESA,
        self::METHOD_CARD,
        self::METHOD_BANK_TRANSFER,
        self::METHOD_CHEQUE,
        self::METHOD_OTHER,
    ];

    protected $fillable = [
        'tenant_id',
        'pos_order_id',
        'method',
        'amount',
        'transaction_ref',
        'paid_at',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'paid_at' => 'datetime',
        ];
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(PosOrder::class, 'pos_order_id');
    }
}
