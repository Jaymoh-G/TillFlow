<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>Purchase Payment Updated</title>
</head>
<body>
    <p>Hello {{ $supplierName }},</p>

    <p>A payment has been recorded for your purchase order.</p>

    <ul>
        <li><strong>Reference:</strong> {{ $purchase->reference }}</li>
        <li><strong>Payment Date:</strong> {{ optional($payment->paid_at)->format('Y-m-d') }}</li>
        <li><strong>Amount Paid:</strong> KES {{ number_format((float) $payment->amount, 2) }}</li>
        <li><strong>Method:</strong> {{ $payment->method }}</li>
        <li><strong>Total Paid:</strong> KES {{ number_format((float) $purchase->paid_amount, 2) }}</li>
        <li><strong>Balance Due:</strong> KES {{ number_format((float) $purchase->due_amount, 2) }}</li>
        <li><strong>Payment Status:</strong> {{ $purchase->payment_status }}</li>
    </ul>

    <p>Thank you.</p>
</body>
</html>
