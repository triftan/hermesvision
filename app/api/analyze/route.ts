import { NextRequest } from "next/server";
import { writeFile, unlink, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import os from "os";
import { v4 as uuidv4 } from "uuid";
import {
  getAI,
  DEFAULT_PROMPT,
  SYSTEM_INSTRUCTION,
  SCENES_PROMPT,
  partFromVideo,
  waitForFile,
  parseScenes,
} from "@/lib/ai";
import { createThread, getThread, addMessage } from "@/lib/db";
import type { Message } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024 * 1024;
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

async function saveTempFile(file: File): Promise<string> {
  const tempDir = path.join(os.tmpdir(), "hermesvision-uploads");
  if (!existsSync(tempDir)) await mkdir(tempDir, { recursive: true });
  const tempFilePath = path.join(
    tempDir,
    `${Date.now()}-${uuidv4()}-${sanitizeFilename(file.name)}`
  );
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(tempFilePath, buffer);
  return tempFilePath;
}

export async function POST(request: NextRequest) {
  let tempFilePath: string | null = null;

  try {
    const formData = await request.formData();
    const file = formData.get("video") as File | null;
    const prompt = (formData.get("prompt") as string | null) ?? DEFAULT_PROMPT;
    const threadId = (formData.get("threadId") as string | null) ?? null;

    // New thread with video upload
    if (file && file instanceof File && file.size > 0) {
      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        return Response.json(
          {
            error: `Unsupported file type: ${file.type}. Allowed: ${ALLOWED_MIME_TYPES.join(", ")}`,
          },
          { status: 400 }
        );
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        return Response.json(
          {
            error: `File too large. Max ${MAX_FILE_SIZE_BYTES / (1024 * 1024 * 1024)} GB.`,
          },
          { status: 413 }
        );
      }

      tempFilePath = await saveTempFile(file);
      const mimeType = file.type || getMimeType(file.name);
      const ai = getAI();

      const uploadedFile = await ai.files.upload({
        file: tempFilePath,
        config: { mimeType },
      });
      await waitForFile(ai, uploadedFile.name ?? "");

      const userPrompt = `${prompt}\n\n${SCENES_PROMPT}`;
      const result = await ai.models.generateContent({
        model: "gemini-3.7-flash",
        config: { systemInstruction: SYSTEM_INSTRUCTION },
        contents: [
          {
            role: "user",
            parts: [partFromVideo(uploadedFile.uri ?? "", mimeType), { text: userPrompt }],
          },
        ],
      });

      const text = result.text ?? "";
      const scenes = parseScenes(text);

      const messages: Message[] = [
        { role: "user", text: prompt, createdAt: new Date().toISOString() },
        {
          role: "model",
          text: text.replace(/```json[\s\S]*?```/g, "").trim() || text,
          createdAt: new Date().toISOString(),
        },
      ];

      const thread = await createThread({
        fileUri: uploadedFile.uri ?? "",
        fileName: uploadedFile.name ?? "",
        mimeType,
        videoName: file.name,
        sizeBytes: file.size,
        title: file.name,
        scenes,
        messages,
      });

      return Response.json({
        success: true,
        threadId: thread.id,
        analysis: messages[1].text,
        scenes,
        model: "gemini-3.7-flash",
        mode: "agentic",
      });
    }

    // Follow-up message in existing thread (no re-upload)
    if (threadId && prompt) {
      const thread = await getThread(threadId);
      if (!thread) {
        return Response.json({ error: "Thread not found" }, { status: 404 });
      }

      const ai = getAI();
      const userMessage: Message = {
        role: "user",
        text: prompt,
        createdAt: new Date().toISOString(),
      };

      const history = thread.messages.flatMap((m) => [
        { role: m.role, parts: [{ text: m.text }] },
      ]);

      const result = await ai.models.generateContent({
        model: "gemini-3.7-flash",
        config: { systemInstruction: SYSTEM_INSTRUCTION },
        contents: [
          ...history,
          {
            role: "user",
            parts: [
              partFromVideo(thread.fileUri, thread.mimeType),
              { text: prompt },
            ],
          },
        ],
      });

      const assistantText = result.text ?? "";
      const assistantMessage: Message = {
        role: "model",
        text: assistantText,
        createdAt: new Date().toISOString(),
      };

      await addMessage(threadId, userMessage);
      await addMessage(threadId, assistantMessage);

      return Response.json({
        success: true,
        threadId,
        analysis: assistantText,
        model: "gemini-3.7-flash",
        mode: "agentic",
      });
    }

    return Response.json(
      { error: "No video file or threadId+prompt provided" },
      { status: 400 }
    );
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
