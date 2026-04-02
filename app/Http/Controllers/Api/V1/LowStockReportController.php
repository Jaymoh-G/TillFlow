<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\Tenant;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LowStockReportController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');

        $onlyOut = filter_var((string) $request->query('only_out', ''), FILTER_VALIDATE_BOOL);

        $query = Product::query()
            ->where('tenant_id', $tenant->id)
            ->whereNull('deleted_at')
            ->whereNotNull('qty_alert')
            ->with([
                'category:id,name',
                'brand:id,name,logo_url',
                'unit:id,name,short_name',
            ])
            ->orderBy('name');

        if ($onlyOut) {
            $query->where('qty', 0);
        } else {
            $query->whereColumn('qty', '<=', 'qty_alert');
        }

        $rows = $query->get([
            'id',
            'tenant_id',
            'category_id',
            'brand_id',
            'unit_id',
            'name',
            'sku',
            'qty',
            'qty_alert',
            'created_at',
            'updated_at',
        ]);

        return response()->json([
            'message' => 'Low stock report retrieved.',
            'items' => $rows->map(function (Product $p): array {
                return $p->only(['id', 'name', 'sku', 'qty', 'qty_alert', 'category_id', 'brand_id', 'unit_id', 'created_at', 'updated_at'])
                    + [
                        'category' => $p->category ? $p->category->only(['id', 'name']) : null,
                        'brand' => $p->brand ? $p->brand->only(['id', 'name', 'logo_url']) : null,
                        'unit' => $p->unit ? $p->unit->only(['id', 'name', 'short_name']) : null,
                    ];
            })->values(),
        ]);
    }
}

