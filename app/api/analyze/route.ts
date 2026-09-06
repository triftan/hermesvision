import { NextRequest } from "next/server";
import {
  GoogleGenAI,
  createUserContent,
  createPartFromUri,
  MediaProcessing,
  FileState,
} from "@google/genai";
import { writeFile, unlink, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import os from "os";

// Upload size limit: 2GB matches Gemini free-tier File API cap, but we guard lower if needed.
export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes max for Vercel (requires Pro for >60s)
export const dynamic = "force-dynamic";

const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB
const ALLOWED_MIME_TYPES = [
  "video/mp4",
  "video/mpeg",
  "video/quicktime",
  "video/avi",
  "video/x-flv",
  "video/mpg",
  "video/webm",
  "video/wmv",
  "video/3gpp",
];

function getApiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error("GEMINI_API_KEY is not configured");
  }
  return key;
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9_.-]/g, "_").slice(0, 200);
}

function getMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const map: Record<string, string> = {
    ".mp4": "video/mp4",
    ".mpeg": "video/mpeg",
    ".mpg": "video/mpg",
    ".mov": "video/quicktime",
    ".qt": "video/quicktime",
    ".avi": "video/avi",
    ".flv": "video/x-flv",
    ".webm": "video/webm",
    ".wmv": "video/wmv",
    ".3gp": "video/3gpp",
    ".3gpp": "video/3gpp",
  };
  return map[ext] ?? "video/mp4";
}

export async function POST(request: NextRequest) {
  let tempFilePath: string | null = null;

  try {
    const formData = await request.formData();
    const file = formData.get("video") as File | null;
    const prompt = (formData.get("prompt") as string | null) ?? "";

    if (!file || !(file instanceof File) || file.size === 0) {
      return Response.json({ error: "No video file provided" }, { status: 400 });
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return Response.json(
        { error: `Unsupported file type: ${file.type}. Allowed: ${ALLOWED_MIME_TYPES.join(", ")}` },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return Response.json(
        { error: `File too large. Max ${MAX_FILE_SIZE_BYTES / (1024 * 1024 * 1024)} GB.` },
        { status: 413 }
      );
    }

    // Write to a temp file. Gemini SDK accepts file path in Node.
    const tempDir = path.join(os.tmpdir(), "hermesvision-uploads");
    if (!existsSync(tempDir)) {
      await mkdir(tempDir, { recursive: true });
    }
    const safeName = sanitizeFilename(file.name);
    tempFilePath = path.join(tempDir, `${Date.now()}-${safeName}`);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(tempFilePath, buffer);

    const apiKey = getApiKey();
    const ai = new GoogleGenAI({ apiKey });

    // Upload video to Gemini Files API
    const uploadedFile = await ai.files.upload({
      file: tempFilePath,
      config: { mimeType: file.type || getMimeType(file.name) },
    });

    // Wait for processing (required for video)
    let videoFile = uploadedFile;
    while (videoFile.state === FileState.PROCESSING) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      videoFile = await ai.files.get({ name: videoFile.name ?? "" });
    }

    if (videoFile.state === FileState.FAILED) {
      throw new Error("Gemini failed to process the video file");
    }

    const userPrompt = prompt.trim()
      ? prompt.trim()
      : "Analyze this CCTV/security video. Identify people, objects, vehicles, actions, anomalies, and scene changes. Provide a timestamped summary of salient events.";

    const systemInstruction =
      "You are an expert video analyst for security and police CCTV review. " +
      "Use the agentic video mode to dynamically inspect the footage. " +
      "Answer the user's question clearly. Reference timestamps (MM:SS or HH:MM:SS) when describing events. " +
      "Be factual and concise. If uncertain, say so.";

    const result = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      config: {
        systemInstruction,
      },
      contents: createUserContent([
        {
          fileData: {
            fileUri: videoFile.uri ?? "",
            mimeType: videoFile.mimeType ?? "video/mp4",
          },
          mediaProcessing: MediaProcessing.AGENTIC,
        },
        { text: userPrompt },
      ]),
    });

    const text = result.text ?? "";

    return Response.json({
      success: true,
      model: "gemini-3.7-flash",
      mode: "agentic",
      prompt: userPrompt,
      analysis: text,
      file: {
        name: videoFile.name,
        mimeType: videoFile.mimeType,
        sizeBytes: file.size,
      },
    });
  } catch (err: unknown) {
    console.error("Analyze error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  } finally {
    if (tempFilePath) {
      try {
        await unlink(tempFilePath);
      } catch {
        // ignore cleanup errors
      }
    }
  }
}
