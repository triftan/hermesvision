'use client';

import { useState, useRef, useCallback, DragEvent, useEffect } from 'react';
import type { Thread, Scene, Message } from '@/lib/types';

interface VideoChatProps {
  initialThread?: Thread | null;
}

export default function VideoChat({ initialThread }: VideoChatProps) {
  const [file, setFile] = useState<File | null>(null);
  const [prompt, setPrompt] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [thread, setThread] = useState<Thread | null>(initialThread || null);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [scenesExpanded, setScenesExpanded] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchThreads();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thread?.messages]);

  const fetchThreads = async () => {
    try {
      const res = await fetch('/api/threads');
      const data = await res.json();
      setThreads(data.threads || []);
    } catch {
      // ignore
    }
  };

  const handleFile = useCallback((selected: File | null | undefined) => {
    if (!selected) return;
    if (!selected.type.startsWith('video/')) {
      alert('Please upload a video file.');
      return;
    }
    setFile(selected);
  }, []);

  const onDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragOver(false);
      handleFile(e.dataTransfer.files?.[0]);
    },
    [handleFile]
  );

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!file && !thread) return;
    if (!prompt.trim()) return;

    setLoading(true);
    const formData = new FormData();
    if (file) formData.append('video', file);
    if (thread) formData.append('threadId', thread.id);
    formData.append('prompt', prompt);

    try {
      const res = await fetch('/api/analyze', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Analysis failed');

      if (file) {
        // New thread
        const newThread: Thread = {
          id: data.threadId,
          title: file.name,
          fileUri: '',
          fileName: '',
          mimeType: '',
          videoName: file.name,
          sizeBytes: file.size,
          scenes: data.scenes || [],
          messages: [
            { role: 'user', text: prompt, createdAt: new Date().toISOString() },
            {
              role: 'model',
              text: data.analysis,
              createdAt: new Date().toISOString(),
            },
          ],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        setThread(newThread);
        setThreads((prev) => [newThread, ...prev]);
        setFile(null);
      } else if (thread) {
        // Follow-up
        const updated: Thread = {
          ...thread,
          messages: [
            ...thread.messages,
            { role: 'user', text: prompt, createdAt: new Date().toISOString() },
            {
              role: 'model',
              text: data.analysis,
              createdAt: new Date().toISOString(),
            },
          ],
          updatedAt: new Date().toISOString(),
        };
        setThread(updated);
        setThreads((prev) =>
          prev.map((t) => (t.id === updated.id ? updated : t))
        );
      }
      setPrompt('');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const loadThread = async (id: string) => {
    const res = await fetch(`/api/threads?id=${id}`);
    const data = await res.json();
    if (data.thread) setThread(data.thread);
  };

  const askAboutScene = (scene: Scene) => {
    setPrompt(`At ${scene.timestamp}, ${scene.label.toLowerCase()}. Describe what happens in detail.`);
  };

  const startNew = () => {
    setThread(null);
    setFile(null);
    setPrompt('');
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="flex h-[calc(100vh-80px)] gap-4">
      {/* Sidebar */}
      <aside className="hidden w-64 flex-col rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900 md:flex">
        <button
          onClick={startNew}
          className="mb-3 w-full rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          + New analysis
        </button>
        <div className="flex-1 overflow-y-auto">
          {threads.map((t) => (
            <button
              key={t.id}
              onClick={() => loadThread(t.id)}
              className={[
                'mb-1 w-full rounded-md px-3 py-2 text-left text-sm',
                thread?.id === t.id
                  ? 'bg-zinc-100 font-medium text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
                  : 'text-zinc-600 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800/50',
              ].join(' ')}
            >
              <div className="truncate">{t.title}</div>
              <div className="text-xs text-zinc-400">
                {new Date(t.updatedAt).toLocaleString()}
              </div>
            </button>
          ))}
        </div>
      </aside>

      {/* Main chat */}
      <main className="flex flex-1 flex-col rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        {!thread ? (
          <div className="flex flex-1 flex-col items-center justify-center p-6">
            <div
              onDrop={onDrop}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onClick={() => inputRef.current?.click()}
              className={[
                'w-full max-w-xl cursor-pointer rounded-xl border-2 border-dashed p-10 text-center transition-colors',
                dragOver
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
                  : 'border-zinc-300 hover:border-zinc-400 dark:border-zinc-700 dark:hover:border-zinc-600',
              ].join(' ')}
            >
              <input
                ref={inputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
              <div className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
                {file ? file.name : 'Drag & drop a CCTV clip, or click to upload'}
              </div>
              <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                MP4, MOV, AVI, WEBM, etc. · 1–5 minutes
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
              <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">
                {thread.title}
              </h2>
            </div>

            <div className="flex flex-1 overflow-hidden">
              <div className="flex flex-1 flex-col">
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {thread.messages.map((m, idx) => (
                    <MessageBubble key={idx} message={m} />
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                <form
                  onSubmit={submit}
                  className="border-t border-zinc-200 p-3 dark:border-zinc-800"
                >
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder="Ask about the video..."
                      className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                    />
                    <button
                      type="submit"
                      disabled={loading || !prompt.trim()}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-zinc-400"
                    >
                      {loading ? '…' : 'Send'}
                    </button>
                  </div>
                </form>
              </div>

              {/* Scenes panel */}
              {thread.scenes.length > 0 && (
                <div className="hidden w-64 border-l border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950 lg:block">
                  <button
                    onClick={() => setScenesExpanded((v) => !v)}
                    className="mb-2 flex w-full items-center justify-between text-sm font-semibold text-zinc-900 dark:text-zinc-100"
                  >
                    Scenes ({thread.scenes.length})
                    <span>{scenesExpanded ? '▼' : '▶'}</span>
                  </button>
                  {scenesExpanded && (
                    <div className="space-y-2">
                      {thread.scenes.map((scene, idx) => (
                        <button
                          key={idx}
                          onClick={() => askAboutScene(scene)}
                          className="w-full rounded-md bg-white p-2 text-left text-xs shadow-sm transition hover:bg-blue-50 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                        >
                          <div className="font-semibold text-blue-700 dark:text-blue-400">
                            {scene.timestamp}
                          </div>
                          <div className="font-medium text-zinc-800 dark:text-zinc-200">
                            {scene.label}
                          </div>
                          <div className="mt-1 text-zinc-500 dark:text-zinc-400">
                            {scene.description}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Prompt input for first upload */}
        {!thread && file && (
          <form
            onSubmit={submit}
            className="border-t border-zinc-200 p-4 dark:border-zinc-800"
          >
            <div className="flex gap-2">
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="What should I look for in this video?"
                className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
              <button
                type="submit"
                disabled={loading || !prompt.trim()}
                className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-zinc-400"
              >
                {loading ? 'Analyzing...' : 'Analyze'}
              </button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';
  return (
    <div className={['flex', isUser ? 'justify-end' : 'justify-start'].join(' ')}>
      <div
        className={[
          'max-w-[80%] rounded-2xl px-4 py-2 text-sm',
          isUser
            ? 'rounded-br-none bg-blue-600 text-white'
            : 'rounded-bl-none border border-zinc-200 bg-zinc-50 text-zinc-800 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200',
        ].join(' ')}
      >
        {message.text}
      </div>
    </div>
  );
}
