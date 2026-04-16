<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>Quotation {{ $q->quote_ref }}</title>
    <style>
        @page {
            margin: 12mm 12mm 18mm 12mm;
        }
        * { box-sizing: border-box; }
        /*
           DejaVu Serif: bundled with Dompdf, distinct from the modal/html2canvas sans download.
           Table header stays DejaVu Sans for dense columns on the dark bar.
        */
        body {
            font-family: "DejaVu Serif", Georgia, "Times New Roman", Times, serif;
            font-size: 14.5px;
            color: #212b36;
            margin: 0;
            padding: 8px 12px 12px 12px;
            line-height: 1.32;
            background: #fff;
        }
        p {
            margin: 0 0 2px 0;
            line-height: 1.32;
        }
        p:last-child { margin-bottom: 0; }
        .card {
            border: none;
            border-radius: 0;
            padding: 6px 10px 8px 10px;
            background: #fff;
            box-sizing: border-box;
        }
        .border-bottom { border-bottom: 1px solid #dee2e6; padding-bottom: 12px; margin-bottom: 12px; }
        .row { width: 100%; margin-bottom: 5px; }
        .quotation-pdf-row--tight { margin-bottom: 2px; }
        .row:after { content: ""; display: table; clear: both; }
        .col-6 { float: left; width: 50%; vertical-align: top; }
        .col-5 { float: left; width: 42%; }
        .col-2 { float: left; width: 16%; }
        .text-end { text-align: right; }
        .text-center { text-align: center; }
        .text-muted { color: #6c757d; }
        .text-primary { color: #ff9f43; }
        .pdf-logo-spacer { min-height: 48px; }
        .pdf-header-logo img { max-width: 130px; max-height: 52px; display: block; }
        .pdf-quote-dates { margin-top: 4px !important; line-height: 1.32; }
        .pdf-notes-wrap { margin-bottom: 6px; }
        .fw-semibold { font-weight: 700; }
        .fw-medium { font-weight: 600; }
        .mb-0 { margin-bottom: 0 !important; }
        .mb-1 { margin-bottom: 2px !important; }
        .mb-2 { margin-bottom: 5px !important; }
        .mb-3 { margin-bottom: 8px !important; }
        h4 { font-size: 17px; margin: 0 0 4px 0; font-weight: 700; line-height: 1.28; }
        h5 { font-size: 15px; margin: 0 0 4px 0; line-height: 1.28; }
        h6 { font-size: 13px; margin: 0 0 1px 0; font-weight: 600; line-height: 1.28; }
        .pdf-company-h { font-size: 17px; margin: 0 0 4px 0; font-weight: 700; color: #000; line-height: 1.28; }
        .quote-meta p { margin: 0 0 2px 0; line-height: 1.2; }
        .badge {
            display: inline-block;
            padding: 4px 10px;
            font-size: 10px;
            border-radius: 4px;
            background: #e8f4fd;
            color: #0d6efd;
            font-weight: 600;
        }
        .quote-doc-title {
            font-size: 17px;
            font-weight: 900;
            letter-spacing: 0.06em;
            color: #000;
            margin: 0 0 1px 0;
            text-transform: uppercase;
            line-height: 1.2;
            font-family: "DejaVu Sans", Arial, Helvetica, sans-serif;
        }
        .quote-doc-ref { font-size: 14px; font-weight: 700; margin: 0 0 2px 0; color: #000; line-height: 1.22; }
        .quote-doc-status {
            font-size: 14px;
            font-weight: 700;
            letter-spacing: 0.04em;
            margin: 0;
            line-height: 1.22;
            text-transform: uppercase;
            font-family: "DejaVu Sans", Arial, Helvetica, sans-serif;
        }
        .quote-doc-status--draft { color: #6c757d; }
        .quote-doc-status--sent { color: #0d6efd; }
        .quote-doc-status--expired { color: #ca6510; }
        .quote-doc-status--declined { color: #dc3545; }
        .quote-doc-status--accepted { color: #198754; }
        a.pdf-web-link { color: #212b36; text-decoration: none; }
        /* Line items: no vertical grid; soft row dividers only (matches cleaner on-screen table) */
        table.items {
            width: 100%;
            border-collapse: collapse;
            margin: 8px 0 8px 0;
            border: none;
            border-top: 1px solid #424242;
        }
        table.items th {
            background: #424242;
            color: #fff;
            border: none;
            padding: 6px 5px;
            text-align: left;
            font-weight: 800;
            font-size: 11px;
            line-height: 1.22;
            font-family: "DejaVu Sans", Arial, Helvetica, sans-serif;
        }
        table.items td {
            border: none;
            border-bottom: 1px solid #e9ecef;
            padding: 5px 5px;
            vertical-align: top;
            line-height: 1.32;
        }
        table.items th:first-child,
        table.items td:first-child {
            padding-right: 3px;
        }
        table.items th:nth-child(2),
        table.items td:nth-child(2) {
            padding-left: 3px;
        }
        table.items th.text-end, table.items td.text-end { text-align: right; }
        table.items thead th { border-bottom: none; }
        table.items tbody tr:last-child td { border-bottom: none; }
        table.items th.items-th-strong { color: #fff; font-weight: 800; }
        table.items tbody td h6 { font-size: 13px; margin: 0 0 1px 0; font-weight: 600; color: #212b36; line-height: 1.28; }
        table.items tbody td p.text-muted,
        table.items tbody td p.small {
            margin: 2px 0 0 0;
            line-height: 1.32;
        }
        table.items tfoot tr:last-child td { border-bottom: none; }
        table.items tfoot.items-totals td {
            vertical-align: middle;
            border-left: none;
            border-right: none;
            border-bottom: none;
        }
        table.items tfoot.items-totals tr:first-child td {
            border-top: 1px solid #dee2e6;
            padding-top: 5px;
        }
        table.items tfoot.items-totals tr:not(:first-child) td:first-child {
            border-top: none;
        }
        table.items tfoot.items-totals tr:not(:first-child) td:not(:first-child) {
            border-top: 1px solid #dee2e6;
        }
        table.items tfoot.items-totals .totals-amt { font-weight: 800; font-size: 12px; }
        table.items tfoot.items-totals .totals-grand td { font-weight: 800; font-size: 12px; padding-top: 4px; }
        .small { font-size: 11px; line-height: 1.32; }
        .notes-block { margin-bottom: 6px; font-size: 10px; line-height: 1.28; }
        .notes-block h6 { margin-bottom: 2px; font-weight: 700; font-size: 10px; line-height: 1.22; }
        .notes-block p { margin: 0; white-space: pre-wrap; font-size: 10px; line-height: 1.28; }
        .footer-bank { margin-top: 8px; padding-top: 8px; border-top: 1px solid #dee2e6; font-size: 10px; line-height: 1.28; }
        .footer-bank p { line-height: 1.28; margin: 0 0 2px 0; }
        .quotation-title-block {
            margin-top: 8px;
            padding-top: 6px;
            padding-bottom: 0;
            margin-bottom: 4px;
        }
        .quotation-title-block h4 {
            font-size: 17px;
            margin: 0;
            font-weight: 700;
            color: #000;
            white-space: pre-wrap;
            line-height: 1.32;
        }
    </style>
</head>
<body>
<div class="card">
    {{-- Match modal: logo column (spacer) + QUOTATION meta right; company/customer on second row only --}}
    <div class="row quotation-pdf-row--tight">
        <div class="col-6">
            @if (! empty($companyLogoSrc))
            <div class="pdf-header-logo">
                <img src="{{ $companyLogoSrc }}" alt="" />
            </div>
            @else
            <div class="pdf-logo-spacer"></div>
            @endif
        </div>
        <div class="col-6 text-end">
            <div class="quote-meta text-end">
                @php
                    $rawSt = strtolower(trim((string) ($q->status ?? 'draft')));
                    $pdfStatusClass = match ($rawSt) {
                        'sent' => 'quote-doc-status--sent',
                        'expired' => 'quote-doc-status--expired',
                        'declined' => 'quote-doc-status--declined',
                        'accepted' => 'quote-doc-status--accepted',
                        default => 'quote-doc-status--draft',
                    };
                    $pdfStatusLabel = strtoupper(trim((string) ($q->status ?? 'Draft')) ?: 'DRAFT');
                @endphp
                <p class="quote-doc-title">QUOTATION</p>
                <p class="quote-doc-ref"># {{ $q->quote_ref }}</p>
                <p class="quote-doc-status {{ $pdfStatusClass }}">{{ $pdfStatusLabel }}</p>
            </div>
        </div>
    </div>

    <div class="row quotation-pdf-row--tight">
        <div class="col-6">
            <h4 class="pdf-company-h">{{ $companyName ?: 'Your business' }}</h4>
            <p class="small mb-1">{{ $companyAddr !== '' ? $companyAddr : '—' }}</p>
            @if ($companyWebsite !== '')
            <p class="small mb-1"><a class="pdf-web-link" href="{{ $companyWebsiteHref }}">{{ $companyWebsite }}</a></p>
            @else
            <p class="small mb-1">—</p>
            @endif
            <p class="mb-1 small">{{ $companyEmail !== '' ? $companyEmail : '—' }}</p>
            <p class="mb-0 small">{{ $companyPhone !== '' ? $companyPhone : '—' }}</p>
        </div>
        <div class="col-6 text-end">
            <p class="fw-semibold mb-2">To</p>
            <h4 class="pdf-company-h">{{ $q->customer_name ?: '—' }}</h4>
            @if ($customerAddr !== '')
            <p class="text-muted small mb-1">{{ $customerAddr }}</p>
            @endif
            @if ($customerEmail !== '')
            <p class="mb-1 small">{{ $customerEmail }}</p>
            @endif
            @if ($customerPhone !== '')
            <p class="mb-2 small">{{ $customerPhone }}</p>
            @endif
            <p class="fw-medium mb-0 small pdf-quote-dates">Quote date : <span>{{ $quotedAt }}</span><span class="text-muted">&nbsp;&middot;&nbsp;</span>Valid until : <span>{{ $expiresAt }}</span></p>
        </div>
    </div>

    <div class="quotation-title-block">
        <h4>Quotation for : {{ trim($q->quote_title ?? '') ?: '—' }}</h4>
    </div>

    <table class="items">
        <thead>
        <tr>
            <th class="text-center" style="width:4%;">#</th>
            <th class="items-th-strong">Item</th>
            <th class="text-end items-th-strong" style="width:11%;">Qty</th>
            <th class="text-end items-th-strong" style="width:15%;">Rate</th>
            <th class="text-end items-th-strong" style="width:15%;">Amount</th>
        </tr>
        </thead>
        <tbody>
        @foreach ($vm['rows'] as $r)
            <tr>
                <td class="text-center fw-medium">{{ $loop->iteration }}</td>
                <td>
                    <h6>{{ $r['title'] }}</h6>
                    @if ($r['desc'] !== '')
                        <p class="text-muted small mb-0">{{ $r['desc'] }}</p>
                    @endif
                </td>
                <td class="text-end fw-medium">{{ number_format($r['qty'], 2) }}</td>
                <td class="text-end fw-medium">Ksh{{ number_format($r['unit'], 2) }}</td>
                <td class="text-end fw-medium">Ksh{{ number_format($r['lineTotal'], 2) }}</td>
            </tr>
        @endforeach
        </tbody>
        <tfoot class="items-totals">
        <tr>
            <td colspan="3"></td>
            <td class="text-end totals-amt">Sub Total</td>
            <td class="text-end totals-amt">Ksh{{ number_format($vm['subEx'], 2) }}</td>
        </tr>
        @if ($vm['dtype'] !== 'none')
        <tr>
            <td colspan="3"></td>
            <td class="text-end totals-amt">{{ $vm['discountLabel'] }}</td>
            <td class="text-end totals-amt">−Ksh{{ number_format($vm['discountAmt'], 2) }}</td>
        </tr>
        @endif
        <tr>
            <td colspan="3"></td>
            <td class="text-end totals-amt">Tax</td>
            <td class="text-end totals-amt">Ksh{{ number_format($vm['taxAmt'], 2) }}</td>
        </tr>
        <tr class="totals-grand">
            <td colspan="3"></td>
            <td class="text-end">Total</td>
            <td class="text-end">Ksh{{ number_format($vm['grandTotal'], 2) }}</td>
        </tr>
        </tfoot>
    </table>

    @php
        $termsPdf = trim((string) ($q->terms_and_conditions ?? ''));
        $clientPdf = trim((string) ($q->client_note ?? ''));
        $hasNotesPdf = $termsPdf !== '' || $clientPdf !== '';
    @endphp
    @if ($hasNotesPdf)
    <div class="row pdf-notes-wrap">
        <div class="col-12">
            @if ($termsPdf !== '')
            <div class="notes-block">
                <h6>Terms &amp; conditions</h6>
                <p>{{ $termsPdf }}</p>
            </div>
            @endif
            @if ($clientPdf !== '')
            <div class="notes-block mb-0">
                <h6>Client note</h6>
                <p>{{ $clientPdf }}</p>
            </div>
            @endif
        </div>
    </div>
    @endif

    @php
        $footerBankCompact = trim((string) preg_replace('/\s*\R\s*/u', ' · ', trim((string) $footerBank)));
    @endphp
    <div class="footer-bank text-center">
        <p class="mb-1 small">{{ $footerPayment }}</p>
        <p class="mb-1 small">{{ $footerBankCompact }}</p>
        <p class="text-muted small mb-0">{{ $footerClosing }}</p>
    </div>
</div>
</body>
</html>
