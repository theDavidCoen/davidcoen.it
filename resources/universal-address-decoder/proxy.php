<?php
/**
 * Same-origin proxy for Universal Address Decoder.
 * Allowlisted upstreams only — no open proxy.
 */
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

const UPSTREAMS = [
    'zano' => [
        'url' => 'https://node.zano.org/json_rpc',
        'method' => 'POST',
        'content_type' => 'application/json',
    ],
    'fio' => [
        'url' => 'https://fio.eosrio.io/v1/chain/get_pub_addresses',
        'method' => 'POST',
        'content_type' => 'application/json',
    ],
    'fio_alt' => [
        'url' => 'https://fio.eosphere.io/v1/chain/get_pub_addresses',
        'method' => 'POST',
        'content_type' => 'application/json',
    ],
    'solana' => [
        'url' => 'https://rpc.solanatracker.io/public',
        'method' => 'POST',
        'content_type' => 'application/json',
    ],
];

function fail(int $code, string $message): void
{
    http_response_code($code);
    echo json_encode(['ok' => false, 'error' => $message], JSON_UNESCAPED_SLASHES);
    exit;
}

$target = isset($_GET['target']) ? (string) $_GET['target'] : '';
if (!isset(UPSTREAMS[$target])) {
    fail(400, 'Unknown or missing target');
}

$cfg = UPSTREAMS[$target];
$body = file_get_contents('php://input');
if ($body === false) {
    $body = '';
}
if ($cfg['method'] === 'POST' && $body === '') {
    fail(400, 'POST body required');
}

// Basic size cap
if (strlen($body) > 65536) {
    fail(413, 'Body too large');
}

$ch = curl_init($cfg['url']);
if ($ch === false) {
    fail(500, 'curl init failed');
}

$headers = [
    'Accept: application/json',
    'Content-Type: ' . $cfg['content_type'],
    'User-Agent: davidcoen-universal-address-decoder/1.0',
];

curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_MAXREDIRS => 3,
    CURLOPT_CONNECTTIMEOUT => 8,
    CURLOPT_TIMEOUT => 20,
    CURLOPT_HTTPHEADER => $headers,
    CURLOPT_CUSTOMREQUEST => $cfg['method'],
    CURLOPT_POSTFIELDS => $body,
]);

$resp = curl_exec($ch);
$errno = curl_errno($ch);
$err = curl_error($ch);
$status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($errno !== 0) {
    fail(502, 'Upstream error: ' . $err);
}

if ($status < 200 || $status >= 300) {
    http_response_code(502);
    echo json_encode([
        'ok' => false,
        'error' => "Upstream HTTP $status",
        'body' => is_string($resp) ? substr($resp, 0, 2000) : null,
    ], JSON_UNESCAPED_SLASHES);
    exit;
}

// Pass through upstream JSON as-is when valid; otherwise wrap.
$decoded = json_decode((string) $resp, true);
if (json_last_error() !== JSON_ERROR_NONE) {
    fail(502, 'Upstream returned non-JSON');
}

echo json_encode($decoded, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
