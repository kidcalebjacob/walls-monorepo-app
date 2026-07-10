import { useCallback, useEffect, useRef, useState } from "react";
import { Audio } from "expo-av";

import {
  setPlaybackAudioMode,
  setRecordingAudioMode,
} from "@/lib/audio-session";
import { createRecordingSilenceDetector } from "@/lib/recording-silence-detector";
import { fetchSpeechFileUri, transcribeAudio } from "@/lib/voice-api";

export type WallieVoiceState = "idle" | "listening" | "processing" | "speaking";

const MIN_RECORDING_MS = 450;

const RECORDING_OPTIONS: Audio.RecordingOptions = {
  ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
  isMeteringEnabled: true,
  progressUpdateIntervalMillis: 50,
};

const METERING_POLL_MS = 32;

export function useWallieVoice(
  onTranscript: (text: string) => Promise<string | null | undefined>,
) {
  const recordingRef = useRef<Audio.Recording | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const sessionRef = useRef(false);
  const isStartingRef = useRef(false);
  const isFinishingRef = useRef(false);
  const recordingStartedAtRef = useRef(0);
  const discardRecordingRef = useRef(false);
  const silenceDetectorRef = useRef<ReturnType<
    typeof createRecordingSilenceDetector
  > | null>(null);
  const meteringPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const levelRafRef = useRef<number | null>(null);
  const finishListeningRef = useRef<() => void>(() => undefined);
  const startListeningRef = useRef<() => Promise<void>>(async () => undefined);

  const [state, setState] = useState<WallieVoiceState>("idle");
  const [isSessionOpen, setIsSessionOpen] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);

  const stopLevelAnimation = useCallback(() => {
    if (levelRafRef.current != null) {
      cancelAnimationFrame(levelRafRef.current);
      levelRafRef.current = null;
    }
    setAudioLevel(0);
  }, []);

  const animateLevelForState = useCallback(
    (nextState: WallieVoiceState) => {
      stopLevelAnimation();

      if (nextState !== "listening" && nextState !== "speaking") {
        return;
      }

      const start = performance.now();
      const tick = (now: number) => {
        const t = (now - start) / 1000;
        const base = nextState === "speaking" ? 0.45 : 0.2;
        const wave =
          (Math.sin(t * (nextState === "speaking" ? 8 : 5)) + 1) * 0.22;
        setAudioLevel(Math.min(1, base + wave));
        levelRafRef.current = requestAnimationFrame(tick);
      };

      levelRafRef.current = requestAnimationFrame(tick);
    },
    [stopLevelAnimation],
  );

  const stopMeteringPoll = useCallback(() => {
    if (meteringPollRef.current != null) {
      clearInterval(meteringPollRef.current);
      meteringPollRef.current = null;
    }
  }, []);

  const stopSilenceDetector = useCallback(() => {
    stopMeteringPoll();
    silenceDetectorRef.current?.stop();
    silenceDetectorRef.current = null;
    stopLevelAnimation();
  }, [stopLevelAnimation, stopMeteringPoll]);

  const stopSound = useCallback(async () => {
    const sound = soundRef.current;
    soundRef.current = null;
    if (!sound) return;
    try {
      await sound.stopAsync();
      await sound.unloadAsync();
    } catch {
      // ignore unload errors during cancel
    }
  }, []);

  const stopRecordingTracks = useCallback(async () => {
    const recording = recordingRef.current;
    recordingRef.current = null;
    if (!recording) return null;

    try {
      recording.setOnRecordingStatusUpdate(null);
      const status = await recording.getStatusAsync();
      if (status.isRecording) {
        await recording.stopAndUnloadAsync();
      } else {
        await recording.stopAndUnloadAsync().catch(() => undefined);
      }
    } catch {
      // recording may already be stopped
    }

    return recording.getURI();
  }, []);

  const resetToIdle = useCallback(() => {
    setState("idle");
  }, []);

  const cancelSession = useCallback(async () => {
    sessionRef.current = false;
    setIsSessionOpen(false);
    isFinishingRef.current = false;
    isStartingRef.current = false;
    discardRecordingRef.current = false;
    stopSilenceDetector();
    await stopSound();
    await stopRecordingTracks();
    resetToIdle();
  }, [resetToIdle, stopRecordingTracks, stopSilenceDetector, stopSound]);

  const processRecording = useCallback(
    async (uri: string | null) => {
      if (!sessionRef.current) {
        resetToIdle();
        return;
      }

      if (discardRecordingRef.current) {
        discardRecordingRef.current = false;
        await startListeningRef.current();
        return;
      }

      setState("processing");
      stopLevelAnimation();

      try {
        if (!uri) throw new Error("Recording failed");

        const text = await transcribeAudio(uri);
        if (!sessionRef.current) return;

        if (!text) {
          await startListeningRef.current();
          return;
        }

        const reply = await onTranscript(text);
        if (!sessionRef.current) return;

        if (reply?.trim()) {
          setState("speaking");
          animateLevelForState("speaking");
          const fileUri = await fetchSpeechFileUri(reply);
          if (!sessionRef.current) return;

          await stopSound();
          await setPlaybackAudioMode();

          const sound = new Audio.Sound();
          soundRef.current = sound;

          sound.setOnPlaybackStatusUpdate((status) => {
            if (!status.isLoaded) {
              if (__DEV__ && "error" in status && status.error) {
                console.error("[wallie-mobile] TTS playback error:", status.error);
              }
              return;
            }

            if (status.didJustFinish) {
              void sound.unloadAsync();
              if (soundRef.current === sound) {
                soundRef.current = null;
              }
              if (sessionRef.current) {
                void startListeningRef.current();
              } else {
                resetToIdle();
              }
            }
          });

          await sound.loadAsync(
            { uri: fileUri },
            { shouldPlay: true, volume: 1.0, isMuted: false },
          );

          const playbackStatus = await sound.getStatusAsync();
          if (__DEV__) {
            console.log("[wallie-mobile] TTS playback status:", playbackStatus);
          }

          if (
            playbackStatus.isLoaded &&
            !playbackStatus.isPlaying &&
            !playbackStatus.didJustFinish
          ) {
            await sound.playAsync();
          }

          return;
        }

        await startListeningRef.current();
      } catch (error) {
        console.error("[wallie-mobile] voice:", error);
        if (sessionRef.current) {
          await startListeningRef.current();
        } else {
          resetToIdle();
        }
      }
    },
    [animateLevelForState, onTranscript, resetToIdle, stopLevelAnimation, stopSound],
  );

  const finishListening = useCallback(async () => {
    if (!sessionRef.current || isFinishingRef.current) return;

    const recording = recordingRef.current;
    if (!recording) return;

    isFinishingRef.current = true;
    stopSilenceDetector();

    try {
      const elapsed = Date.now() - recordingStartedAtRef.current;
      if (elapsed < MIN_RECORDING_MS) {
        await new Promise((resolve) =>
          setTimeout(resolve, MIN_RECORDING_MS - elapsed),
        );
      }

      const uri = await stopRecordingTracks();
      await processRecording(uri);
    } finally {
      isFinishingRef.current = false;
    }
  }, [processRecording, stopRecordingTracks, stopSilenceDetector]);

  finishListeningRef.current = () => {
    void finishListening();
  };

  const startListening = useCallback(async () => {
    if (!sessionRef.current || isStartingRef.current || isFinishingRef.current) {
      return;
    }

    if (recordingRef.current) return;

    isStartingRef.current = true;
    discardRecordingRef.current = false;
    stopSilenceDetector();

    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        throw new Error("Microphone permission is required to talk to Wallie.");
      }

      await setRecordingAudioMode();

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(RECORDING_OPTIONS);

      silenceDetectorRef.current = createRecordingSilenceDetector({
        onSilence: () => finishListeningRef.current(),
        onMaxDuration: () => {
          if (__DEV__) {
            console.log("[wallie-mobile] voice: max recording duration reached");
          }
        },
        onNoSpeech: () => {
          discardRecordingRef.current = true;
          finishListeningRef.current();
        },
        onLevel: setAudioLevel,
      });

      recording.setOnRecordingStatusUpdate((status) => {
        if (!status.isRecording) return;
        silenceDetectorRef.current?.tick(status.metering);
      });

      await recording.startAsync();

      if (!sessionRef.current) {
        await recording.stopAndUnloadAsync().catch(() => undefined);
        return;
      }

      recordingRef.current = recording;
      recordingStartedAtRef.current = Date.now();
      setState("listening");
      stopLevelAnimation();

      meteringPollRef.current = setInterval(() => {
        const activeRecording = recordingRef.current;
        if (!activeRecording || !silenceDetectorRef.current) return;

        void activeRecording.getStatusAsync().then((status) => {
          if (!status.isRecording) return;
          silenceDetectorRef.current?.tick(status.metering);
        });
      }, METERING_POLL_MS);
    } finally {
      isStartingRef.current = false;
    }
  }, [stopLevelAnimation, stopSilenceDetector]);

  startListeningRef.current = startListening;

  const enterSession = useCallback(async () => {
    if (sessionRef.current || isStartingRef.current) return;

    sessionRef.current = true;
    setIsSessionOpen(true);
    try {
      await startListening();
    } catch (error) {
      await cancelSession();
      throw error;
    }
  }, [cancelSession, startListening]);

  const exitSession = useCallback(() => {
    void cancelSession();
  }, [cancelSession]);

  useEffect(() => {
    void Audio.requestPermissionsAsync();
    void setRecordingAudioMode();

    return () => {
      sessionRef.current = false;
      stopSilenceDetector();
      void stopSound();
      void stopRecordingTracks();
    };
  }, [stopRecordingTracks, stopSilenceDetector, stopSound]);

  return {
    state,
    isSessionOpen,
    audioLevel,
    enterSession,
    exitSession,
    isBusy: state === "processing" || state === "speaking",
  };
}
