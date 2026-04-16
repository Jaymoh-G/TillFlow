@php
    $tenantName = trim((string) ($tenant->name ?? '')) ?: 'your organization';
    $isInvite = ($kind ?? 'invite') === 'invite';
@endphp
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TillFlow</title>
</head>
<body style="margin:0;padding:24px;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111827;font-size:15px;line-height:1.45;">
    <div style="max-width:520px;margin:0 auto;padding:28px;background:#ffffff;border-radius:8px;border:1px solid #e5e7eb;">
        @if($isInvite)
            <p style="margin:0 0 12px;">Hello {{ $user->name }},</p>
            <p style="margin:0 0 12px;">
                You have been invited to join <strong>{{ $tenantName }}</strong> on TillFlow.
            </p>
            <p style="margin:0 0 20px;">Use the button below to set your password and sign in.</p>
        @else
            <p style="margin:0 0 12px;">Hello {{ $user->name }},</p>
            <p style="margin:0 0 20px;">We received a request to reset your TillFlow password.</p>
        @endif

        <p style="margin:0 0 24px;">
            <a href="{{ $actionUrl }}" style="display:inline-block;padding:12px 20px;background:#111827;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">
                {{ $isInvite ? 'Accept invitation' : 'Set new password' }}
            </a>
        </p>

        <p style="margin:0 0 8px;font-size:13px;color:#6b7280;">
            This link expires in about {{ (int) config('auth.passwords.users.expire', 60) }} minutes.
        </p>
        <p style="margin:0;font-size:13px;color:#6b7280;word-break:break-all;">
            If the button does not work, copy and paste this URL into your browser:<br>
            <span style="color:#374151;">{{ $actionUrl }}</span>
        </p>
    </div>
</body>
</html>
