<?php

namespace App\Jobs;

use App\Models\Video;
use App\Models\VideoVersion;
use App\Services\PlanService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use ProtoneMedia\LaravelFFMpeg\Support\FFMpeg;
use FFMpeg\Format\Video\X264;
use Illuminate\Support\Facades\Log;
use Throwable;

class ProcessVideo implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $video;

    public int $tries = 3;
    public int $backoff = 60;
    public int $maxExceptions = 3;

    public function __construct(Video $video)
    {
        $this->video = $video;
    }

    public function handle(): void
    {
        Log::info("Starting video processing for Video ID: {$this->video->id}");

        $basePath = "videos/{$this->video->tenant_id}";
        $sourceFile = "{$basePath}/{$this->video->id}.mp4";
        $videoFolder = "{$basePath}/{$this->video->id}_data";

        try {
            $thumbnailPath = "{$videoFolder}/thumbnail.jpg";
            FFMpeg::fromDisk('local')
                ->open($sourceFile)
                ->getFrameFromSeconds(2)
                ->export()
                ->toDisk('local')
                ->save($thumbnailPath);

            $hlsPath = "{$videoFolder}/hls/playlist.m3u8";

            $inspector = FFMpeg::fromDisk('local')->open($sourceFile);
            $height = $inspector->getVideoStream()->getDimensions()->getHeight();
            $durationInSeconds = (int) $inspector->getDurationInSeconds();

            $tenant = $this->video->tenant()->with('plan')->first();

            if ($tenant && !$this->isDurationAllowed($tenant, $durationInSeconds)) {
                $maxMinutes = floor($tenant->getMaxVideoLengthSec() / 60);
                $this->video->update([
                    'status' => 'failed',
                    'duration_seconds' => $durationInSeconds,
                ]);
                Log::warning("Video exceeds plan duration limit for Video ID: {$this->video->id}. Max: {$maxMinutes} minutes");
                return;
            }

            $hlsExporter = FFMpeg::fromDisk('local')
                ->open($sourceFile)
                ->exportForHLS()
                ->setSegmentLength(10)
                ->setKeyFrameInterval(48);

            $qualities = [
                ['height' => 360, 'bitrate' => 500, 'width' => 640, 'label' => '360p'],
                ['height' => 480, 'bitrate' => 1000, 'width' => 854, 'label' => '480p'],
                ['height' => 720, 'bitrate' => 2000, 'width' => 1280, 'label' => '720p'],
                ['height' => 1080, 'bitrate' => 4000, 'width' => 1920, 'label' => '1080p'],
                ['height' => 1440, 'bitrate' => 8000, 'width' => 2560, 'label' => '1440p'],
                ['height' => 2160, 'bitrate' => 16000, 'width' => 3840, 'label' => '2160p'],
                ['height' => 4320, 'bitrate' => 40000, 'width' => 7680, 'label' => '4320p'],
            ];

            $allowedQualities = $this->getAllowedQualities($tenant, $qualities, $height);

            $addedFormat = false;
            $transcodedQualities = [];
            foreach ($allowedQualities as $q) {
                if ($height >= $q['height'] * 0.9) {
                    $format = (new X264('aac'))->setKiloBitrate($q['bitrate']);
                    $hlsExporter->addFormat($format, function ($m) use ($q) {
                        $m->scale($q['width'], $q['height']);
                    });
                    $addedFormat = true;
                    $transcodedQualities[] = $q;
                }
            }

            if (!$addedFormat) {
                $format = (new X264('aac'))->setKiloBitrate(300);
                $hlsExporter->addFormat($format);
                $transcodedQualities[] = ['height' => $height, 'bitrate' => 300, 'width' => null, 'label' => 'original'];
            }

            $hlsExporter->toDisk('local')->save($hlsPath);

            VideoVersion::where('video_id', $this->video->id)->delete();

            foreach ($transcodedQualities as $q) {
                VideoVersion::create([
                    'video_id' => $this->video->id,
                    'resolution' => $q['label'],
                    'storage_path' => $hlsPath,
                    'storage_disk' => 'local',
                ]);
            }

            $this->video->update([
                'status' => 'ready',
                'duration_seconds' => $durationInSeconds,
            ]);

            Log::info("Video processing completed successfully for Video ID: {$this->video->id}");

        } catch (Throwable $e) {
            Log::error("Video processing failed: " . $e->getMessage());
            $this->video->update(['status' => 'failed']);
            throw $e;
        }
    }

    private function isDurationAllowed($tenant, int $durationSeconds): bool
    {
        $maxDuration = $tenant->getMaxVideoLengthSec();
        return $durationSeconds <= $maxDuration;
    }

    private function getAllowedQualities($tenant, array $qualities, int $sourceHeight): array
    {
        if (!$tenant || !$tenant->plan) {
            return array_filter($qualities, fn($q) => $q['height'] <= 480);
        }

        $features = $tenant->plan->features ?? [];

        $maxHeight = 480;
        if (in_array('4k_streaming', $features)) {
            $maxHeight = 2160;
        } elseif (in_array('hd_streaming', $features)) {
            $maxHeight = 1080;
        }

        return array_filter($qualities, fn($q) => $q['height'] <= $maxHeight);
    }

    public function failed(?Throwable $exception): void
    {
        Log::error("Video processing permanently failed for Video ID: {$this->video->id}: " . ($exception?->getMessage() ?? 'Unknown error'));
        $this->video->update(['status' => 'failed']);
    }
}
