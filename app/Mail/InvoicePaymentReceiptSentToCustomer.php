<?php

namespace App\Mail;

use App\Models\Invoice;
use App\Models\InvoicePayment;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class InvoicePaymentReceiptSentToCustomer extends Mailable
{
    use Queueable;
    use SerializesModels;

    public function __construct(
        public Invoice $invoice,
        public InvoicePayment $payment,
        public ?string $subjectOverride = null,
        public ?string $customMessage = null,
    ) {}

    public function envelope(): Envelope
    {
        $receiptRef = trim((string) $this->payment->receipt_ref);
        $invRef = trim((string) $this->invoice->invoice_ref);
        $defaultSubject = ($receiptRef !== '' ? 'Receipt '.$receiptRef : 'Receipt')
            .($invRef !== '' ? ' — Invoice '.$invRef : '')
            .' — '.$this->invoice->customer_name;
        $subject = trim((string) ($this->subjectOverride ?? '')) ?: $defaultSubject;

        return new Envelope(
            subject: $subject,
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'mail.invoice-payment-receipt-sent',
            with: [
                'customMessage' => trim((string) ($this->customMessage ?? '')) ?: null,
            ],
        );
    }
}
