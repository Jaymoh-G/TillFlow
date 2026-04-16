<?php

namespace App\Mail;

use App\Models\PosOrder;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class PosOrderReceiptSentToCustomer extends Mailable
{
    use Queueable;
    use SerializesModels;

    public function __construct(
        public PosOrder $order,
        public ?string $subjectOverride = null,
        public ?string $customMessage = null,
    ) {}

    public function envelope(): Envelope
    {
        $orderNo = trim((string) $this->order->order_no);
        $custName = trim((string) ($this->order->customer_name ?? ''));
        $defaultSubject = ($orderNo !== '' ? 'Receipt '.$orderNo : 'Receipt')
            .($custName !== '' ? ' — '.$custName : '');
        $subject = trim((string) ($this->subjectOverride ?? '')) ?: $defaultSubject;

        return new Envelope(
            subject: $subject,
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'mail.pos-order-receipt-sent',
            with: [
                'customMessage' => trim((string) ($this->customMessage ?? '')) ?: null,
            ],
        );
    }
}
