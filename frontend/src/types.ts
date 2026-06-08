/// <reference types="vite/client" />

export interface VoiceInfo {
  id: string;
  name: string;
  language: "en" | "tl";
  quality?: string;
}

export interface VoicesResponse {
  voices: VoiceInfo[];
}

export interface TTSRequest {
  text: string;
  voice_eng?: string | null;
  voice_tgl?: string | null;
  speed?: number;
}

export type AppStatus =
  | "idle"
  | "generating"
  | "ready"
  | "playing"
  | "error";
