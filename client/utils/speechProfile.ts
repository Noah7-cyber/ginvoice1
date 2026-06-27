export interface SpeechProfile {
  fallbackModel: string;
  nativeLocale: string;
}

export const speechConfig = {
  defaultProfile: 'nigerian',
  profiles: {
    nigerian: {
      fallbackModel: 'Xenova/whisper-tiny',
      nativeLocale: 'en-NG'
    }
  } as Record<string, SpeechProfile>
};
