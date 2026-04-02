<?php

use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\BrandController;
use App\Http\Controllers\Api\V1\CategoryController;
use App\Http\Controllers\Api\V1\ExpiredItemsReportController;
use App\Http\Controllers\Api\V1\LowStockReportController;
use App\Http\Controllers\Api\V1\ProductController;
use App\Http\Controllers\Api\V1\SystemHealthController;
use App\Http\Controllers\Api\V1\UnitController;
use App\Http\Controllers\Api\V1\VariantAttributeController;
use App\Http\Controllers\Api\V1\WarrantyController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function (): void {
    Route::get('/health', [SystemHealthController::class, 'health']);
    Route::get('/ready', [SystemHealthController::class, 'ready']);

    Route::post('/auth/login', [AuthController::class, 'login']);

    Route::middleware(['auth:sanctum', 'tenant.context'])->group(function (): void {
        Route::get('/auth/me', [AuthController::class, 'me']);
        Route::post('/auth/logout', [AuthController::class, 'logout']);

        Route::middleware(['permission:catalog.manage'])->group(function (): void {
            Route::get('/categories/trashed', [CategoryController::class, 'trashed']);
            Route::get('/categories', [CategoryController::class, 'index']);
            Route::post('/categories', [CategoryController::class, 'store']);
            Route::post('/categories/{category}/restore', [CategoryController::class, 'restore'])->whereNumber('category');
            Route::get('/categories/{category}', [CategoryController::class, 'show'])->whereNumber('category');
            Route::put('/categories/{category}', [CategoryController::class, 'update'])->whereNumber('category');
            Route::patch('/categories/{category}', [CategoryController::class, 'update'])->whereNumber('category');
            Route::delete('/categories/{category}', [CategoryController::class, 'destroy'])->whereNumber('category');

            Route::get('/brands/trashed', [BrandController::class, 'trashed']);
            Route::get('/brands', [BrandController::class, 'index']);
            Route::post('/brands', [BrandController::class, 'store']);
            Route::post('/brands/{brand}/restore', [BrandController::class, 'restore'])->whereNumber('brand');
            Route::get('/brands/{brand}', [BrandController::class, 'show'])->whereNumber('brand');
            Route::put('/brands/{brand}', [BrandController::class, 'update'])->whereNumber('brand');
            Route::patch('/brands/{brand}', [BrandController::class, 'update'])->whereNumber('brand');
            Route::delete('/brands/{brand}', [BrandController::class, 'destroy'])->whereNumber('brand');

            Route::get('/units/trashed', [UnitController::class, 'trashed']);
            Route::get('/units', [UnitController::class, 'index']);
            Route::post('/units', [UnitController::class, 'store']);
            Route::post('/units/{unit}/restore', [UnitController::class, 'restore'])->whereNumber('unit');
            Route::get('/units/{unit}', [UnitController::class, 'show'])->whereNumber('unit');
            Route::put('/units/{unit}', [UnitController::class, 'update'])->whereNumber('unit');
            Route::patch('/units/{unit}', [UnitController::class, 'update'])->whereNumber('unit');
            Route::delete('/units/{unit}', [UnitController::class, 'destroy'])->whereNumber('unit');

            Route::get('/variant-attributes/trashed', [VariantAttributeController::class, 'trashed']);
            Route::get('/variant-attributes', [VariantAttributeController::class, 'index']);
            Route::post('/variant-attributes', [VariantAttributeController::class, 'store']);
            Route::post('/variant-attributes/{attribute}/restore', [VariantAttributeController::class, 'restore'])->whereNumber('attribute');
            Route::get('/variant-attributes/{attribute}', [VariantAttributeController::class, 'show'])->whereNumber('attribute');
            Route::put('/variant-attributes/{attribute}', [VariantAttributeController::class, 'update'])->whereNumber('attribute');
            Route::patch('/variant-attributes/{attribute}', [VariantAttributeController::class, 'update'])->whereNumber('attribute');
            Route::delete('/variant-attributes/{attribute}', [VariantAttributeController::class, 'destroy'])->whereNumber('attribute');

            Route::get('/warranties/trashed', [WarrantyController::class, 'trashed']);
            Route::get('/warranties', [WarrantyController::class, 'index']);
            Route::post('/warranties', [WarrantyController::class, 'store']);
            Route::post('/warranties/{warranty}/restore', [WarrantyController::class, 'restore'])->whereNumber('warranty');
            Route::get('/warranties/{warranty}', [WarrantyController::class, 'show'])->whereNumber('warranty');
            Route::put('/warranties/{warranty}', [WarrantyController::class, 'update'])->whereNumber('warranty');
            Route::patch('/warranties/{warranty}', [WarrantyController::class, 'update'])->whereNumber('warranty');
            Route::delete('/warranties/{warranty}', [WarrantyController::class, 'destroy'])->whereNumber('warranty');

            Route::get('/products/trashed', [ProductController::class, 'trashed']);
            Route::get('/products', [ProductController::class, 'index']);
            Route::post('/products', [ProductController::class, 'store']);
            Route::post('/products/{product}/restore', [ProductController::class, 'restore'])->whereNumber('product');
            Route::get('/products/{product}', [ProductController::class, 'show'])->whereNumber('product');
            Route::put('/products/{product}', [ProductController::class, 'update'])->whereNumber('product');
            Route::patch('/products/{product}', [ProductController::class, 'update'])->whereNumber('product');
            Route::post('/products/{product}/variants/{variant}/image', [ProductController::class, 'uploadVariantImage'])->whereNumber(['product', 'variant']);
            Route::delete('/products/{product}', [ProductController::class, 'destroy'])->whereNumber('product');
        });

        Route::middleware(['permission:reports.view'])->group(function (): void {
            Route::get('/reports/low-stock', [LowStockReportController::class, 'index']);
            Route::get('/reports/expired-items', [ExpiredItemsReportController::class, 'index']);
        });
    });
});
