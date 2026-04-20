<?php

namespace App\Services\Mpesa;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class MpesaDarajaService
{
    public function baseUrl(): string
    {
        $env = (string) config('mpesa.environment');
        $urls = config('mpesa.base_urls');

        return (string) ($urls[$env] ?? $urls['sandbox']);
    }

    /**
     * @throws ConnectionException
     */
    public function getAccessToken(): string
    {
        $key = (string) config('mpesa.consumer_key');
        $secret = (string) config('mpesa.consumer_secret');
        $url = $this->baseUrl().'/oauth/v1/generate?grant_type=client_credentials';

        $res = Http::withBasicAuth($key, $secret)
            ->timeout(30)
            ->acceptJson()
            ->get($url);

        if (! $res->successful()) {
            Log::error('M-Pesa OAuth failed', ['body' => $res->body(), 'status' => $res->status()]);

            throw new \RuntimeException('M-Pesa OAuth failed.');
        }

        $token = $res->json('access_token');
        if (! is_string($token) || $token === '') {
            throw new \RuntimeException('M-Pesa OAuth returned no access_token.');
        }

        return $token;
    }

    /**
     * @return array<string, mixed>
     */
    public function lipaNaMpesaOnline(
        string $phoneDigits,
        float $amount,
        string $accountReference,
        string $transactionDesc
    ): array {
        $token = $this->getAccessToken();
        $timestamp = now()->format('YmdHis');
        $shortcode = (string) config('mpesa.shortcode');
        $passkey = (string) config('mpesa.passkey');
        $password = base64_encode($shortcode.$passkey.$timestamp);
        $appUrl = rtrim((string) config('app.url'), '/');
        $callbackPath = (string) config('mpesa.stk_callback_path');
        $callback = $appUrl.$callbackPath;

        $phone = $this->normalizeMsisdn($phoneDigits);

        $payload = [
            'BusinessShortCode' => (int) $shortcode,
            'Password' => $password,
            'Timestamp' => $timestamp,
            'TransactionType' => (string) config('mpesa.transaction_type'),
            'Amount' => round($amount, 0),
            'PartyA' => $phone,
            'PartyB' => (int) $shortcode,
            'PhoneNumber' => $phone,
            'CallBackURL' => $callback,
            'AccountReference' => Str::limit(preg_replace('/\s+/', '-', $accountReference), 12, ''),
            'TransactionDesc' => Str::limit($transactionDesc, 13, ''),
        ];

        $url = $this->baseUrl().'/mpesa/stkpush/v1/processrequest';

        $res = Http::withToken($token)
            ->timeout(45)
            ->acceptJson()
            ->asJson()
            ->post($url, $payload);

        $json = $res->json() ?? [];

        if (! $res->successful()) {
            Log::error('M-Pesa STK push failed', ['body' => $res->body(), 'status' => $res->status()]);
            throw new \RuntimeException((string) ($json['errorMessage'] ?? $res->body() ?: 'STK push failed'));
        }

        return is_array($json) ? $json : [];
    }

    private function normalizeMsisdn(string $raw): int
    {
        $digits = preg_replace('/\D+/', '', $raw) ?? '';
        if (str_starts_with($digits, '0')) {
            $digits = '254'.substr($digits, 1);
        }
        if (str_starts_with($digits, '7') && strlen($digits) === 9) {
            $digits = '254'.$digits;
        }

        return (int) $digits;
    }
}
