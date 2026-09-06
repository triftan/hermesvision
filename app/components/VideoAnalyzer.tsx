'use client';

import { useState, useRef, useCallback, DragEvent } from 'react';

const defaultPrompt =
  'Analyze this CCTV/security video. Identify people, objects, vehicles, actions, anomalies, and scene changes. Provide a timestamped summary of salient events.';

export default function VideoAnalyzer() {
  const [file, setFile] = useState<File | null>(null);
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string>('');
  const [error, setError] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((selected: File | null | undefined) => {
    if (!selected) return;
    if (!selected.type.startsWith('video/')) {
      setError('Please upload a video file.');
      return;
    }
    setFile(selected);
    setError('');
    setResult('');
  }, []);

  const onDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragOver(false);
      const dropped = e.dataTransfer.files?.[0];
      handleFile(dropped);
    },
    [handleFile]
  );

  const onDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const onDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleFile(e.target.files?.[0]);
    },
    [handleFile]
  );

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setError('');
    setResult('');

    const formData = new FormData();
    formData.append('video', file);
    formData.append('prompt', prompt);

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Analysis failed');
      }

      setResult(data.analysis || 'No analysis returned.');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const clearFile = () => {
    setFile(null);
    setResult('');
    setError('');
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="mx-auto w-full max-w-3xl rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <form onSubmit={onSubmit} className="space-y-5">
        <div
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onClick={() => inputRef.current?.click()}
          className={[
            'cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-colors',
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
            onChange={onInputChange}
          />
          <div className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
            {file ? file.name : 'Drag & drop a video clip, or click to upload'}
          </div>
          <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            MP4, MOV, AVI, WEBM, etc. · 1–5 minutes recommended
          </div>
        </div>

        <div>
          <label
            htmlFor="prompt"
            className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-200"
          >
            What do you want to know about the video?
          </label>
          <textarea
            id="prompt"
            rows={4}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            placeholder="e.g. How many people entered the room?"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={!file || loading}
            className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-zinc-400"
          >
            {loading ? 'Analyzing…' : 'Analyze Video'}
          </button>
          {file && (
            <button
              type="button"
              onClick={clearFile}
              className="rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Clear
            </button>
          )}
        </div>
      </form>

      {error && (
        <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-5">
          <h3 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Analysis
          </h3>
          <div className="whitespace-pre-wrap rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm leading-relaxed text-zinc-800 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
            {result}
          </div>
        </div>
      )}
    </div>
  );
}
