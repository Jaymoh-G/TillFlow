<?php

namespace App\Mail;

use App\Models\Purchase;
use App\Models\PurchasePayment;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class PurchasePaymentUpdatedMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public Purchase $purchase,
        public PurchasePayment $payment
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Purchase Payment Update: '.$this->purchase->reference
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.purchase-payment-updated',
            with: [
                'purchase' => $this->purchase,
                'payment' => $this->payment,
                'supplierName' => $this->purchase->supplier?->name ?? 'Supplier',
            ]
        );
    }
}
