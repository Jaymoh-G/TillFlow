<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{ $title ?? 'Document' }}</title>
</head>
<body style="font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; line-height: 1.5; color: #222; max-width: 28rem; margin: 0 auto; padding: 2rem;">
    <h1 style="font-size: 1.25rem; font-weight: 600;">{{ $heading ?? 'Thank you' }}</h1>
    <p style="color: #444;">{{ $line ?? '' }}</p>
</body>
</html>
