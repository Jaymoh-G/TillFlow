<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PosOrderItem extends Model
{
    protected $fillable = [
        'tenant_id',
        'pos_order_id',
        'product_id',
        'sku',
        'product_name',
        'description',
        'quantity',
        'unit_price',
        'tax_percent',
        'line_total',
        'position',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'decimal:3',
            'unit_price' => 'decimal:2',
            'tax_percent' => 'decimal:2',
            'line_total' => 'decimal:2',
            'position' => 'integer',
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

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
