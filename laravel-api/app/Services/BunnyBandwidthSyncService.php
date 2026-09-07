<?php

namespace App\Services;

use App\Models\Tenant;
use App\Models\Video;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Turns Bunny's raw CDN access logs (shared across every tenant, since they
 * all sit behind the one pull zone) into a real, per-tenant bandwidth total.
 *
 * Bunny only retains raw logs for 3 days, so this only ever processes
 * finished calendar days (never today, whose log is still being written)
 * and records each processed day in bunny_log_syncs so it's never
 * double-counted, and so a missed run can still be caught up within the
 * retention window.
 */
class BunnyBandwidthSyncService
{
    private const LOG_BASE_URL = 'https://logging.bunnycdn.com';
    private const RETENTION_DAYS = 3;

    public function syncPendingDays(): int
    {
        $accountKey = config('video.bunny.account_api_key');

        if (!$accountKey) {
            return 0;
        }

        $syncedDates = DB::table('bunny_log_syncs')->pluck('log_date');
        $alreadySynced = collect($syncedDates)->map(fn ($date) => Carbon::parse($date)->toDateString())->all();

        $pendingDates = [];
        for ($daysAgo = 1; $daysAgo < self::RETENTION_DAYS; $daysAgo++) {
            $date = now()->subDays($daysAgo);

            if (!in_array($date->toDateString(), $alreadySynced, true)) {
                $pendingDates[] = $date;
            }
        }

        if (empty($pendingDates)) {
            return 0;
        }

        $pullZoneId = $this->resolvePullZoneId();

        if (!$pullZoneId) {
            Log::warning('Bunny bandwidth sync: could not resolve the pull zone id.');
            return 0;
        }

        $synced = 0;

        foreach ($pendingDates as $date) {
            if ($this->syncDay($accountKey, $pullZoneId, $date)) {
                $synced++;
            }
        }

        return $synced;
    }

    private function resolvePullZoneId(): ?int
    {
        $libraryId = config('video.bunny.library_id');
        $apiKey = config('video.bunny.api_key');

        if (!$libraryId || !$apiKey) {
            return null;
        }

        try {
            $response = Http::withHeaders([
                'AccessKey' => $apiKey,
                'Accept' => 'application/json',
            ])->get("https://video.bunnycdn.com/library/{$libraryId}");

            if (!$response->successful()) {
                Log::warning('Failed to resolve Bunny pull zone id: ' . $response->body());
                return null;
            }

            return $response->json('PullZoneId');
        } catch (\Throwable $e) {
            Log::warning('Failed to resolve Bunny pull zone id: ' . $e->getMessage());
            return null;
        }
    }

    private function syncDay(string $accountKey, int $pullZoneId, Carbon $date): bool
    {
        $logUrl = self::LOG_BASE_URL . '/' . $date->format('m-d-y') . "/{$pullZoneId}.log";

        try {
            $response = Http::withHeaders(['AccessKey' => $accountKey])->get($logUrl);

            if ($response->status() === 404) {
                // No traffic at all that day - nothing to add, but still a
                // finished day, so mark it synced to stop retrying it.
                DB::table('bunny_log_syncs')->insert(['log_date' => $date->toDateString(), 'created_at' => now(), 'updated_at' => now()]);
                return true;
            }

            if (!$response->successful()) {
                Log::warning("Failed to download Bunny log for {$date->toDateString()}: HTTP {$response->status()}");
                return false;
            }

            $bytesByGuid = $this->sumBytesByVideoGuid($response->body());

            $this->applyToTenants($bytesByGuid);

            DB::table('bunny_log_syncs')->insert(['log_date' => $date->toDateString(), 'created_at' => now(), 'updated_at' => now()]);

            return true;
        } catch (\Throwable $e) {
            Log::error("Failed to sync Bunny log for {$date->toDateString()}: " . $e->getMessage());
            return false;
        }
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
     * @param array<string, int> $bytesByGuid
     */
    private function applyToTenants(array $bytesByGuid): void
    {
        if (empty($bytesByGuid)) {
            return;
        }

        $bytesByTenant = [];

        Video::whereIn('bunny_video_id', array_keys($bytesByGuid))
            ->get(['tenant_id', 'bunny_video_id'])
            ->each(function (Video $video) use ($bytesByGuid, &$bytesByTenant) {
                $bytes = $bytesByGuid[$video->bunny_video_id] ?? 0;
                $bytesByTenant[$video->tenant_id] = ($bytesByTenant[$video->tenant_id] ?? 0) + $bytes;
            });

        foreach ($bytesByTenant as $tenantId => $bytes) {
            Tenant::where('id', $tenantId)->increment('bandwidth_used_bytes', $bytes, [
                'bandwidth_synced_at' => now(),
            ]);
        }
    }
}
