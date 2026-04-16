<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PurchaseLine extends Model
{
    protected $fillable = [
        'purchase_id',
        'product_id',
        'sort_order',
        'product_name',
        'qty',
        'received_qty',
        'unit_price',
        'discount_amount',
        'tax_percent',
        'line_total',
    ];

    protected function casts(): array
    {
        return [
            'qty' => 'decimal:3',
            'received_qty' => 'decimal:3',
            'unit_price' => 'decimal:2',
            'discount_amount' => 'decimal:2',
            'tax_percent' => 'decimal:2',
            'line_total' => 'decimal:2',
        ];
    }

    public function purchase(): BelongsTo
    {
        return $this->belongsTo(Purchase::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function receiptLines(): HasMany
    {
        return $this->hasMany(PurchaseReceiptLine::class);
    }
}
