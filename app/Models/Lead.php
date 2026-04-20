<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

class Lead extends Model
{
    use SoftDeletes;

    public const STATUS_NEW_LEAD = 'NewLead';

    public const STATUS_CONTACTED = 'Contacted';

    public const STATUS_RESPONDED = 'Responded';

    public const STATUS_PROPOSAL_SENT = 'ProposalSent';

    public const STATUS_NEGOTIATION = 'Negotiation';

    public const STATUS_ON_HOLD = 'OnHold';

    public const STATUS_CLOSED_WON = 'ClosedWon';

    public const STATUS_CLOSED_LOST = 'ClosedLost';

    /** @var list<string> */
    public const STATUSES = [
        self::STATUS_NEW_LEAD,
        self::STATUS_CONTACTED,
        self::STATUS_RESPONDED,
        self::STATUS_PROPOSAL_SENT,
        self::STATUS_NEGOTIATION,
        self::STATUS_ON_HOLD,
        self::STATUS_CLOSED_WON,
        self::STATUS_CLOSED_LOST,
    ];

    public const SOURCE_REFERRAL_FRIENDS = 'Referral from Friends';

    public const SOURCE_FROM_CLIENTS = 'From Clients';

    public const SOURCE_WEBSITE = 'Website';

    public const SOURCE_FACEBOOK = 'Facebook';

    public const SOURCE_SMS_CAMPAIGN = 'SMS Campaign';

    /** @var list<string> */
    public const SOURCES = [
        self::SOURCE_REFERRAL_FRIENDS,
        self::SOURCE_FROM_CLIENTS,
        self::SOURCE_WEBSITE,
        self::SOURCE_FACEBOOK,
        self::SOURCE_SMS_CAMPAIGN,
    ];

    protected $fillable = [
        'tenant_id',
        'code',
        'name',
        'email',
        'company',
        'phone',
        'location',
        'source',
        'status',
        'last_contacted_at',
        'converted_customer_id',
        'converted_at',
    ];

    protected function casts(): array
    {
        return [
            'last_contacted_at' => 'datetime',
            'converted_at' => 'datetime',
        ];
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function convertedCustomer(): BelongsTo
    {
        return $this->belongsTo(Customer::class, 'converted_customer_id');
    }

    public function proposals(): HasMany
    {
        return $this->hasMany(Proposal::class);
    }

    public function latestProposal(): HasOne
    {
        return $this->hasOne(Proposal::class)->latestOfMany(['proposed_at', 'id']);
    }

    public function isTerminal(): bool
    {
        return in_array($this->status, [self::STATUS_CLOSED_WON, self::STATUS_CLOSED_LOST], true);
    }
}
