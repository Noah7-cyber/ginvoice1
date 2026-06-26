import { useState, useRef, useEffect } from 'react';
import { speechConfig } from '../utils/speechProfile';

export type SpeechEngine = 'whisper' | 'webspeech' | 'none';
export type SpeechStatus = 'idle' | 'loading_model' | 'listening' | 'processing';

export const useHybridSpeech = (profileName = speechConfig.defaultProfile) => {
  const profile = speechConfig.profiles[profileName] || speechConfig.profiles['nigerian'];
  
  const [status, setStatus] = useState<SpeechStatus>('idle');
  const [activeEngine, setActiveEngine] = useState<SpeechEngine>('none');
  const [transcript, setTranscript] = useState('');
  
  const whisperPipelineRef = useRef<any>(null);
  const webSpeechRecRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);

  // Initialize Whisper
  useEffect(() => {
    let isMounted = true;
    const loadModel = async () => {
      try {
        setStatus('loading_model');
        // Dynamically import from CDN to avoid ENOSPC npm install errors
        const transformers = await import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2');
        const transcriber = await transformers.pipeline('automatic-speech-recognition', profile.fallbackModel);
        if (isMounted) {
          whisperPipelineRef.current = transcriber;
          setActiveEngine('whisper');
          setStatus('idle');
        }
      } catch (err) {
        console.error("Failed to load local Whisper model, falling back to Web Speech", err);
        if (isMounted) {
          setActiveEngine('webspeech');
          setStatus('idle');
        }
      }
    };
    loadModel();
    
    return () => { isMounted = false; };
  }, [profile.fallbackModel]);

  const startWebSpeech = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.error("Web Speech API not supported");
      setStatus('idle');
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = profile.nativeLocale;

    recognition.onstart = () => setStatus('listening');
    recognition.onresult = (event: any) => {
      const text = Array.from(event.results)
        .map((res: any) => res[0].transcript)
        .join('');
      setTranscript(text);
    };
    recognition.onerror = () => setStatus('idle');
    recognition.onend = () => setStatus('idle');

    recognition.start();
    webSpeechRecRef.current = recognition;
  };

  const startWhisper = async () => {
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
          console.error("Whisper transcription failed, falling back to Web Speech API for next interaction", err);
          setActiveEngine('webspeech');
        }
        
        setStatus('idle');
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setStatus('listening');
    } catch (err) {
      console.error("Failed to access microphone or initialize recording for Whisper, falling back to Web Speech", err);
      setActiveEngine('webspeech');
      setStatus('idle');
    }
  };

  const toggleListening = () => {
    if (status === 'listening') {
      if (activeEngine === 'whisper' && mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
      } else if (activeEngine === 'webspeech' && webSpeechRecRef.current) {
        webSpeechRecRef.current.stop();
        setStatus('idle');
      }
    } else if (status === 'idle') {
      setTranscript('');
      if (activeEngine === 'whisper' && whisperPipelineRef.current) {
        startWhisper();
      } else {
        startWebSpeech();
      }
    }
  };

  return {
    status,
    transcript,
    activeEngine,
    toggleListening,
    setTranscript
  };
};
