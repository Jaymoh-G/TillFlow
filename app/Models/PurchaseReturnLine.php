<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PurchaseReturnLine extends Model
{
    protected $fillable = [
        'purchase_return_id',
        'purchase_line_id',
        'product_id',
        'qty_returned',
        'line_refund_amount',
    ];

    protected function casts(): array
    {
        return [
            'qty_returned' => 'decimal:3',
            'line_refund_amount' => 'decimal:2',
        ];
    }

    public function purchaseReturn(): BelongsTo
    {
        return $this->belongsTo(PurchaseReturn::class);
    }

    public function purchaseLine(): BelongsTo
    {
        return $this->belongsTo(PurchaseLine::class);
    }
}
