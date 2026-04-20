<?php

namespace App\Services;

use App\Models\Proposal;
use App\Models\Quotation;
use App\Models\Tenant;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Schema;

class SalesDocumentPdfService
{
    /**
     * @return array{rows: list<array<string, mixed>>, subEx: float, taxAmt: float, discountAmt: float, discountLabel: string, grandTotal: float, dtype: string}
     */
    public function pdfViewModelFromQuotable(object $q): array
    {
        $q->loadMissing(['items' => fn ($r) => $r->orderBy('position')]);
        $items = $q->items;
        $rows = [];
        if ($items->isEmpty()) {
            $total = (float) $q->total_amount;
            $title = trim((string) ($q->quote_title ?? $q->proposal_title ?? ''));
            if ($title === '') {
                $title = '—';
            }
            $rows[] = [
                'title' => $title,
                'desc' => '',
                'qty' => 1.0,
                'unit' => $total,
                'disc' => 0.0,
                'lineTotal' => $total,
                'taxP' => 0.0,
            ];
        } else {
            foreach ($items as $item) {
                $qty = (float) ($item->quantity ?? 1);
                $unit = (float) ($item->unit_price ?? 0);
                $taxP = (float) ($item->tax_percent ?? 0);
                if ($taxP < 0 || ! is_finite($taxP)) {
                    $taxP = 0.0;
                }
                $sub = round($qty * $unit, 2);
                $lt = $item->line_total !== null
                    ? (float) $item->line_total
                    : round($sub * (1 + $taxP / 100), 2);
                $rows[] = [
                    'title' => (string) ($item->product_name ?? '—'),
                    'desc' => trim((string) ($item->description ?? '')),
                    'qty' => $qty,
                    'unit' => $unit,
                    'disc' => 0.0,
                    'lineTotal' => $lt,
                    'taxP' => $taxP,
                ];
            }
        }
        $subEx = 0.0;
        $taxAmt = 0.0;
        foreach ($rows as $r) {
            $sub = round($r['qty'] * $r['unit'], 2);
            $subEx += $sub;
            $taxAmt += round($sub * ($r['taxP'] / 100), 2);
        }
        $subEx = round($subEx, 2);
        $taxAmt = round($taxAmt, 2);
        $dtype = (string) ($q->discount_type ?? 'none');
        $basis = ($q->discount_basis === 'fixed') ? 'fixed' : 'percent';
        $valStr = $q->discount_value ?? '0';
        $discountAmt = 0.0;
        $discountLabel = 'Discount';
        if ($dtype !== 'none') {
            if ($basis === 'fixed') {
                $discountAmt = round($this->parseDiscountValueFixedForPdf($valStr), 2);
            } else {
                $p = $this->parseDiscountPercentForPdf($valStr);
                $discountAmt = round($subEx * ($p / 100), 2);
                $discountLabel = 'Discount ('.$p.'%)';
            }
        }
        $grandTotal = round((float) $q->total_amount, 2);

        return [
            'rows' => $rows,
            'subEx' => $subEx,
            'taxAmt' => $taxAmt,
            'discountAmt' => $discountAmt,
            'discountLabel' => $discountLabel,
            'grandTotal' => $grandTotal,
            'dtype' => $dtype,
        ];
    }

    public function renderQuotationPdfBinary(Tenant $tenant, Quotation $q): string
    {
        $tenant = $tenant->fresh();
        $vm = $this->pdfViewModelFromQuotable($q);
        $q->loadMissing('customer');
        $customer = $q->customer;
        $quotedAt = $q->quoted_at ? $q->quoted_at->format('j M Y') : '—';
        $expiresAt = $q->expires_at ? $q->expires_at->format('j M Y') : '—';

        $customerEmail = ($customer && trim((string) ($customer->email ?? '')) !== '')
            ? trim((string) $customer->email) : '';
        $customerPhone = ($customer && trim((string) ($customer->phone ?? '')) !== '')
            ? trim((string) $customer->phone) : '';
        $customerAddr = ($customer && trim((string) ($customer->location ?? '')) !== '')
            ? trim((string) $customer->location) : '';

        return $this->renderHtmlToPdf($tenant, $q, $vm, $quotedAt, $expiresAt, $customerEmail, $customerPhone, $customerAddr, 'QUOTATION', 'Quotation for');
    }

    public function renderProposalPdfBinary(Tenant $tenant, Proposal $p): string
    {
        $tenant = $tenant->fresh();
        $vm = $this->pdfViewModelFromQuotable($p);
        $p->loadMissing(['lead', 'customer']);
        $quotedAt = $p->proposed_at ? $p->proposed_at->format('j M Y') : '—';
        $expiresAt = $p->expires_at ? $p->expires_at->format('j M Y') : '—';

        $customerEmail = '';
        $customerPhone = '';
        $customerAddr = '';
        if ($p->customer_id && $p->customer) {
            $c = $p->customer;
            $customerEmail = trim((string) ($c->email ?? ''));
            $customerPhone = trim((string) ($c->phone ?? ''));
            $customerAddr = trim((string) ($c->location ?? ''));
        } elseif ($p->lead_id && $p->lead) {
            $l = $p->lead;
            $customerEmail = trim((string) ($l->email ?? ''));
            $customerPhone = trim((string) ($l->phone ?? ''));
            $customerAddr = trim((string) ($l->location ?? ''));
        }

        return $this->renderHtmlToPdf($tenant, $p, $vm, $quotedAt, $expiresAt, $customerEmail, $customerPhone, $customerAddr, 'PROPOSAL', 'Proposal for');
    }

    /**
     * @param  array{rows: list<array<string, mixed>>, subEx: float, taxAmt: float, discountAmt: float, discountLabel: string, grandTotal: float, dtype: string}  $vm
     */
    private function renderHtmlToPdf(
        Tenant $tenant,
        object $q,
        array $vm,
        string $quotedAt,
        string $expiresAt,
        string $customerEmail,
        string $customerPhone,
        string $customerAddr,
        string $pdfHeading,
        string $pdfSubjectLabel,
    ): string {
        $companyName = trim((string) ($tenant->name ?? ''));
        $companyAddr = trim((string) ($tenant->company_address_line ?? ''));
        $companyWebsite = trim((string) ($tenant->company_website ?? ''));
        $companyWebsiteHref = '';
        if ($companyWebsite !== '') {
            $companyWebsiteHref = preg_match('#^https?://#i', $companyWebsite) ? $companyWebsite : 'https://'.$companyWebsite;
        }
        $companyEmail = trim((string) ($tenant->company_email ?? ''));
        $companyPhone = trim((string) ($tenant->company_phone ?? ''));

        $footer = $this->resolveQuotationFooterLines($tenant);

        $companyLogoSrc = $this->resolveQuotationPdfCompanyLogoSrc($tenant);

        $pdfRef = $q instanceof Quotation ? $q->quote_ref : $q->proposal_ref;

        $html = view('pdf.quotation-detail', [
            'q' => $q,
            'vm' => $vm,
            'quotedAt' => $quotedAt,
            'expiresAt' => $expiresAt,
            'companyName' => $companyName,
            'companyAddr' => $companyAddr,
            'companyWebsite' => $companyWebsite,
            'companyWebsiteHref' => $companyWebsiteHref,
            'companyLogoSrc' => $companyLogoSrc,
            'companyEmail' => $companyEmail,
            'companyPhone' => $companyPhone,
            'customerEmail' => $customerEmail,
            'customerPhone' => $customerPhone,
            'customerAddr' => $customerAddr,
            'footerPayment' => $footer['payment'],
            'footerBank' => $footer['bank'],
            'footerClosing' => $footer['closing'],
            'pdfHeading' => $pdfHeading,
            'pdfRef' => $pdfRef,
            'pdfSubjectLabel' => $pdfSubjectLabel,
        ])->render();

        $chroot = realpath(public_path()) ?: public_path();

        return Pdf::loadHTML($html)
            ->setPaper('a4')
            ->setOptions([
                'isRemoteEnabled' => true,
                'isHtml5ParserEnabled' => true,
                'chroot' => $chroot,
            ])
            ->output();
    }

    private function parseDiscountPercentForPdf(mixed $raw): float
    {
        $x = (float) preg_replace('/[^0-9.-]/', '', (string) ($raw ?? '0'));
        if (! is_finite($x) || $x < 0) {
            return 0.0;
        }
        if ($x > 100) {
            return 100.0;
        }

        return round($x, 2);
    }

    private function parseDiscountValueFixedForPdf(mixed $raw): float
    {
        $x = (float) preg_replace('/[^0-9.-]/', '', (string) ($raw ?? '0'));
        if (! is_finite($x) || $x < 0) {
            return 0.0;
        }

        return round($x, 2);
    }

    /**
     * Logo for Dompdf: prefer data URI from public disk; else absolute URL (requires isRemoteEnabled).
     */
    private function resolveQuotationPdfCompanyLogoSrc(Tenant $tenant): ?string
    {
        $raw = Arr::get($tenant->ui_settings ?? [], 'website.companyLogos.logo');
        if (! is_string($raw)) {
            return null;
        }
        $raw = trim($raw);
        if ($raw === '') {
            return null;
        }
        if (str_starts_with($raw, 'data:image')) {
            return $raw;
        }
        $baseUrl = rtrim((string) config('app.url'), '/');
        if (preg_match('#^https?://#i', $raw)) {
            return $this->quotationPdfLogoUrlToDataUri($raw) ?? $raw;
        }
        if (str_starts_with($raw, '//')) {
            $scheme = parse_url($baseUrl, PHP_URL_SCHEME) ?: 'https';
            $url = $scheme.':'.$raw;

            return $this->quotationPdfLogoUrlToDataUri($url) ?? $url;
        }
        $pathPart = str_starts_with($raw, '/') ? $raw : '/'.$raw;
        $publicFile = public_path(ltrim($pathPart, '/'));
        if (is_file($publicFile) && is_readable($publicFile)) {
            return $this->quotationPdfFileToDataUri($publicFile);
        }

        $absolute = $baseUrl.$pathPart;

        return $this->quotationPdfLogoUrlToDataUri($absolute) ?? $absolute;
    }

    private function quotationPdfFileToDataUri(string $path): ?string
    {
        try {
            $bin = @file_get_contents($path);
            if ($bin === false || $bin === '') {
                return null;
            }
            $mime = @mime_content_type($path) ?: 'image/png';
            if (! is_string($mime) || $mime === '') {
                $mime = 'image/png';
            }

            return 'data:'.$mime.';base64,'.base64_encode($bin);
        } catch (\Throwable) {
            return null;
        }
    }

    private function quotationPdfLogoUrlToDataUri(string $url): ?string
    {
        try {
            $ctx = stream_context_create([
                'http' => ['timeout' => 8],
                'ssl' => ['verify_peer' => true, 'verify_peer_name' => true],
            ]);
            $bin = @file_get_contents($url, false, $ctx);
            if ($bin === false || $bin === '') {
                return null;
            }
            $mime = 'image/png';
            $lower = strtolower($url);
            if (str_contains($lower, '.jpg') || str_contains($lower, '.jpeg')) {
                $mime = 'image/jpeg';
            } elseif (str_contains($lower, '.gif')) {
                $mime = 'image/gif';
            } elseif (str_contains($lower, '.webp')) {
                $mime = 'image/webp';
            } elseif (str_contains($lower, '.svg')) {
                $mime = 'image/svg+xml';
            }

            return 'data:'.$mime.';base64,'.base64_encode($bin);
        } catch (\Throwable) {
            return null;
        }
    }

    /**
     * @return array{payment: string, bank: string, closing: string}
     */
    private function resolveQuotationFooterLines(Tenant $tenant): array
    {
        $defaults = [
            'payment' => 'Cheque to: Breezetech Management Systems Ltd',
            'bank' => 'Bank transfer to: Acc: 1286283051 · Bank: KCB Bank · SWIFT/BIC code: KCBLKENXXX · Bank code is 01',
            'closing' => 'Thank you for your interest. This quotation is valid until the date shown above.',
        ];
        if (! Schema::hasColumn('tenants', 'quotation_footer_payment_line')) {
            return $defaults;
        }
        $pay = trim((string) ($tenant->quotation_footer_payment_line ?? ''));
        $bank = trim((string) ($tenant->quotation_footer_bank_line ?? ''));
        $close = trim((string) ($tenant->quotation_footer_closing_line ?? ''));

        return [
            'payment' => $pay !== '' ? $pay : $defaults['payment'],
            'bank' => $bank !== '' ? $bank : $defaults['bank'],
            'closing' => $close !== '' ? $close : $defaults['closing'],
        ];
    }
}
