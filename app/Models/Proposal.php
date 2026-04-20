<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Proposal extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'tenant_id',
        'proposal_ref',
        'proposal_title',
        'proposed_at',
        'expires_at',
        'lead_id',
        'customer_id',
        'biller_id',
        'biller_name',
        'recipient_name',
        'recipient_image_url',
        'status',
        'discount_type',
        'discount_basis',
        'discount_value',
        'total_amount',
        'client_note',
        'terms_and_conditions',
        'customer_viewed_at',
        'quotation_id',
        'accepted_at',
        'expiry_reminder_email_sent_at',
        'expiry_reminder_sms_sent_at',
    ];

    protected function casts(): array
    {
        return [
            'proposed_at' => 'date',
            'expires_at' => 'date',
            'customer_viewed_at' => 'datetime',
            'expiry_reminder_email_sent_at' => 'datetime',
            'expiry_reminder_sms_sent_at' => 'datetime',
            'total_amount' => 'decimal:2',
            'discount_value' => 'decimal:2',
            'accepted_at' => 'datetime',
        ];
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function lead(): BelongsTo
    {
        return $this->belongsTo(Lead::class);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function biller(): BelongsTo
    {
        return $this->belongsTo(Biller::class);
    }

    public function quotation(): BelongsTo
    {
        return $this->belongsTo(Quotation::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(ProposalItem::class)->orderBy('position');
    }
}
