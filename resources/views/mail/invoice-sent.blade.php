<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Invoice {{ $invoice->invoice_ref ?? '(draft)' }}</title>
</head>
<body style="font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; line-height: 1.5; color: #222; max-width: 36rem; margin: 0 auto; padding: 1.5rem;">
    <p>Hello {{ $invoice->customer_name }},</p>
    @if(!empty($customMessage))
        <p style="white-space: pre-wrap;">{{ $customMessage }}</p>
    @else
        <p>Please find your invoice below.</p>
    @endif
    <table style="width: 100%; border-collapse: collapse; margin: 1rem 0;">
        <tr>
            <td style="padding: 0.35rem 0; font-weight: 600;">Invoice number</td>
            <td style="padding: 0.35rem 0; text-align: right;">{{ $invoice->invoice_ref ?? '—' }}</td>
        </tr>
        @if($invoice->invoice_title)
        <tr>
            <td style="padding: 0.35rem 0; font-weight: 600;">Title</td>
            <td style="padding: 0.35rem 0; text-align: right;">{{ $invoice->invoice_title }}</td>
        </tr>
        @endif
        <tr>
            <td style="padding: 0.35rem 0; font-weight: 600;">Issue date</td>
            <td style="padding: 0.35rem 0; text-align: right;">{{ $invoice->issued_at?->format('j M Y') }}</td>
        </tr>
        @if($invoice->due_at)
        <tr>
            <td style="padding: 0.35rem 0; font-weight: 600;">Due date</td>
            <td style="padding: 0.35rem 0; text-align: right;">{{ $invoice->due_at->format('j M Y') }}</td>
        </tr>
        @endif
        <tr>
            <td style="padding: 0.35rem 0; font-weight: 600;">Amount due</td>
            <td style="padding: 0.35rem 0; text-align: right;">Ksh {{ number_format((float) $invoice->total_amount - (float) $invoice->amount_paid, 2) }}</td>
        </tr>
        <tr>
            <td style="padding: 0.35rem 0; font-weight: 600;">Total</td>
            <td style="padding: 0.35rem 0;text-align: right;">Ksh {{ number_format((float) $invoice->total_amount, 2) }}</td>
        </tr>
    </table>
    @if($invoice->terms_and_conditions)
    <p style="font-size: 0.9rem; color: #444;"><strong>Terms</strong><br>{!! nl2br(e($invoice->terms_and_conditions)) !!}</p>
    @endif
    <p style="margin-top: 1.5rem; font-size: 0.9rem; color: #555;">Thank you for your business.</p>
</body>
</html>
