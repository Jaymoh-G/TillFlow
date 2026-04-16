<?php

namespace App\Mail;

use App\Models\Purchase;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class PurchaseOrderAddedMail extends Mailable
{
    use Queueable, SerializesModels;

    /** @var Purchase */
    public $purchase;

    /** @var string|null */
    public $customSubject;

    /** @var string|null */
    public $customMessage;

    public function __construct(Purchase $purchase, ?string $customSubject = null, ?string $customMessage = null)
    {
        $this->purchase = $purchase;
        $this->customSubject = $customSubject;
        $this->customMessage = $customMessage;
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: trim((string) $this->customSubject) !== ''
                ? trim((string) $this->customSubject)
                : 'New Purchase: '.$this->purchase->reference
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.purchase-order-added',
            with: [
                'purchase' => $this->purchase,
                'supplierName' => $this->purchase->supplier?->name ?? 'Supplier',
                'customMessage' => $this->customMessage,
            ]
        );
    }
}
