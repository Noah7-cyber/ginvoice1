import { useState, useRef, useEffect } from 'react';

export type SpeechStatus = 'idle' | 'loading_model' | 'listening' | 'processing';

export const useHybridSpeech = () => {
  const [status, setStatus] = useState<SpeechStatus>('idle');
  const [transcript, setTranscript] = useState('');
  
  const whisperPipelineRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);

  // Initialize Local Whisper-tiny
  useEffect(() => {
    let isMounted = true;
    const loadModel = async () => {
      try {
        setStatus('loading_model');
        // Dynamically import from CDN to avoid ENOSPC npm install errors
        const transformers = await import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2');
        transformers.env.allowLocalModels = false;
        // Using the free tiny model
        const transcriber = await transformers.pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en');
        if (isMounted) {
          whisperPipelineRef.current = transcriber;
          setStatus('idle');
        }
      } catch (err) {
        console.error("Failed to load local Whisper model", err);
        if (isMounted) {
          setStatus('idle'); // We will just gracefully fail if they try to record
        }
      }
    };
    loadModel();
    
    return () => { isMounted = false; };
  }, []);

  const startRecording = async () => {
    if (!whisperPipelineRef.current) {
      console.warn("Model is not loaded yet.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        setStatus('processing');
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        try {
          const arrayBuffer = await audioBlob.arrayBuffer();
          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
          const float32Array = audioBuffer.getChannelData(0);

          if (whisperPipelineRef.current) {
             const result = await whisperPipelineRef.current(float32Array);
             setTranscript(result.text);
          }
        } catch (err) {
          console.error("Local Whisper transcription failed", err);
        }
        
        setStatus('idle');
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setStatus('listening');
    } catch (err) {
      console.error("Failed to access microphone", err);
      setStatus('idle');
    }
  };

  const toggleListening = () => {
    if (status === 'listening') {
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
      }
    } else if (status === 'idle') {
      setTranscript('');
      startRecording();
    }
  };

  return {
    status,
    transcript,
    toggleListening,
    setTranscript
  };
};
