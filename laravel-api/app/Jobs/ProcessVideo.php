<?php

namespace App\Jobs;

use App\Models\Video;
use App\Models\VideoVersion;
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
            // 1. Extract Thumbnail
            $thumbnailPath = "{$videoFolder}/thumbnail.jpg";
            FFMpeg::fromDisk('local')
                ->open($sourceFile)
                ->getFrameFromSeconds(2)
                ->export()
                ->toDisk('local')
                ->save($thumbnailPath);

            // 2. Transcode to HLS (Dynamic Qualities)
            $hlsPath = "{$videoFolder}/hls/playlist.m3u8";

            // Inspect the video height using one FFmpeg instance
            $inspector = FFMpeg::fromDisk('local')->open($sourceFile);
            $height = $inspector->getVideoStream()->getDimensions()->getHeight();

            // Export using a fresh FFmpeg instance (required for AdvancedMedia internally)
            $hlsExporter = FFMpeg::fromDisk('local')
                ->open($sourceFile)
                ->exportForHLS()
                ->setSegmentLength(10) // 10 second segments
                ->setKeyFrameInterval(48); // assuming 24fps

            $qualities = [
                ['height' => 360, 'bitrate' => 500, 'width' => 640],
                ['height' => 480, 'bitrate' => 1000, 'width' => 854],
                ['height' => 720, 'bitrate' => 2000, 'width' => 1280],
                ['height' => 1080, 'bitrate' => 4000, 'width' => 1920],
                ['height' => 1440, 'bitrate' => 8000, 'width' => 2560], // 2K
                ['height' => 2160, 'bitrate' => 16000, 'width' => 3840], // 4K
                ['height' => 4320, 'bitrate' => 40000, 'width' => 7680] // 8K
            ];

            $addedFormat = false;
            foreach ($qualities as $q) {
                // Generate format if source is at least 90% of the target height (tolerance for odd aspect ratios)
                if ($height >= $q['height'] * 0.9) {
                    $format = (new X264('aac'))->setKiloBitrate($q['bitrate']);
                    $hlsExporter->addFormat($format, function($m) use ($q) {
                        $m->scale($q['width'], $q['height']);
                    });
                    $addedFormat = true;
                }
            }

            // Fallback: If the video is smaller than 360p, just export at original resolution
            if (!$addedFormat) {
                $format = (new X264('aac'))->setKiloBitrate(300);
                $hlsExporter->addFormat($format);
            }

            $hlsExporter->toDisk('local')->save($hlsPath);

            // 3. Create Video Version record
            VideoVersion::create([
                'video_id' => $this->video->id,
                'resolution' => '720p',
                'storage_path' => $hlsPath,
                'storage_disk' => 'local',
            ]);

            // 4. Update Video Status and Duration
            $durationInSeconds = FFMpeg::fromDisk('local')->open($sourceFile)->getDurationInSeconds();
            
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
}
