<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DeliveryNoteItem extends Model
{
    protected $fillable = [
        'delivery_note_id',
        'invoice_item_id',
        'product_id',
        'product_name',
        'description',
        'uom',
        'qty',
    ];

    protected function casts(): array
    {
        return [
            'qty' => 'decimal:3',
        ];
    }

    public function deliveryNote(): BelongsTo
    {
        return $this->belongsTo(DeliveryNote::class);
    }

    public function invoiceItem(): BelongsTo
    {
        return $this->belongsTo(InvoiceItem::class);
    }
}
