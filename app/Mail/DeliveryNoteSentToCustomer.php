<?php

namespace App\Mail;

use App\Models\DeliveryNote;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Attachment;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class DeliveryNoteSentToCustomer extends Mailable
{
    use Queueable;
    use SerializesModels;

    public function __construct(
        public DeliveryNote $deliveryNote,
        public string $pdfBinary,
        public string $pdfFilename,
        public ?string $subjectOverride = null,
        public ?string $customMessage = null,
    ) {}

    public function envelope(): Envelope
    {
        $defaultSubject = 'Delivery Note '.$this->deliveryNote->delivery_note_no.' — '.(string) ($this->deliveryNote->invoice?->customer_name ?? 'Customer');
        $subject = trim((string) ($this->subjectOverride ?? '')) ?: $defaultSubject;

        return new Envelope(
            subject: $subject,
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'mail.delivery-note-sent',
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
