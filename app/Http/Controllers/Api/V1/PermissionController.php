<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Permission;
use Illuminate\Http\JsonResponse;

class PermissionController extends Controller
{
    public function index(): JsonResponse
    {
        $rows = Permission::query()->orderBy('slug')->get(['id', 'slug', 'name']);

        return response()->json([
            'success' => true,
            'message' => 'Permissions retrieved.',
            'data' => ['permissions' => $rows],
        ]);
    }
}
