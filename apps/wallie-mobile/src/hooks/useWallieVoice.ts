import { useCallback, useEffect, useRef, useState } from "react";
import { Audio } from "expo-av";

import { fetchSpeechFileUri, transcribeAudio } from "@/lib/voice-api";

export function useWallieVoice(
  onTranscript: (text: string) => Promise<string | null | undefined>,
) {
  const recordingRef = useRef<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    void Audio.requestPermissionsAsync();
    void Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });
  }, []);

  const startRecording = useCallback(async () => {
    if (isRecording || isProcessing) return;

    const permission = await Audio.requestPermissionsAsync();
    if (!permission.granted) {
      throw new Error("Microphone permission is required to talk to Wallie.");
    }

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });

    const recording = new Audio.Recording();
    await recording.prepareToRecordAsync(
      Audio.RecordingOptionsPresets.HIGH_QUALITY,
    );
    await recording.startAsync();
    recordingRef.current = recording;
    setIsRecording(true);
  }, [isProcessing, isRecording]);

  const stopRecording = useCallback(async () => {
    const recording = recordingRef.current;
    if (!recording || !isRecording) return;

    setIsRecording(false);
    setIsProcessing(true);

    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      recordingRef.current = null;

      if (!uri) throw new Error("Recording failed");

      const text = await transcribeAudio(uri);
      if (text) {
        const reply = await onTranscript(text);
        if (reply?.trim()) {
          setIsSpeaking(true);
          const fileUri = await fetchSpeechFileUri(reply);
          const sound = new Audio.Sound();
          await sound.loadAsync({ uri: fileUri });
          sound.setOnPlaybackStatusUpdate((status) => {
            if (!status.isLoaded) return;
            if (status.didJustFinish) {
              setIsSpeaking(false);
              void sound.unloadAsync();
            }
          });
          await sound.playAsync();
        }
      }
    } catch (error) {
      console.error("[wallie-mobile] voice:", error);
      throw error;
    } finally {
      setIsProcessing(false);
    }
  }, [isRecording, onTranscript]);

  return {
    isRecording,
    isProcessing,
    isSpeaking,
    startRecording,
    stopRecording,
  };
}
