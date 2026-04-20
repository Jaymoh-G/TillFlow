<?php

namespace App\Mail;

use App\Models\Invoice;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Attachment;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class InvoiceSentToCustomer extends Mailable
{
    use Queueable;
    use SerializesModels;

    public function __construct(
        public Invoice $invoice,
        public string $pdfBinary,
        public string $pdfFilename,
        public ?string $subjectOverride = null,
        public ?string $customMessage = null,
        public ?string $viewUrl = null,
    ) {}

    public function envelope(): Envelope
    {
        $ref = trim((string) $this->invoice->invoice_ref);
        $defaultSubject = ($ref !== '' ? 'Invoice '.$ref : 'Invoice (draft)').' — '.$this->invoice->customer_name;
        $subject = trim((string) ($this->subjectOverride ?? '')) ?: $defaultSubject;

        return new Envelope(
            subject: $subject,
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'mail.invoice-sent',
            with: [
                'customMessage' => trim((string) ($this->customMessage ?? '')) ?: null,
                'viewUrl' => $this->viewUrl !== null && trim($this->viewUrl) !== '' ? trim($this->viewUrl) : null,
            ],
        );
    }

    /**
     * @return array<int, Attachment>
     */
    public function attachments(): array
    {
        return [
            Attachment::fromData(fn () => $this->pdfBinary, $this->pdfFilename)
                ->withMime('application/pdf'),
        ];
    }
}
