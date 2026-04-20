<?php

use App\Http\Controllers\CustomerDocumentPublicViewController;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Route;

/** Signed link opened from customer email — tracks first view for staff notifications. */
Route::get('/v/{tenant}/{type}/{id}', [CustomerDocumentPublicViewController::class, 'show'])
    ->whereNumber('tenant')
    ->whereNumber('id')
    ->whereIn('type', ['invoice', 'quotation', 'proposal'])
    ->middleware('signed')
    ->name('customer.document.view');

$spaFromDisk = static function () {
    $path = public_path('spa/index.html');
    if (! File::exists($path)) {
        abort(503, 'SPA bundle missing. Run npm run build and deploy public/spa and public/assets.');
    }

    return response()->make(File::get($path), 200, [
        'Content-Type' => 'text/html; charset=UTF-8',
    ]);
};

Route::get('/', $spaFromDisk);

Route::get('/{path}', $spaFromDisk)
    ->where('path', '^(?!api(?:/|$)|up$|sanctum(?:/|$)).*$');
