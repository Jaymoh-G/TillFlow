<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Quotation extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'tenant_id',
        'quote_ref',
        'quote_title',
        'quoted_at',
        'expires_at',
        'customer_id',
        'biller_id',
        'biller_name',
        'customer_name',
        'status',
        'discount_type',
        'discount_basis',
        'discount_value',
        'total_amount',
        'customer_image_url',
        'client_note',
        'terms_and_conditions',
    ];

    protected function casts(): array
    {
        return [
            'quoted_at' => 'date',
            'expires_at' => 'date',
            'total_amount' => 'decimal:2',
            'discount_value' => 'decimal:2',
        ];
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function biller(): BelongsTo
    {
        return $this->belongsTo(Biller::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(QuotationItem::class)->orderBy('position');
    }
}
