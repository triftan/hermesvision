import {
  GoogleGenAI,
  createUserContent,
  MediaProcessing,
  FileState,
} from "@google/genai";
import type { Scene } from "./types";

export function getAI() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not configured");
  return new GoogleGenAI({ apiKey: key });
}

export const DEFAULT_PROMPT =
  "Analyze this CCTV/security video. Identify people, objects, vehicles, actions, anomalies, and scene changes. Provide a timestamped summary of salient events.";

export const SYSTEM_INSTRUCTION =
  "You are an expert video analyst for security and police CCTV review. " +
  "Use the agentic video mode to dynamically inspect the footage. " +
  "Answer the user's question clearly. Reference timestamps (MM:SS or HH:MM:SS) when describing events. " +
  "Be factual and concise. If uncertain, say so.";

export const SCENES_PROMPT =
  "Also extract a list of key scenes/moments from the video. " +
  "For each scene, provide a timestamp, a short label (3-6 words), and a one-sentence description. " +
  "Return the scenes as a JSON array under a top-level key `scenes` with fields `timestamp`, `label`, `description`. " +
  "Example: {\"scenes\": [{\"timestamp\":\"00:23\",\"label\":\"Person enters lobby\",\"description\":\"A person walks through the front entrance.\"}]}";

export function partFromVideo(fileUri: string, mimeType: string) {
  return {
    fileData: { fileUri, mimeType },
    mediaProcessing: MediaProcessing.AGENTIC,
  };
}

export async function waitForFile(
  ai: GoogleGenAI,
  name: string
): Promise<void> {
  let file = await ai.files.get({ name });
  while (file.state === FileState.PROCESSING) {
    await new Promise((r) => setTimeout(r, 2000));
    file = await ai.files.get({ name });
  }
  if (file.state === FileState.FAILED) {
    throw new Error("Gemini failed to process the video file");
  }
}

export function parseScenes(text: string): Scene[] {
  try {
    // Try to find JSON block
    const match = text.match(/```json\s*([\s\S]*?)\s*```/);
    const jsonStr = match ? match[1]! : text;
    const parsed = JSON.parse(jsonStr);
    const scenes = Array.isArray(parsed.scenes) ? parsed.scenes : parsed;
    return scenes
      .filter(
        (s: unknown) =>
          s && typeof s === "object" && "timestamp" in s && "label" in s
      )
      .map((s: Scene) => ({
        timestamp: s.timestamp,
        label: s.label,
        description: s.description || "",
      }));
  } catch {
    return [];
  }
}
