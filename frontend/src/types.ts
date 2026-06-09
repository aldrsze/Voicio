/// <reference types="vite/client" />

export interface VoiceInfo {
  id: string;
  name: string;
  language: string;
  region?: string;
  quality?: string;
  engine?: string;
  gender?: string;
  vibe?: string[];
  description?: string;
  available?: boolean;
}

export interface VoicesResponse {
  languages: Record<string, VoiceInfo[]>;
}

export interface TTSRequest {
  text: string;
  language?: string;
  voice?: string;
  speed?: number;
}

export type AppStatus =
  | "idle"
  | "generating"
  | "ready"
  | "playing"
  | "error";
