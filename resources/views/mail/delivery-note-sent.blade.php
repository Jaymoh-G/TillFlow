<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Delivery Note {{ $deliveryNote->delivery_note_no }}</title>
</head>
<body style="font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; line-height: 1.5; color: #222; max-width: 36rem; margin: 0 auto; padding: 1.5rem;">
    <p>Hello {{ $deliveryNote->invoice?->customer_name ?? 'Customer' }},</p>
    @if(!empty($customMessage))
        <p style="white-space: pre-wrap;">{{ $customMessage }}</p>
    @else
        <p>Please find your delivery note attached.</p>
    @endif
    <table style="width: 100%; border-collapse: collapse; margin: 1rem 0;">
        <tr>
            <td style="padding: 0.35rem 0; font-weight: 600;">Delivery note</td>
            <td style="padding: 0.35rem 0; text-align: right;">{{ $deliveryNote->delivery_note_no }}</td>
        </tr>
        <tr>
            <td style="padding: 0.35rem 0; font-weight: 600;">Invoice</td>
            <td style="padding: 0.35rem 0; text-align: right;">{{ $deliveryNote->invoice?->invoice_ref ?? '—' }}</td>
        </tr>
        <tr>
            <td style="padding: 0.35rem 0; font-weight: 600;">Issue date</td>
            <td style="padding: 0.35rem 0; text-align: right;">{{ $deliveryNote->issued_at?->format('j M Y') }}</td>
        </tr>
    </table>
    <p style="margin-top: 1.5rem; font-size: 0.9rem; color: #555;">Thank you for your business.</p>
</body>
</html>

