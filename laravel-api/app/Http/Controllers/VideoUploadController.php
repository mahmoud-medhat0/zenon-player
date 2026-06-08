<?php

namespace App\Http\Controllers;

use App\Models\Video;
use App\Services\PlanService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class VideoUploadController extends Controller
{
    public function __construct(
        private PlanService $planService
    ) {}

    public function initiate(Request $request): JsonResponse
    {
        $request->validate([
            'title' => 'required|string|max:255',
            'file_size' => 'required|numeric|max:10737418240',
        ]);

        $user = $request->user();
        $tenant = $user->tenant()->with('plan')->first();

        if (!$this->planService->canUploadVideo($tenant, $request->file_size)) {
            $storageUsed = $this->planService->getStorageUsageGb($tenant);
            $storageLimit = $tenant->getMaxStorageGb();

            return response()->json([
                'message' => "Storage limit reached. You've used {$storageUsed} GB of {$storageLimit} GB. Please upgrade your plan.",
                'code' => 'STORAGE_LIMIT_REACHED',
                'storage_used_gb' => $storageUsed,
                'storage_limit_gb' => $storageLimit,
            ], 422);
        }

        $video = Video::create([
            'title' => $request->title,
            'status' => 'uploading',
            'privacy' => 'private',
            'size_bytes' => $request->file_size,
        ]);

        $processor = config('video.processor');

        if ($processor === 'cloudflare') {
            $accountId = config('video.cloudflare.account_id');
            $apiToken = config('video.cloudflare.api_token');

            if (!$accountId || !$apiToken) {
                return response()->json(['message' => 'Cloudflare credentials not configured'], 500);
            }

            // Force Guzzle to use StreamHandler instead of CurlHandler to bypass the old cURL extension on the server
            $handler = new \GuzzleHttp\Handler\StreamHandler();
            $stack = \GuzzleHttp\HandlerStack::create($handler);
            $client = new \GuzzleHttp\Client(['handler' => $stack]);

            try {
                $response = $client->post("https://api.cloudflare.com/client/v4/accounts/{$accountId}/stream/direct_upload", [
                    'headers' => [
                        'Authorization' => "Bearer {$apiToken}",
                        'Accept' => 'application/json',
                    ],
                    'json' => [
                        'maxDurationSeconds' => 3600 * 4,
                        'creator' => (string) $user->id,
                    ],
                ]);

                $data = json_decode($response->getBody()->getContents(), true);

                return response()->json([
                    'type' => 'cloudflare',
                    'video_id' => $video->id,
                    'upload_url' => $data['result']['uploadURL'],
                    'cloudflare_uid' => $data['result']['uid'],
                    'message' => 'Cloudflare direct upload initiated',
                ]);
            } catch (\Exception $e) {
                return response()->json([
                    'message' => 'Failed to generate Cloudflare upload URL',
                    'error' => $e->getMessage()
                ], 500);
            }
        }

        $uploadId = Str::random(40);

        return response()->json([
            'type' => 'local',
            'video_id' => $video->id,
            'upload_id' => $uploadId,
            'message' => 'Upload initiated successfully',
        ]);
    }

    public function uploadChunk(Request $request, $id): JsonResponse
    {
        $video = Video::findOrFail($id);

        $request->validate([
            'chunk' => 'required|file|max:10485760',
            'chunk_index' => 'required|integer|min:0',
            'upload_id' => 'required|string',
        ]);

        $chunk = $request->file('chunk');
        $chunkIndex = $request->chunk_index;
        $uploadId = $request->upload_id;

        $tempPath = "temp/{$uploadId}";

        if (!Storage::disk('local')->exists($tempPath)) {
            Storage::disk('local')->makeDirectory($tempPath);
        }

        $chunk->storeAs($tempPath, "chunk.{$chunkIndex}", 'local');

        return response()->json(['message' => 'Chunk uploaded']);
    }

    public function confirm(Request $request, $id): JsonResponse
    {
        $video = Video::findOrFail($id);
        $request->validate([
            'upload_id' => 'required|string',
            'total_chunks' => 'required|integer|min:1',
        ]);

        $uploadId = $request->upload_id;
        $totalChunks = $request->total_chunks;
        $tempPath = "temp/{$uploadId}";
        $tempDir = storage_path("app/private/temp/{$uploadId}");

        if (!file_exists($tempDir)) {
            return response()->json(['message' => 'Upload session not found'], 400);
        }

        $finalFileStream = fopen("{$tempDir}/final.mp4", 'a+');

        for ($i = 0; $i < $totalChunks; $i++) {
            $chunkFile = "{$tempDir}/chunk.{$i}";
            if (!file_exists($chunkFile)) {
                fclose($finalFileStream);
                return response()->json(['message' => 'Missing chunk ' . $i], 400);
            }
            $chunkStream = fopen($chunkFile, 'r');
            stream_copy_to_stream($chunkStream, $finalFileStream);
            fclose($chunkStream);
        }
        fclose($finalFileStream);

        $finalPath = "videos/{$video->tenant_id}/{$video->id}.mp4";
        Storage::disk('local')->put($finalPath, fopen("{$tempDir}/final.mp4", 'r'));

        Storage::disk('local')->deleteDirectory($tempPath);

        $video->update([
            'status' => 'processing',
        ]);

        \App\Jobs\ProcessVideo::dispatch($video);

        return response()->json([
            'message' => 'Upload confirmed and processing started',
            'video' => $video,
        ]);
    }

    public function cloudflareConfirm(Request $request, $id): JsonResponse
    {
        $video = Video::findOrFail($id);
        
        $request->validate([
            'cloudflare_uid' => 'required|string',
        ]);

        $video->update([
            'status' => 'processing',
            'cloudflare_uid' => $request->cloudflare_uid,
        ]);

        return response()->json([
            'message' => 'Cloudflare upload confirmed and video is processing',
            'video' => $video,
        ]);
    }
}
