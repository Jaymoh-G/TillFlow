<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\Tenant;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ExpiredItemsReportController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');

        $scope = $request->query('scope', 'expired');
        if (! in_array($scope, ['expired', 'expiring'], true)) {
            $scope = 'expired';
        }

        $days = (int) $request->query('days', 30);
        if ($days < 1) {
            $days = 1;
        }
        if ($days > 366) {
            $days = 366;
        }

        $today = Carbon::today();

        $query = Product::query()
            ->where('tenant_id', $tenant->id)
            ->whereNull('deleted_at')
            ->whereNotNull('expires_at')
            ->with([
                'category:id,name',
                'brand:id,name,logo_url',
                'unit:id,name,short_name',
            ]);

        if ($scope === 'expired') {
            $query->whereDate('expires_at', '<', $today)->orderBy('expires_at');
        } else {
            $until = $today->copy()->addDays($days);
            $query
                ->whereDate('expires_at', '>=', $today)
                ->whereDate('expires_at', '<=', $until)
                ->orderBy('expires_at');
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
            'manufactured_at',
            'expires_at',
            'created_at',
            'updated_at',
        ]);

        return response()->json([
            'message' => 'Expired items report retrieved.',
            'items' => $rows->map(function (Product $p): array {
                return $p->only([
                    'id',
                    'name',
                    'sku',
                    'qty',
                    'qty_alert',
                    'manufactured_at',
                    'expires_at',
                    'category_id',
                    'brand_id',
                    'unit_id',
                    'created_at',
                    'updated_at',
                ])
                    + [
                        'category' => $p->category ? $p->category->only(['id', 'name']) : null,
                        'brand' => $p->brand ? $p->brand->only(['id', 'name', 'logo_url']) : null,
                        'unit' => $p->unit ? $p->unit->only(['id', 'name', 'short_name']) : null,
                    ];
            })->values(),
            'scope' => $scope,
            'days' => $days,
        ]);
    }
}
