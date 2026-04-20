<?php

namespace App\Services\Sms;

use App\Models\Tenant;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

class TenantSmsSender
{
    /**
     * @return array{provider: string, detail: string}
     */
    public function send(Tenant $tenant, string $to, string $body): array
    {
        $to = $this->normalizePhone($to);
        if ($to === '') {
            throw ValidationException::withMessages(['to' => 'Invalid phone number.']);
        }

        $gateways = $this->gateways($tenant);
        if ($gateways['twilio']['enabled'] ?? false) {
            return $this->sendTwilio($gateways['twilio'], $to, $body);
        }
        if ($gateways['nexmo']['enabled'] ?? false) {
            return $this->sendNexmo($gateways['nexmo'], $to, $body);
        }
        if ($gateways['twoFactor']['enabled'] ?? false) {
            return $this->sendTwoFactor($gateways['twoFactor'], $to, $body);
        }

        throw ValidationException::withMessages([
            'sms' => 'Enable and configure an SMS gateway under tenant settings.',
        ]);
    }

    /**
     * @return array{nexmo: array<string, mixed>, twilio: array<string, mixed>, twoFactor: array<string, mixed>}
     */
    private function gateways(Tenant $tenant): array
    {
        $sys = is_array($tenant->ui_settings) ? ($tenant->ui_settings['system'] ?? []) : [];
        $g = is_array($sys) && isset($sys['smsGateways']) && is_array($sys['smsGateways'])
            ? $sys['smsGateways']
            : [];

        return [
            'nexmo' => is_array($g['nexmo'] ?? null) ? $g['nexmo'] : [],
            'twilio' => is_array($g['twilio'] ?? null) ? $g['twilio'] : [],
            'twoFactor' => is_array($g['twoFactor'] ?? null) ? $g['twoFactor'] : [],
        ];
    }

    private function normalizePhone(string $raw): string
    {
        $d = preg_replace('/\D+/', '', $raw);

        return is_string($d) ? $d : '';
    }

    /**
     * @param  array<string, mixed>  $cfg
     * @return array{provider: string, detail: string}
     */
    private function sendTwilio(array $cfg, string $to, string $body): array
    {
        $sid = trim((string) ($cfg['accountSid'] ?? ''));
        $token = trim((string) ($cfg['authToken'] ?? ''));
        $from = trim((string) ($cfg['fromNumber'] ?? ''));
        if ($sid === '' || $token === '' || $from === '') {
            throw ValidationException::withMessages(['sms' => 'Twilio credentials are incomplete.']);
        }

        $url = "https://api.twilio.com/2010-04-01/Accounts/{$sid}/Messages.json";
        /** @var Response $res */
        $res = Http::withBasicAuth($sid, $token)
            ->asForm()
            ->post($url, [
                'From' => $from,
                'To' => $to,
                'Body' => $body,
            ]);

        if (! $res->successful()) {
            Log::warning('Twilio SMS failed', ['status' => $res->status(), 'body' => $res->body()]);

            throw ValidationException::withMessages(['sms' => 'Twilio rejected the message.']);
        }

        $sidMsg = $res->json('sid');

        return ['provider' => 'twilio', 'detail' => is_string($sidMsg) ? $sidMsg : 'sent'];
    }

    /**
     * @param  array<string, mixed>  $cfg
     * @return array{provider: string, detail: string}
     */
    private function sendNexmo(array $cfg, string $to, string $body): array
    {
        $key = trim((string) ($cfg['apiKey'] ?? ''));
        $secret = trim((string) ($cfg['apiSecret'] ?? ''));
        $from = trim((string) ($cfg['senderId'] ?? ''));
        if ($key === '' || $secret === '' || $from === '') {
            throw ValidationException::withMessages(['sms' => 'Nexmo/Vonage credentials are incomplete.']);
        }

        $res = Http::asForm()->post('https://rest.nexmo.com/sms/json', [
            'api_key' => $key,
            'api_secret' => $secret,
            'from' => $from,
            'to' => $to,
            'text' => $body,
        ]);

        if (! $res->successful()) {
            Log::warning('Nexmo SMS HTTP failed', ['status' => $res->status()]);

            throw ValidationException::withMessages(['sms' => 'SMS gateway request failed.']);
        }

        $messages = $res->json('messages');
        $st = is_array($messages) && isset($messages[0]['status']) ? $messages[0]['status'] : null;
        if ($st !== '0' && $st !== 0) {
            Log::warning('Nexmo SMS rejected', ['response' => $res->json()]);

            throw ValidationException::withMessages(['sms' => 'SMS provider rejected the message.']);
        }

        return ['provider' => 'nexmo', 'detail' => 'sent'];
    }

    /**
     * @param  array<string, mixed>  $cfg
     * @return array{provider: string, detail: string}
     */
    private function sendTwoFactor(array $cfg, string $to, string $body): array
    {
        $apiKey = trim((string) ($cfg['apiKey'] ?? ''));
        $sender = trim((string) ($cfg['senderId'] ?? ''));
        if ($apiKey === '' || $sender === '') {
            throw ValidationException::withMessages(['sms' => '2Factor credentials are incomplete.']);
        }

        $partner = trim((string) ($cfg['partnerId'] ?? ''));

        $url = 'https://2factor.in/API/R1/';
        $query = [
            'module' => 'TRANS_SMS',
            'apikey' => $apiKey,
            'to' => $to,
            'from' => $sender,
            'msg' => $body,
        ];
        if ($partner !== '') {
            $query['partnerid'] = $partner;
        }

        $res = Http::get($url, $query);

        if (! $res->successful()) {
            Log::warning('2Factor SMS HTTP failed', ['status' => $res->status()]);

            throw ValidationException::withMessages(['sms' => 'SMS gateway request failed.']);
        }

        $status = $res->json('Status');
        if ($status !== 'Success' && $status !== 'SUCCESS') {
            Log::warning('2Factor SMS rejected', ['response' => $res->json()]);

            throw ValidationException::withMessages(['sms' => 'SMS provider rejected the message.']);
        }

        return ['provider' => 'twoFactor', 'detail' => 'sent'];
    }
}
