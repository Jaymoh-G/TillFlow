<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Tenant;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TenantUiSettingsController extends Controller
{
    private const MAX_JSON_BYTES = 524288;

    public function show(Request $request): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');

        return response()->json([
            'message' => 'UI settings retrieved.',
            'settings' => $tenant->ui_settings ?? [],
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');

        $validated = $request->validate([
            'merge' => ['required', 'array'],
            'merge.website' => ['sometimes', 'array'],
            'merge.app' => ['sometimes', 'array'],
            'merge.system' => ['sometimes', 'array'],
            'merge.notifications' => ['sometimes', 'array'],
        ]);

        $current = is_array($tenant->ui_settings) ? $tenant->ui_settings : [];
        $merged = $this->deepMerge($current, $validated['merge']);
        $this->assertWithinSizeLimit($merged);

        $tenant->ui_settings = $merged;
        $tenant->save();

        return response()->json([
            'message' => 'UI settings updated.',
            'settings' => $merged,
        ]);
    }

    /**
     * @param  array<string, mixed>  $base
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    private function deepMerge(array $base, array $overrides): array
    {
        foreach ($overrides as $key => $value) {
            if (is_array($value) && isset($base[$key]) && is_array($base[$key])) {
                $base[$key] = $this->deepMerge($base[$key], $value);
            } else {
                $base[$key] = $value;
            }
        }

        return $base;
    }

    /**
     * @param  array<string, mixed>  $settings
     */
    private function assertWithinSizeLimit(array $settings): void
    {
        $encoded = json_encode($settings);
        if ($encoded === false || strlen($encoded) > self::MAX_JSON_BYTES) {
            abort(422, 'UI settings payload too large.');
        }
    }
}
