<?php

use App\Http\Middleware\ApiResponseMiddleware;
use App\Http\Middleware\EnsurePermission;
use App\Http\Middleware\TenantContextMiddleware;
use App\Support\ApiEnvelope;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->api(append: [
            ApiResponseMiddleware::class,
        ]);

        $middleware->alias([
            'tenant.context' => TenantContextMiddleware::class,
            'permission' => EnsurePermission::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->render(function (ValidationException $e, Request $request) {
            if (! $request->is('api/*')) {
                return null;
            }

            return ApiEnvelope::json(
                false,
                $e->getMessage() ?: 'The given data was invalid.',
                ['errors' => $e->errors()],
                $e->status
            );
        });

        $exceptions->render(function (AuthenticationException $e, Request $request) {
            if (! $request->is('api/*')) {
                return null;
            }

            return ApiEnvelope::json(
                false,
                $e->getMessage() ?: 'Unauthenticated.',
                null,
                401
            );
        });

        $exceptions->render(function (AuthorizationException $e, Request $request) {
            if (! $request->is('api/*')) {
                return null;
            }

            return ApiEnvelope::json(
                false,
                $e->getMessage() ?: 'This action is unauthorized.',
                null,
                $e->status() ?? 403
            );
        });

        $exceptions->render(function (NotFoundHttpException $e, Request $request) {
            if (! $request->is('api/*')) {
                return null;
            }

            return ApiEnvelope::json(
                false,
                $e->getMessage() ?: 'Not found.',
                null,
                $e->getStatusCode()
            );
        });

        $exceptions->render(function (HttpExceptionInterface $e, Request $request) {
            if (! $request->is('api/*')) {
                return null;
            }

            return ApiEnvelope::json(
                false,
                $e->getMessage() ?: 'Request could not be processed.',
                null,
                $e->getStatusCode()
            );
        });

        $exceptions->render(function (Throwable $e, Request $request) {
            if (! $request->is('api/*')) {
                return null;
            }

            if ($e instanceof ValidationException
                || $e instanceof AuthenticationException
                || $e instanceof AuthorizationException
                || $e instanceof NotFoundHttpException
                || $e instanceof HttpExceptionInterface) {
                return null;
            }

            report($e);

            return ApiEnvelope::json(
                false,
                config('app.debug') ? $e->getMessage() : 'Server error.',
                config('app.debug') ? ['exception' => class_basename($e::class)] : null,
                500
            );
        });
    })->create();
