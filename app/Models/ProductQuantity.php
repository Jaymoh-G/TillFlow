<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Per-store on-hand quantity for a product (tenant-scoped).
 *
 * Table: product_quantities (product_id + store_id unique per product).
 */
class ProductQuantity extends Model
{
    protected $table = 'product_quantities';

    protected $fillable = [
        'tenant_id',
        'product_id',
        'store_id',
        'qty',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function store(): BelongsTo
    {
        return $this->belongsTo(StoreManager::class, 'store_id');
    }
}
