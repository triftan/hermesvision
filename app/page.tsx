import VideoChat from "./components/VideoChat";

export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-6 dark:bg-black">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-3xl">
            HermesVision
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Chat with your CCTV clips. Ask follow-up questions without
            re-uploading.
          </p>
        </header>
        <VideoChat />
      </div>
    </main>
  );
}
