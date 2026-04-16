<?php

namespace App\Mail;

use App\Models\CreditNote;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Attachment;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class CreditNoteSentToCustomer extends Mailable
{
    use Queueable;
    use SerializesModels;

    public function __construct(
        public CreditNote $creditNote,
        public string $pdfBinary,
        public string $pdfFilename,
        public ?string $subjectOverride = null,
        public ?string $customMessage = null,
    ) {}

    public function envelope(): Envelope
    {
        $defaultSubject = 'Credit Note '.$this->creditNote->credit_note_no.' — '.(string) ($this->creditNote->invoice?->customer_name ?? 'Customer');
        $subject = trim((string) ($this->subjectOverride ?? '')) ?: $defaultSubject;

        return new Envelope(
            subject: $subject,
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'mail.credit-note-sent',
            with: [
                'customMessage' => trim((string) ($this->customMessage ?? '')) ?: null,
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
