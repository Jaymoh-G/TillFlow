<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class StoreManager extends Model
{
    use SoftDeletes;

    protected $table = 'store_managers';

    protected $hidden = [
        'password',
    ];

    protected $fillable = [
        'tenant_id',
        'code',
        'store_name',
        'username',
        'password',
        'email',
        'phone',
        'location',
        'status',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function products(): HasMany
    {
        return $this->hasMany(Product::class, 'store_id');
    }

    /**
     * Per-product quantity rows for this store (product_quantities).
     */
    public function productQuantities(): HasMany
    {
        return $this->hasMany(ProductQuantity::class, 'store_id');
    }
}
