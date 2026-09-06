import VideoAnalyzer from "./components/VideoAnalyzer";

export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-12 dark:bg-black">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-4xl">
            HermesVision
          </h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Agentic CCTV video analysis for security and police teams. Upload a
            1–5 minute clip and ask what happened.
          </p>
        </div>
        <VideoAnalyzer />
      </div>
    </main>
  );
}
