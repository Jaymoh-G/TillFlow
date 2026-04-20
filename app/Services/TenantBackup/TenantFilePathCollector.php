<?php

namespace App\Services\TenantBackup;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;

class TenantFilePathCollector
{
    /**
     * Relative paths on the `public` disk (e.g. avatars/foo.jpg).
     *
     * @return list<string>
     */
    public function collectRelativePathsForTenant(int $tenantId): array
    {
        $paths = [];

        $userAvatars = DB::table('users')
            ->where('tenant_id', $tenantId)
            ->whereNotNull('avatar_path')
            ->pluck('avatar_path');
        foreach ($userAvatars as $p) {
            $paths = array_merge($paths, $this->normalizePublicPath((string) $p));
        }

        $productImages = DB::table('products')
            ->where('tenant_id', $tenantId)
            ->whereNotNull('image_path')
            ->pluck('image_path');
        foreach ($productImages as $p) {
            $paths = array_merge($paths, $this->normalizePublicPath((string) $p));
        }

        if (Schema::hasTable('product_variants')) {
            $variantImages = DB::table('product_variants')
                ->join('products', 'products.id', '=', 'product_variants.product_id')
                ->where('products.tenant_id', $tenantId)
                ->whereNotNull('product_variants.image_path')
                ->pluck('product_variants.image_path');
            foreach ($variantImages as $p) {
                $paths = array_merge($paths, $this->normalizePublicPath((string) $p));
            }
        }

        $customerUrls = DB::table('customers')
            ->where('tenant_id', $tenantId)
            ->whereNotNull('avatar_url')
            ->pluck('avatar_url');
        foreach ($customerUrls as $url) {
            $parsed = $this->pathFromPublicUrl((string) $url);
            if ($parsed !== null) {
                $paths = array_merge($paths, $this->normalizePublicPath($parsed));
            }
        }

        return array_values(array_unique(array_filter($paths)));
    }

    /**
     * @return list<string>
     */
    private function normalizePublicPath(string $path): array
    {
        $path = str_replace('\\', '/', trim($path));
        if ($path === '') {
            return [];
        }
        $path = ltrim($path, '/');
        if (str_starts_with($path, 'storage/')) {
            $path = substr($path, strlen('storage/'));
        }

        $full = storage_path('app/public/'.$path);
        if (File::isFile($full)) {
            return [$path];
        }

        return [];
    }

    private function pathFromPublicUrl(string $url): ?string
    {
        $url = trim($url);
        if ($url === '') {
            return null;
        }
        $path = parse_url($url, PHP_URL_PATH);
        if (! is_string($path)) {
            return null;
        }
        $path = str_replace('\\', '/', $path);
        if (preg_match('#/storage/(.+)$#', $path, $m)) {
            return $m[1];
        }

        return null;
    }

    /**
     * Copy collected files into a destination directory preserving relative paths.
     *
     * @return int Number of files copied
     */
    public function copyInto(string $destinationRoot, int $tenantId): int
    {
        $relativePaths = $this->collectRelativePathsForTenant($tenantId);
        $disk = Storage::disk('public');
        $count = 0;
        foreach ($relativePaths as $rel) {
            if (! $disk->exists($rel)) {
                continue;
            }
            $source = $disk->path($rel);
            $target = $destinationRoot.DIRECTORY_SEPARATOR.str_replace('/', DIRECTORY_SEPARATOR, $rel);
            $dir = dirname($target);
            if (! File::exists($dir)) {
                File::makeDirectory($dir, 0755, true);
            }
            File::copy($source, $target);
            $count++;
        }

        return $count;
    }
}
