<?php

namespace App\Http\Controllers;

use App\Models\Video;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class VideoUploadController extends Controller
{
    public function initiate(Request $request)
    {
        $request->validate([
            'title' => 'required|string|max:255',
            'file_size' => 'required|numeric',
        ]);

        $video = Video::create([
            'title' => $request->title,
            'status' => 'uploading',
            'privacy' => 'private',
        ]);

        $uploadId = Str::random(40);
        
        return response()->json([
            'video_id' => $video->id,
            'upload_id' => $uploadId,
            'message' => 'Upload initiated successfully'
        ]);
    }

    public function uploadChunk(Request $request, $id)
    {
        $video = Video::findOrFail($id);
        
        $request->validate([
            'chunk' => 'required|file',
            'chunk_index' => 'required|integer',
            'upload_id' => 'required|string'
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

    public function confirm(Request $request, $id)
    {
        $video = Video::findOrFail($id);
        $request->validate([
            'upload_id' => 'required|string',
            'total_chunks' => 'required|integer'
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
                return response()->json(['message' => 'Missing chunk ' . $i], 400);
            }
            $chunkStream = fopen($chunkFile, 'r');
            stream_copy_to_stream($chunkStream, $finalFileStream);
            fclose($chunkStream);
        }
        fclose($finalFileStream);

        // Move to permanent storage
        $finalPath = "videos/{$video->tenant_id}/{$video->id}.mp4";
        Storage::disk('local')->put($finalPath, fopen("{$tempDir}/final.mp4", 'r'));

        // Clean up temp directory
        Storage::disk('local')->deleteDirectory($tempPath);

        // Update video status
        $video->update([
            'status' => 'processing'
        ]);

        \App\Jobs\ProcessVideo::dispatch($video);

        return response()->json(['message' => 'Upload confirmed and processing started', 'video' => $video]);
    }
}
