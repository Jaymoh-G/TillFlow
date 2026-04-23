<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Tenant;
use App\Services\Search\GlobalSearchService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class GlobalSearchController extends Controller
{
    public function __construct(
        private readonly GlobalSearchService $globalSearch
    ) {}

    public function __invoke(Request $request): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');

        $validated = $request->validate([
            'q' => ['required', 'string', 'min:2', 'max:120'],
            'entities' => ['sometimes', 'array'],
            'entities.*' => ['string', Rule::in(GlobalSearchService::ENTITY_TYPES)],
            'limit' => ['sometimes', 'integer', 'min:1', 'max:15'],
        ]);

        $user = $request->user();
        if (! $user) {
            abort(401);
        }

        $entityTypes = isset($validated['entities']) && is_array($validated['entities'])
            ? array_values(array_unique(array_map('strval', $validated['entities'])))
            : [];

        $limit = isset($validated['limit']) ? (int) $validated['limit'] : 5;

        $payload = $this->globalSearch->search(
            $user,
            $tenant,
            trim((string) $validated['q']),
            $entityTypes,
            $limit
        );

        return response()->json([
            'success' => true,
            'message' => 'Search results.',
            'data' => $payload,
        ]);
    }
}
