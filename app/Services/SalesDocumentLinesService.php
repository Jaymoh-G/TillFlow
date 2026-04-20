<?php

namespace App\Services;

use App\Models\Product;
use App\Models\Tenant;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class SalesDocumentLinesService
{
    /**
     * @param  array<int, array<string, mixed>>  $items
     * @return array{rows: array<int, array<string, mixed>>, total: float}
     */
    public function buildItemRows(Tenant $tenant, array $items): array
    {
        $rows = [];
        $total = 0.0;
        foreach ($items as $position => $row) {
            $pid = $row['product_id'] ?? null;
            $hasProductId = $pid !== null && $pid !== '' && (int) $pid > 0;

            if ($hasProductId) {
                $product = $this->resolveProduct($tenant->id, (int) $pid);
                $qty = (float) $row['quantity'];
                $unit = array_key_exists('unit_price', $row) && $row['unit_price'] !== null
                    ? (float) $row['unit_price']
                    : (float) ($product->selling_price ?? 0);
                $taxPct = $this->normalizeTaxPercent($row['tax_percent'] ?? null);
                $lineTotal = $this->lineTotalWithTax($qty, $unit, $taxPct);
                $total += $lineTotal;
                $rows[] = [
                    'product_id' => $product->id,
                    'product_name' => $product->name,
                    'product_image_url' => $this->firstProductImagePublicUrl($product),
                    'description' => $this->normalizeItemDescription($row['description'] ?? null),
                    'quantity' => $qty,
                    'unit_price' => $unit,
                    'tax_percent' => $taxPct,
                    'line_total' => $lineTotal,
                    'position' => (int) $position,
                ];

                continue;
            }

            $name = trim((string) ($row['product_name'] ?? ''));
            if ($name === '') {
                throw ValidationException::withMessages([
                    'items' => 'Each line must either use a catalog product or include a custom item description.',
                ]);
            }
            $qty = (float) $row['quantity'];
            $unit = array_key_exists('unit_price', $row) && $row['unit_price'] !== null
                ? (float) $row['unit_price']
                : 0.0;
            $taxPct = $this->normalizeTaxPercent($row['tax_percent'] ?? null);
            $lineTotal = $this->lineTotalWithTax($qty, $unit, $taxPct);
            $total += $lineTotal;
            $rows[] = [
                'product_id' => null,
                'product_name' => $name,
                'product_image_url' => null,
                'description' => $this->normalizeItemDescription($row['description'] ?? null),
                'quantity' => $qty,
                'unit_price' => $unit,
                'tax_percent' => $taxPct,
                'line_total' => $lineTotal,
                'position' => (int) $position,
            ];
        }

        return ['rows' => $rows, 'total' => round($total, 2)];
    }

    /**
     * @return array{0: string, 1: string, 2: float|null}
     */
    public function normalizeDiscountFields(mixed $discountType, mixed $discountBasis, mixed $discountValue): array
    {
        $dt = $discountType === null || $discountType === '' ? 'none' : (string) $discountType;
        if (! in_array($dt, ['none', 'before_tax', 'after_tax'], true)) {
            $dt = 'none';
        }
        if ($dt === 'none') {
            return ['none', 'percent', null];
        }
        $db = $discountBasis === null || $discountBasis === '' ? 'percent' : (string) $discountBasis;
        if (! in_array($db, ['percent', 'fixed'], true)) {
            $db = 'percent';
        }
        if ($discountValue === null || $discountValue === '') {
            $dv = 0.0;
        } else {
            $dv = (float) $discountValue;
        }
        if ($dv < 0) {
            throw ValidationException::withMessages(['discount_value' => 'Discount value cannot be negative.']);
        }
        if ($db === 'percent' && $dv > 100) {
            throw ValidationException::withMessages(['discount_value' => 'Percent discount cannot exceed 100.']);
        }

        return [$dt, $db, round($dv, 2)];
    }

    public function firstProductImagePublicUrl(Product $product): ?string
    {
        foreach ($product->variants as $variant) {
            if ($variant->image_path) {
                return Storage::disk('public')->url($variant->image_path);
            }
        }

        return null;
    }

    public function normalizeTaxPercent(mixed $value): float
    {
        if ($value === null || $value === '') {
            return 0.0;
        }
        $n = (float) $value;
        if ($n < 0) {
            return 0.0;
        }
        if ($n > 100) {
            return 100.0;
        }

        return round($n, 2);
    }

    public function lineTotalWithTax(float $qty, float $unit, float $taxPercent): float
    {
        $subtotal = round($qty * $unit, 2);

        return round($subtotal * (1 + $taxPercent / 100), 2);
    }

    public function normalizeItemDescription(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }
        $s = trim((string) $value);

        return $s === '' ? null : $s;
    }

    private function resolveProduct(int $tenantId, int $productId): Product
    {
        return Product::query()
            ->where('tenant_id', $tenantId)
            ->whereKey($productId)
            ->with(['variants' => fn ($q) => $q->orderBy('id')])
            ->firstOrFail();
    }
}
