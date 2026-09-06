import { listThreads, getThread } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (id) {
      const thread = await getThread(id);
      if (!thread) {
        return Response.json({ error: "Thread not found" }, { status: 404 });
      }
      return Response.json({ thread });
    }

    const threads = await listThreads();
    return Response.json({ threads });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
