<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Mail\TillFlowPasswordSetupMail;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function forgotPassword(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
        ]);

        /** @var User|null $user */
        $user = User::query()->where('email', $data['email'])->first();

        if ($user) {
            try {
                $user->loadMissing('tenant');
                $tenant = $user->tenant ?? Tenant::query()->find($user->tenant_id);
                if ($tenant instanceof Tenant) {
                    $plainToken = Password::broker()->createToken($user);
                    $actionUrl = $this->tillflowPasswordSetupUrl($user->email, $plainToken);
                    Mail::to($user->email)->send(new TillFlowPasswordSetupMail($user, $tenant, $actionUrl, 'reset'));
                } else {
                    report(new \RuntimeException('Password reset: user '.$user->id.' has no tenant.'));
                }
            } catch (\Throwable $e) {
                report($e);
            }
        }

        return response()->json([
            'success' => true,
            'message' => 'If that email exists, we sent a link to reset your password.',
            'data' => null,
        ]);
    }

    public function resetPassword(Request $request): JsonResponse
    {
        $request->validate([
            'token' => ['required', 'string'],
            'email' => ['required', 'email'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        $status = Password::reset(
            $request->only('email', 'password', 'password_confirmation', 'token'),
            function (User $user, string $password): void {
                $user->password = $password;
                $user->save();
            }
        );

        if ($status === Password::PASSWORD_RESET) {
            return response()->json([
                'success' => true,
                'message' => 'Password has been reset. You can sign in.',
                'data' => null,
            ]);
        }

        return response()->json([
            'success' => false,
            'message' => is_string($status) ? __($status) : 'Unable to reset password.',
        ], 422);
    }

    private function tillflowPasswordSetupUrl(string $email, string $plainToken): string
    {
        $base = (string) config('tillflow.frontend_url');
        $path = '/tillflow/invite/accept';

        return $base.$path.'?'.http_build_query([
            'token' => $plainToken,
            'email' => $email,
        ]);
    }

    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
            'device_name' => ['nullable', 'string', 'max:255'],
        ]);

        /** @var User|null $user */
        $user = User::query()->where('email', $data['email'])->first();

        $storedHash = $this->storedPasswordHash($user);
        if (! $user || $storedHash === null || ! Hash::check($data['password'], $storedHash)) {
            throw ValidationException::withMessages([
                'email' => ['The provided credentials are incorrect.'],
            ]);
        }

        $user->tokens()->delete();

        $device = $data['device_name'] ?? 'tillflow-web';
        $token = $user->createToken($device)->plainTextToken;

        return response()->json([
            'success' => true,
            'message' => 'Logged in.',
            'data' => [
                'token' => $token,
                'user' => $this->serializeUser($user->fresh()),
            ],
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        $user = $request->user();
        assert($user instanceof User);

        return response()->json([
            'success' => true,
            'message' => 'Profile loaded.',
            'data' => [
                'user' => $this->serializeUser($user),
            ],
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()?->currentAccessToken()?->delete();

        return response()->json([
            'success' => true,
            'message' => 'Logged out.',
            'data' => null,
        ]);
    }

    public function updateProfile(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        if ($request->hasFile('avatar')) {
            $request->validate([
                'name' => ['sometimes', 'string', 'max:255'],
                'email' => ['sometimes', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
                'phone' => ['nullable', 'string', 'max:100'],
                'address_line' => ['nullable', 'string', 'max:500'],
                'location' => ['nullable', 'string', 'max:500'],
                'avatar' => ['required', 'file', 'image', 'max:5120'],
            ]);

            $path = $request->file('avatar')->store('avatars', 'public');
            $user->avatar_path = $path;
        } else {
            $request->validate([
                'name' => ['sometimes', 'string', 'max:255'],
                'email' => ['sometimes', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
                'phone' => ['nullable', 'string', 'max:100'],
                'address_line' => ['nullable', 'string', 'max:500'],
                'location' => ['nullable', 'string', 'max:500'],
            ]);
        }

        $user->fill($request->only(['name', 'email', 'phone', 'address_line', 'location']));
        $user->save();

        return response()->json([
            'success' => true,
            'message' => 'Profile updated.',
            'data' => [
                'user' => $this->serializeUser($user->fresh()),
            ],
        ]);
    }

    public function changePassword(Request $request): JsonResponse
    {
        $data = $request->validate([
            'current_password' => ['required', 'string'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        /** @var User $user */
        $user = $request->user();

        $storedHash = $this->storedPasswordHash($user);
        if ($storedHash === null || ! Hash::check($data['current_password'], $storedHash)) {
            throw ValidationException::withMessages([
                'current_password' => ['Current password is incorrect.'],
            ]);
        }

        $user->password = $data['password'];
        $user->save();

        return response()->json([
            'success' => true,
            'message' => 'Password changed.',
            'data' => null,
        ]);
    }

    public function sessions(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $currentId = $user->currentAccessToken()?->id;

        $sessions = $user->tokens()->orderByDesc('last_used_at')->get()->map(function ($token) use ($currentId) {
            return [
                'id' => $token->id,
                'name' => $token->name,
                'last_used_at' => $token->last_used_at?->toIso8601String(),
                'created_at' => $token->created_at?->toIso8601String(),
                'is_current' => $currentId !== null && (int) $token->id === (int) $currentId,
            ];
        });

        return response()->json([
            'success' => true,
            'message' => 'Sessions retrieved.',
            'data' => ['sessions' => $sessions],
        ]);
    }

    public function revokeSession(Request $request, int $session): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $deleted = $user->tokens()->whereKey($session)->delete();

        if (! $deleted) {
            return response()->json([
                'success' => false,
                'message' => 'Session not found.',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'message' => 'Session revoked.',
            'data' => null,
        ]);
    }

    /**
     * Bcrypt hash as persisted (bypasses the `hashed` cast on read so Hash::check receives the real stored value).
     */
    private function storedPasswordHash(?User $user): ?string
    {
        if ($user === null) {
            return null;
        }

        $h = $user->getRawOriginal('password');
        if (! is_string($h) || $h === '') {
            return null;
        }

        return $h;
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeUser(User $user): array
    {
        $user->loadMissing('roles.permissions', 'tenant');

        $avatarUrl = null;
        if ($user->avatar_path) {
            $avatarUrl = Storage::disk('public')->url($user->avatar_path);
        }

        return [
            'id' => $user->id,
            'tenant_id' => $user->tenant_id,
            'name' => $user->name,
            'email' => $user->email,
            'phone' => $user->phone,
            'address_line' => $user->address_line,
            'location' => $user->location,
            'avatar_url' => $avatarUrl,
            'permissions' => $user->permissionSlugs(),
            'roles' => $user->roles->map(fn ($r) => [
                'id' => $r->id,
                'slug' => $r->slug,
                'name' => $r->name,
            ])->values(),
        ];
    }
}
