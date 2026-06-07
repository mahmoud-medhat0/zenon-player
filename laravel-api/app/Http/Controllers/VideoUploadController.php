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

        $uploadId = Str::random(40);

        return response()->json([
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
}
