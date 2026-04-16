<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Receipt {{ $payment->receipt_ref ?? '' }}</title>
</head>
<body style="font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; line-height: 1.5; color: #222; max-width: 36rem; margin: 0 auto; padding: 1.5rem;">
    <p>Hello {{ $invoice->customer_name }},</p>
    @if(!empty($customMessage))
        <p style="white-space: pre-wrap;">{{ $customMessage }}</p>
    @else
        <p>Please find your payment receipt details below.</p>
    @endif
    <table style="width: 100%; border-collapse: collapse; margin: 1rem 0;">
        <tr>
            <td style="padding: 0.35rem 0; font-weight: 600;">Receipt number</td>
            <td style="padding: 0.35rem 0; text-align: right;">{{ $payment->receipt_ref ?? '—' }}</td>
        </tr>
        <tr>
            <td style="padding: 0.35rem 0; font-weight: 600;">Invoice number</td>
            <td style="padding: 0.35rem 0; text-align: right;">{{ $invoice->invoice_ref ?? '—' }}</td>
        </tr>
        <tr>
            <td style="padding: 0.35rem 0; font-weight: 600;">Paid at</td>
            <td style="padding: 0.35rem 0; text-align: right;">{{ $payment->paid_at?->format('j M Y H:i') }}</td>
        </tr>
        <tr>
            <td style="padding: 0.35rem 0; font-weight: 600;">Payment method</td>
            <td style="padding: 0.35rem 0; text-align: right;">{{ str_replace('_', ' ', (string) $payment->payment_method) ?: '—' }}</td>
        </tr>
        @if($payment->transaction_id)
        <tr>
            <td style="padding: 0.35rem 0; font-weight: 600;">Transaction ID</td>
            <td style="padding: 0.35rem 0; text-align: right;">{{ $payment->transaction_id }}</td>
        </tr>
        @endif
        <tr>
            <td style="padding: 0.35rem 0; font-weight: 600;">Paid amount</td>
            <td style="padding: 0.35rem 0; text-align: right;">Ksh {{ number_format((float) $payment->amount, 2) }}</td>
        </tr>
        <tr>
            <td style="padding: 0.35rem 0; font-weight: 600;">Invoice total</td>
            <td style="padding: 0.35rem 0; text-align: right;">Ksh {{ number_format((float) $invoice->total_amount, 2) }}</td>
        </tr>
        <tr>
            <td style="padding: 0.35rem 0; font-weight: 600;">Invoice amount paid</td>
            <td style="padding: 0.35rem 0; text-align: right;">Ksh {{ number_format((float) $invoice->amount_paid, 2) }}</td>
        </tr>
    </table>
    <p style="margin-top: 1.5rem; font-size: 0.9rem; color: #555;">Thank you for your business.</p>
</body>
</html>
