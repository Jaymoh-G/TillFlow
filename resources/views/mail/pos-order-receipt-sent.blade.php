@php
    $currency = trim((string) ($order->currency ?? 'KES')) ?: 'KES';
    $money = static function ($amount) use ($currency): string {
        return $currency.' '.number_format((float) $amount, 2);
    };
    $hasAmount = static function ($amount): bool {
        return abs((float) $amount) > 0.000001;
    };
    $customerName = trim((string) ($order->customer_name ?? ''));
    $showCustomerName = $customerName !== '' && strtolower($customerName) !== 'walk-in customer';
    $items = $order->items ?? collect();
    $payments = $order->payments ?? collect();
    $ui = is_array($tenant->ui_settings ?? null) ? $tenant->ui_settings : [];
    $logo = trim((string) ($logoSrc ?? $ui['invoiceLogoDataUrl'] ?? $ui['invoice_logo_data_url'] ?? $ui['company_logo'] ?? ''));
    $companyName = trim((string) ($tenant->name ?? ''));
    $companyLocation = trim((string) ($tenant->company_address_line ?? ''));
    $companyPhone = trim((string) ($tenant->company_phone ?? ''));
@endphp
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Receipt {{ $order->order_no ?? '' }}</title>
</head>
<body style="margin:0;padding:16px;background:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#111827;font-size:14px;line-height:1.35;">
    <div style="max-width:424px;margin:0 auto;padding:24px;background:#fff;">
        @if($customMessage)
            <p style="margin:0 0 12px;font-size:14px;white-space:pre-wrap;">{{ $customMessage }}</p>
        @endif

        <div style="text-align:center;margin-bottom:6px;">
            @if($logo !== '')
                <img src="{{ $logo }}" width="110" height="34" alt="Receipt Logo" style="object-fit:contain;display:block;margin:0 auto;" />
            @endif
        </div>

        <div style="text-align:center;margin-bottom:10px;">
            <h6 style="margin:10px 0;font-weight:700;font-size:16px;">{{ $companyName !== '' ? $companyName : config('app.name', 'TillFlow') }}</h6>
            <p style="margin:0;">{{ $companyLocation !== '' ? $companyLocation : '—' }}</p>
            @if($companyPhone !== '')
                <p style="margin:0;">{{ $companyPhone }}</p>
            @endif
        </div>

        <div style="margin:10px 0;">
            <h6 style="margin:10px 0;font-weight:700;position:relative;text-align:center;">
                <span style="position:absolute;left:0;right:65%;top:50%;border-top:1px dashed #d1d5db;"></span>
                Receipt
                <span style="position:absolute;left:65%;right:0;top:50%;border-top:1px dashed #d1d5db;"></span>
            </h6>
            <table style="width:100%;border-collapse:collapse;">
                @if($showCustomerName)
                    <tr>
                        <td style="padding:0 0 8px;">Name:</td>
                        <td style="padding:0 0 8px;text-align:right;">{{ $customerName }}</td>
                    </tr>
                @endif
                <tr>
                    <td style="padding:0 0 8px;">Sale ID:</td>
                    <td style="padding:0 0 8px;text-align:right;">{{ $order->order_no ?? '—' }}</td>
                </tr>
                <tr>
                    <td style="padding:0 0 8px;">Date:</td>
                    <td style="padding:0 0 8px;text-align:right;">{{ $order->completed_at?->format('j M Y H:i') ?? '—' }}</td>
                </tr>
            </table>
        </div>

        <table style="width:100%;border-collapse:collapse;margin-bottom:8px;">
            <thead>
                <tr>
                    <th style="text-align:left;padding:10px 5px;border-top:1px dashed #d1d5db;border-bottom:1px dashed #d1d5db;font-weight:700;font-size:14px;"># Item</th>
                    <th style="text-align:right;padding:10px 5px;border-top:1px dashed #d1d5db;border-bottom:1px dashed #d1d5db;font-weight:700;font-size:14px;">Price</th>
                    <th style="text-align:right;padding:10px 5px;border-top:1px dashed #d1d5db;border-bottom:1px dashed #d1d5db;font-weight:700;font-size:14px;">Qty</th>
                    <th style="text-align:right;padding:10px 5px;border-top:1px dashed #d1d5db;border-bottom:1px dashed #d1d5db;font-weight:700;font-size:14px;">Total</th>
                </tr>
            </thead>
            <tbody>
                @forelse($items as $index => $item)
                    <tr>
                        <td style="padding:5px;font-size:14px;vertical-align:top;">{{ ($index + 1).'. '.($item->product_name ?? 'Item') }}</td>
                        <td style="padding:5px;font-size:14px;text-align:right;vertical-align:top;">{{ $money($item->unit_price ?? 0) }}</td>
                        <td style="padding:5px;font-size:14px;text-align:right;vertical-align:top;">{{ (float) ($item->quantity ?? 0) }}</td>
                        <td style="padding:5px;font-size:14px;text-align:right;vertical-align:top;">{{ $money($item->line_total ?? 0) }}</td>
                    </tr>
                @empty
                    <tr>
                        <td colspan="4" style="padding:8px 0;text-align:center;color:#666;font-size:14px;">No items</td>
                    </tr>
                @endforelse
            </tbody>
        </table>

        <table style="width:100%;border-collapse:collapse;border-top:1px dashed #d1d5db;margin-top:6px;">
            @if((float) ($order->subtotal_amount ?? 0) !== (float) ($order->total_amount ?? 0))
                <tr>
                    <td style="padding:5px;font-size:14px;">Sub Total:</td>
                    <td style="padding:5px;font-size:14px;text-align:right;">{{ $money($order->subtotal_amount ?? 0) }}</td>
                </tr>
            @endif
            @if($hasAmount($order->tax_amount ?? 0))
                <tr>
                    <td style="padding:5px;font-size:14px;">Tax:</td>
                    <td style="padding:5px;font-size:14px;text-align:right;">{{ $money($order->tax_amount ?? 0) }}</td>
                </tr>
            @endif
            @if($hasAmount($order->discount_amount ?? 0))
                <tr>
                    <td style="padding:5px;font-size:14px;">Discount:</td>
                    <td style="padding:5px;font-size:14px;text-align:right;">-{{ $money($order->discount_amount ?? 0) }}</td>
                </tr>
            @endif
            <tr>
                <td style="padding:5px;font-size:14px;font-weight:700;">Total:</td>
                <td style="padding:5px;font-size:14px;text-align:right;font-weight:700;">{{ $money($order->total_amount ?? 0) }}</td>
            </tr>
            @if($hasAmount($order->change_amount ?? 0))
                <tr>
                    <td style="padding:5px;font-size:14px;">Change:</td>
                    <td style="padding:5px;font-size:14px;text-align:right;">{{ $money($order->change_amount ?? 0) }}</td>
                </tr>
            @endif
        </table>

        @if($payments->count())
            <div style="margin-top:8px;border-top:1px dashed #d1d5db;padding-top:6px;font-size:14px;">
                @foreach($payments as $payment)
                    <div style="display:flex;justify-content:space-between;padding:2px 0;">
                        <span>{{ ucwords(str_replace('_', ' ', (string) ($payment->method ?? 'payment'))) }}</span>
                        <span>{{ $money($payment->amount ?? 0) }}</span>
                    </div>
                @endforeach
            </div>
        @endif

        <div style="margin-top:14px;padding-top:14px;border-top:1px dashed #d1d5db;text-align:center;color:#333;">
            <div style="border-bottom:1px dashed #d1d5db;padding-bottom:8px;margin-bottom:12px;">
                <p style="margin:0;">**VAT against this challan is payable through central registration. Thank you for your business!</p>
            </div>
            <p style="margin:0 0 4px;font-weight:700;">{{ $order->order_no ?? 'Sale' }}</p>
            <p style="margin:0;">Thank You For Shopping With Us. Please Come Again</p>
        </div>
    </div>
</body>
</html>

