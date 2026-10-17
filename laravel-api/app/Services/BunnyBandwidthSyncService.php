<?php

namespace App\Services;

use App\Models\Tenant;
use App\Models\Video;
use Carbon\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Keeps tenant_bandwidth_usages in line with what Bunny actually bills.
 *
 * Every tenant's videos sit behind the one Stream pull zone, so:
 *  - the real daily total comes from Bunny's statistics API (the same number
 *    the Bunny dashboard shows, available for any past day), and
 *  - each tenant's share of a day comes from that day's raw CDN log, by
 *    mapping each request's video GUID to the tenant that owns it.
 *
 * Raw logs are only kept for 3 days, so once a day's share has been taken
 * from its log it's stored (log_bytes) and reused; days whose log was never
 * captured fall back to splitting by each tenant's views x size.
 *
 * Every run rewrites whole days (upsert), so it's safe to re-run at any time.
 */
class BunnyBandwidthSyncService
{
    private const API_BASE_URL = 'https://api.bunny.net';
    private const LOG_BASE_URL = 'https://logging.bunnycdn.com';
    private const LOG_RETENTION_DAYS = 3;

    /**
     * @return int number of days written
     */
    public function sync(?Carbon $from = null): int
    {
        $accountKey = config('video.bunny.account_api_key');
        $libraryId = config('video.bunny.library_id');

        if (!$accountKey || !$libraryId) {
            return 0;
        }

        $pullZoneId = $this->resolvePullZoneId($accountKey, $libraryId);

        if (!$pullZoneId) {
            Log::warning('Bunny bandwidth sync: could not resolve the pull zone id.');
            return 0;
        }

        $today = Carbon::now('UTC')->startOfDay();

        // The whole current month, plus the last few days of the previous one
        // so their log-based split is still captured early in a new month.
        $from ??= $today->copy()->startOfMonth()->min($today->copy()->subDays(self::LOG_RETENTION_DAYS - 1));
        $from = $from->copy()->setTimezone('UTC')->startOfDay();

        $dailyTotals = $this->fetchDailyTotals($accountKey, $pullZoneId, $from, $today);

        if ($dailyTotals === null) {
            return 0;
        }

        $synced = 0;

        foreach ($dailyTotals as $date => $totalBytes) {
            if ($this->syncDay($accountKey, $pullZoneId, Carbon::parse($date, 'UTC'), $totalBytes, $today)) {
                $synced++;
            }
        }

        Tenant::query()->update(['bandwidth_synced_at' => now()]);

        return $synced;
    }

    private function resolvePullZoneId(string $accountKey, string $libraryId): ?int
    {
        return Cache::remember("bunny_pull_zone_id:{$libraryId}", now()->addDay(), function () use ($accountKey, $libraryId) {
            try {
                $response = Http::withHeaders(['AccessKey' => $accountKey, 'Accept' => 'application/json'])
                    ->get(self::API_BASE_URL . "/videolibrary/{$libraryId}");

                if (!$response->successful()) {
                    Log::warning('Failed to resolve Bunny pull zone id: HTTP ' . $response->status());
                    return null;
                }

                return $response->json('PullZoneId');
            } catch (\Throwable $e) {
                Log::warning('Failed to resolve Bunny pull zone id: ' . $e->getMessage());
                return null;
            }
        });
    }

    /**
     * @return array<string, int>|null bytes served per UTC date (Y-m-d)
     */
    private function fetchDailyTotals(string $accountKey, int $pullZoneId, Carbon $from, Carbon $to): ?array
    {
        try {
            $response = Http::withHeaders(['AccessKey' => $accountKey, 'Accept' => 'application/json'])
                ->get(self::API_BASE_URL . '/statistics', [
                    'pullZone' => $pullZoneId,
                    'dateFrom' => $from->toDateString(),
                    'dateTo' => $to->toDateString(),
                    'hourly' => 'false',
                ]);

            if (!$response->successful()) {
                Log::warning('Failed to fetch Bunny bandwidth statistics: HTTP ' . $response->status());
                return null;
            }

            $totals = [];
            foreach ($response->json('BandwidthUsedChart') ?? [] as $timestamp => $bytes) {
                $totals[substr($timestamp, 0, 10)] = (int) $bytes;
            }
            ksort($totals);

            return $totals;
        } catch (\Throwable $e) {
            Log::warning('Failed to fetch Bunny bandwidth statistics: ' . $e->getMessage());
            return null;
        }
    }

    private function syncDay(string $accountKey, int $pullZoneId, Carbon $date, int $totalBytes, Carbon $today): bool
    {
        $dateString = $date->toDateString();

        $storedLogShares = DB::table('tenant_bandwidth_usages')
            ->where('date', $dateString)
            ->whereNotNull('log_bytes')
            ->pluck('log_bytes', 'tenant_id')
            ->map(fn ($bytes) => (int) $bytes)
            ->all();

        $logStillAvailable = $date->gte($today->copy()->subDays(self::LOG_RETENTION_DAYS - 1));
        // Today's and yesterday's logs are still being appended to, so their
        // split is refreshed every run; older days only need fetching once.
        $logMayHaveChanged = $date->gte($today->copy()->subDay());

        $weights = null;
        $fromLogs = false;

        if ($logStillAvailable && (empty($storedLogShares) || $logMayHaveChanged)) {
            $logShares = $this->fetchLogBytesByTenant($accountKey, $pullZoneId, $date);
            if (!empty($logShares)) {
                $weights = $logShares;
                $fromLogs = true;
            }
        }

        if ($weights === null && !empty($storedLogShares)) {
            $weights = $storedLogShares;
            $fromLogs = true;
        }

        $weights ??= $this->fallbackWeights();
        $weightSum = array_sum($weights);

        return DB::transaction(function () use ($weights, $weightSum, $totalBytes, $dateString, $fromLogs) {
            if ($totalBytes <= 0 || $weightSum <= 0) {
                DB::table('tenant_bandwidth_usages')->where('date', $dateString)->delete();
                return true;
            }

            $now = now();
            $rows = [];

            foreach ($weights as $tenantId => $weight) {
                $rows[] = [
                    'tenant_id' => $tenantId,
                    'date' => $dateString,
                    // Scale to Bunny's real total, so bytes that couldn't be
                    // tied to a video (deleted videos etc.) are still counted.
                    'bytes' => (int) round($totalBytes * ($weight / $weightSum)),
                    'log_bytes' => $fromLogs ? $weight : null,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }

            DB::table('tenant_bandwidth_usages')->upsert($rows, ['tenant_id', 'date'], ['bytes', 'log_bytes', 'updated_at']);

            DB::table('tenant_bandwidth_usages')
                ->where('date', $dateString)
                ->whereNotIn('tenant_id', array_keys($weights))
                ->delete();

            return true;
        });
    }

    /**
     * @return array<string, int>|null log bytes per tenant id, null if the log couldn't be read
     */
    private function fetchLogBytesByTenant(string $accountKey, int $pullZoneId, Carbon $date): ?array
    {
        $logUrl = self::LOG_BASE_URL . '/' . $date->format('m-d-y') . "/{$pullZoneId}.log";

        try {
            $response = Http::withHeaders(['AccessKey' => $accountKey])->timeout(120)->get($logUrl);

            if (!$response->successful()) {
                if ($response->status() !== 404) {
                    Log::warning("Failed to download Bunny log for {$date->toDateString()}: HTTP {$response->status()}");
                }
                return null;
            }

            $bytesByGuid = $this->sumBytesByVideoGuid($response->body());
        } catch (\Throwable $e) {
            Log::warning("Failed to download Bunny log for {$date->toDateString()}: " . $e->getMessage());
            return null;
        }

        $bytesByTenant = [];

        foreach (array_chunk(array_keys($bytesByGuid), 500) as $guids) {
            Video::whereIn('bunny_video_id', $guids)
                ->get(['tenant_id', 'bunny_video_id'])
                ->each(function (Video $video) use ($bytesByGuid, &$bytesByTenant) {
                    $bytesByTenant[$video->tenant_id] = ($bytesByTenant[$video->tenant_id] ?? 0) + $bytesByGuid[$video->bunny_video_id];
                });
        }

        return $bytesByTenant;
    }

    /**
     * @return array<string, int> bytes served per Bunny video GUID
     */
    private function sumBytesByVideoGuid(string $logBody): array
    {
        $totals = [];

        foreach (preg_split('/\r\n|\r|\n/', trim($logBody)) as $line) {
            if ($line === '') {
                continue;
            }

            // cache status|status|timestamp|bytes sent|pull zone|ip|referer|url|...
            $fields = explode('|', $line);
            $bytesSent = (int) ($fields[3] ?? 0);
            $url = $fields[7] ?? '';

            if ($bytesSent <= 0 || $url === '') {
                continue;
            }

            $path = parse_url($url, PHP_URL_PATH) ?? '';
            $guid = explode('/', ltrim($path, '/'))[0] ?? '';

            if ($guid === '') {
                continue;
            }

            $totals[$guid] = ($totals[$guid] ?? 0) + $bytesSent;
        }

        return $totals;
    }

    /**
     * Split for days with no CDN log: each tenant's views x size, i.e. a
     * rough proxy for how much of the traffic its videos drive.
     *
     * @return array<string, int>
     */
    private function fallbackWeights(): array
    {
        $weights = Video::whereNotNull('bunny_video_id')
            ->groupBy('tenant_id')
            ->selectRaw('tenant_id, SUM(size_bytes * views) as weight')
            ->pluck('weight', 'tenant_id')
            ->map(fn ($weight) => (int) $weight)
            ->filter()
            ->all();

        if (!empty($weights)) {
            return $weights;
        }

        return Video::whereNotNull('bunny_video_id')
            ->groupBy('tenant_id')
            ->selectRaw('tenant_id, SUM(size_bytes) as weight')
            ->pluck('weight', 'tenant_id')
            ->map(fn ($weight) => (int) $weight)
            ->filter()
            ->all();
    }
}
