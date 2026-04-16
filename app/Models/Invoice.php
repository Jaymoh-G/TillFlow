<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Invoice extends Model
{
    use SoftDeletes;

    public const STATUS_DRAFT = 'Draft';

    public const STATUS_UNPAID = 'Unpaid';

    public const STATUS_PARTIALLY_PAID = 'Partially_paid';

    public const STATUS_PAID = 'Paid';

    public const STATUS_OVERDUE = 'Overdue';

    public const STATUS_CANCELLED = 'Cancelled';

    /** @var list<string> */
    public const STATUSES = [
        self::STATUS_DRAFT,
        self::STATUS_UNPAID,
        self::STATUS_PARTIALLY_PAID,
        self::STATUS_PAID,
        self::STATUS_OVERDUE,
        self::STATUS_CANCELLED,
    ];

    protected $fillable = [
        'tenant_id',
        'invoice_ref',
        'invoice_title',
        'issued_at',
        'due_at',
        'customer_id',
        'customer_name',
        'status',
        'discount_type',
        'discount_basis',
        'discount_value',
        'total_amount',
        'amount_paid',
        'customer_image_url',
        'notes',
        'terms_and_conditions',
        'sent_to_customer_at',
    ];

    protected function casts(): array
    {
        return [
            'issued_at' => 'date',
            'due_at' => 'date',
            'sent_to_customer_at' => 'datetime',
            'total_amount' => 'decimal:2',
            'amount_paid' => 'decimal:2',
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

    public function items(): HasMany
    {
        return $this->hasMany(InvoiceItem::class)->orderBy('position');
    }

    public function payments(): HasMany
    {
        return $this->hasMany(InvoicePayment::class)->orderByDesc('paid_at')->orderByDesc('id');
    }

    /**
     * Sum payment rows into amount_paid, then set non-draft status from balance and due date.
     */
    public function recalculateAmountPaidAndStatus(): void
    {
        $sum = (string) $this->payments()->sum('amount');
        $this->amount_paid = $sum;
        $this->saveQuietly();
        $this->syncStatusFromPaymentState();
    }

    /**
     * Apply payment-aware status for issued invoices (not Draft).
     */
    public function syncStatusFromPaymentState(): void
    {
        if (strcasecmp((string) $this->status, self::STATUS_DRAFT) === 0) {
            return;
        }
        if (strcasecmp((string) $this->status, self::STATUS_CANCELLED) === 0) {
            return;
        }

        $total = round((float) $this->total_amount, 2);
        $paid = round((float) $this->amount_paid, 2);
        $eps = 0.01;

        $newStatus = self::STATUS_UNPAID;

        if ($total <= 0) {
            $newStatus = $paid <= $eps ? self::STATUS_UNPAID : self::STATUS_PAID;
        } elseif ($paid + $eps >= $total) {
            $newStatus = self::STATUS_PAID;
        } elseif ($paid > $eps) {
            $newStatus = self::STATUS_PARTIALLY_PAID;
        } else {
            $due = $this->due_at;
            if ($due !== null) {
                $dueStr = $due instanceof \DateTimeInterface ? $due->format('Y-m-d') : (string) $due;
                if ($dueStr !== '' && $dueStr < now()->toDateString()) {
                    $newStatus = self::STATUS_OVERDUE;
                }
            }
        }

        if ($this->status !== $newStatus) {
            $this->status = $newStatus;
            $this->saveQuietly();
        }
    }

    /**
     * Issue draft invoice (Draft → Unpaid), then apply payment state.
     */
    public function issueFromDraft(): void
    {
        if (strcasecmp((string) $this->status, self::STATUS_DRAFT) !== 0) {
            return;
        }
        $this->status = self::STATUS_UNPAID;
        $this->saveQuietly();
        $this->syncStatusFromPaymentState();
    }

    /**
     * Cancelled → re-activate: set payment-aware status from amount_paid and due date.
     */
    public function restoreFromCancelled(): void
    {
        if (strcasecmp((string) $this->status, self::STATUS_CANCELLED) !== 0) {
            return;
        }
        $this->status = self::STATUS_UNPAID;
        $this->saveQuietly();
        $this->syncStatusFromPaymentState();
    }

    /**
     * Ensure invoice reference matches INV-###### or assign next available for tenant.
     */
    public function ensureIssuedInvoiceRef(callable $nextRefResolver): void
    {
        $ref = trim((string) $this->invoice_ref);
        if ($ref !== '' && preg_match('/^INV-\d+$/', $ref) === 1) {
            return;
        }
        $this->invoice_ref = $nextRefResolver();
    }
}
