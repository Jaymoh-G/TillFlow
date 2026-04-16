<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Product extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'tenant_id',
        'category_id',
        'brand_id',
        'unit_id',
        'warranty_id',
        'store_id',
        'name',
        'sku',
        'image_path',
        'qty',
        'qty_alert',
        'manufactured_at',
        'expires_at',
        'buying_price',
        'selling_price',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'manufactured_at' => 'date',
            'expires_at' => 'date',
            'buying_price' => 'decimal:2',
            'selling_price' => 'decimal:2',
        ];
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function brand(): BelongsTo
    {
        return $this->belongsTo(Brand::class);
    }

    public function unit(): BelongsTo
    {
        return $this->belongsTo(Unit::class);
    }

    public function warranty(): BelongsTo
    {
        return $this->belongsTo(Warranty::class);
    }

    public function store(): BelongsTo
    {
        return $this->belongsTo(StoreManager::class, 'store_id');
    }

    public function variants(): HasMany
    {
        return $this->hasMany(ProductVariant::class);
    }

    public function stockAdjustments(): HasMany
    {
        return $this->hasMany(StockAdjustment::class);
    }

    /**
     * Per-store stock buckets (product_quantities table).
     */
    public function productQuantities(): HasMany
    {
        return $this->hasMany(ProductQuantity::class);
    }
}
