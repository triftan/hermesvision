export interface Scene {
  timestamp: string;
  label: string;
  description: string;
}

export interface Message {
  role: "user" | "model";
  text: string;
  createdAt: string;
}

export interface Thread {
  id: string;
  fileUri: string;
  fileName: string;
  mimeType: string;
  videoName: string;
  sizeBytes: number;
  title: string;
  scenes: Scene[];
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}
