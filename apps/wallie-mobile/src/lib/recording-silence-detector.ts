/** dBFS thresholds — iOS expo-av metering runs from about -160 (quiet) to 0 (loud). */
const SPEECH_DB = -40;
const SILENCE_DURATION_MS = 1100;
const SILENCE_GRACE_MS = 150;
const MIN_SPEECH_MS = 400;
const MAX_RECORDING_MS = 90_000;
const NO_SPEECH_TIMEOUT_MS = 20_000;

export interface RecordingSilenceDetector {
  tick: (meteringDb?: number) => void;
  stop: () => void;
}

interface RecordingSilenceDetectorOptions {
  onSilence: () => void;
  onMaxDuration?: () => void;
  onNoSpeech?: () => void;
  onLevel?: (level: number) => void;
}

function meteringToLevel(db: number): number {
  const clamped = Math.max(-60, Math.min(0, db));
  const normalized = (clamped + 60) / 60;
  // Boost mid-range speech so the orb reacts more like the web analyser.
  return Math.min(1, Math.pow(normalized, 0.72) * 1.15);
}

export function createRecordingSilenceDetector({
  onSilence,
  onMaxDuration,
  onNoSpeech,
  onLevel,
}: RecordingSilenceDetectorOptions): RecordingSilenceDetector {
  let stopped = false;
  let silenceStart: number | null = null;
  let speechDetected = false;
  let speechStartTime: number | null = null;
  const startedAt = Date.now();

  const stop = () => {
    if (stopped) return;
    stopped = true;
    clearTimeout(maxTimer);
    clearTimeout(noSpeechTimer);
    onLevel?.(0);
  };

  const maxTimer = setTimeout(() => {
    stop();
    onMaxDuration?.();
    onSilence();
  }, MAX_RECORDING_MS);

  const noSpeechTimer = setTimeout(() => {
    if (!speechDetected && !stopped) {
      stop();
      onNoSpeech?.();
    }
  }, NO_SPEECH_TIMEOUT_MS);

  let lastLevel = 0;

  const tick = (meteringDb?: number) => {
    if (stopped) return;

    if (meteringDb != null && !Number.isNaN(meteringDb)) {
      lastLevel = meteringToLevel(meteringDb);
      onLevel?.(lastLevel);
    } else if (lastLevel > 0) {
      onLevel?.(lastLevel);
    }

    if (meteringDb == null || Number.isNaN(meteringDb)) {
      return;
    }

    const now = Date.now();

    if (meteringDb > SPEECH_DB) {
      if (!speechDetected) {
        speechDetected = true;
        speechStartTime = now;
      }
      silenceStart = null;
      return;
    }

    if (!speechDetected) return;

    if (!silenceStart) {
      silenceStart = now + SILENCE_GRACE_MS;
      return;
    }

    if (now < silenceStart) return;

    if (
      now - silenceStart >= SILENCE_DURATION_MS &&
      speechStartTime &&
      now - speechStartTime >= MIN_SPEECH_MS &&
      now - startedAt >= MIN_SPEECH_MS
    ) {
      stop();
      onSilence();
    }
  };

  return { tick, stop };
}
