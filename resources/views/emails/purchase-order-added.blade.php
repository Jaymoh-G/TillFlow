<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>Purchase Added</title>
</head>
<body>
    <p>Hello {{ $supplierName }},</p>

    @if (!empty(trim((string) ($customMessage ?? ''))))
        {!! nl2br(e((string) $customMessage)) !!}
    @else
        <p>A new purchase has been created.</p>

        <ul>
            <li><strong>Reference:</strong> {{ $purchase->reference }}</li>
            <li><strong>Date:</strong> {{ optional($purchase->purchase_date)->format('Y-m-d') }}</li>
            <li><strong>Status:</strong> {{ $purchase->status }}</li>
            <li><strong>Total:</strong> KES {{ number_format((float) $purchase->grand_total, 2) }}</li>
            <li><strong>Due:</strong> KES {{ number_format((float) $purchase->due_amount, 2) }}</li>
        </ul>
    @endif

    <p>Thank you.</p>
</body>
</html>
