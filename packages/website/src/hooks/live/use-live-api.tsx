import type { LiveConnectConfig, Transcription } from "@google/genai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AudioStreamer } from "../../lib/live/audio-streamer";
import { geminiLanguages } from "../../lib/live/gemini-languages";
import { GenAILiveClient } from "../../lib/live/genai-live-client";
import type { LiveClientOptions } from "../../lib/live/types";
import { audioContext } from "../../lib/live/utils";
import VolMeterWorket from "../../lib/live/worklets/vol-meter";

export type UseLiveAPIResults = {
  client: GenAILiveClient;
  setConfig: (config: LiveConnectConfig) => void;
  config: LiveConnectConfig;
  model: string;
  setModel: (model: string) => void;
  connected: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  volume: number;
  languageCode: string;
  setLanguageCode: (code: string) => void;
  isConnecting: boolean;
  transcription: string;
};

export function useLiveAPI(options: LiveClientOptions): UseLiveAPIResults {
  const client = useMemo(() => new GenAILiveClient(options), [options]);
  const audioStreamerRef = useRef<AudioStreamer | null>(null);

  const [model, setModel] = useState<string>("gemini-live-2.5-flash-preview");
  const [config, setConfig] = useState<LiveConnectConfig>({});
  const [connected, setConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [volume, setVolume] = useState(0);
  const [transcription, setTranscription] = useState("");
  const [languageCode, _setLanguageCode] = useState<string>("en-US");

  // register audio for streaming server -> speakers
  useEffect(() => {
    if (!audioStreamerRef.current) {
      audioContext({ id: "audio-out" }).then((audioCtx: AudioContext) => {
        audioStreamerRef.current = new AudioStreamer(audioCtx);
        audioStreamerRef.current
          .addWorklet("vumeter-out", VolMeterWorket, (ev) => {
            setVolume(ev.data.volume);
          })
          .then(() => {
            // Successfully added worklet
          });
      });
    }
  }, []);

  useEffect(() => {
    const onOpen = () => {
      setConnected(true);
    };

    const onClose = () => {
      setConnected(false);
    };

    const onError = (error: ErrorEvent) => {
      console.error("error", error);
    };

    const stopAudioStreamer = () => audioStreamerRef.current?.stop();

    const onAudio = (data: ArrayBuffer) =>
      audioStreamerRef.current?.addPCM16(new Uint8Array(data));

    client.on("error", onError);
    client.on("open", onOpen);
    client.on("close", onClose);
    const onTranscription = (data: Transcription | undefined) => {
      setTranscription((text) => {
        return data?.finished ? "" : text + data?.text;
      });
    };

    client.on("interrupted", stopAudioStreamer);
    client.on("audio", onAudio);
    client.on("outputTranscription", onTranscription);

    return () => {
      client.off("error", onError);
      client.off("open", onOpen);
      client.off("close", onClose);
      client.off("interrupted", stopAudioStreamer);
      client.off("audio", onAudio);
      client.off("outputTranscription", onTranscription);
      client.disconnect();
    };
  }, [client]);

  useEffect(() => {
    const savedLanguage = localStorage.getItem("languageCode");
    if (
      savedLanguage &&
      geminiLanguages.some((l) => l.code === savedLanguage)
    ) {
      _setLanguageCode(savedLanguage);
      return;
    }

    const detectedLanguage = navigator.language;
    if (geminiLanguages.some((lang) => lang.code === detectedLanguage)) {
      _setLanguageCode(detectedLanguage);
    }
  }, []);

  const setLanguageCode = useCallback((code: string) => {
    localStorage.setItem("languageCode", code);
    _setLanguageCode(code);
  }, []);

  const connect = useCallback(async () => {
    if (!config) {
      throw new Error("config has not been set");
    }
    setIsConnecting(true);
    try {
      client.disconnect();
      await client.connect(model, config);
    } finally {
      setIsConnecting(false);
    }
  }, [client, config, model]);

  const disconnect = useCallback(async () => {
    client.disconnect();
    setConnected(false);
  }, [client]);

  return {
    client,
    config,
    setConfig,
    model,
    setModel,
    connected,
    connect,
    disconnect,
    volume,
    languageCode,
    setLanguageCode,
    isConnecting,
    transcription,
  };
}
