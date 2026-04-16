<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CreditNoteItem extends Model
{
    protected $fillable = [
        'credit_note_id',
        'invoice_item_id',
        'product_id',
        'product_name',
        'description',
        'uom',
        'qty',
        'unit_price',
        'line_total',
    ];

    protected function casts(): array
    {
        return [
            'qty' => 'decimal:3',
            'unit_price' => 'decimal:2',
            'line_total' => 'decimal:2',
        ];
    }

    public function creditNote(): BelongsTo
    {
        return $this->belongsTo(CreditNote::class);
    }

    public function invoiceItem(): BelongsTo
    {
        return $this->belongsTo(InvoiceItem::class);
    }
}
