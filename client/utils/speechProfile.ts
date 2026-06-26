export interface SpeechProfile {
  fallbackModel: string;
  nativeLocale: string;
}

export const speechConfig = {
  defaultProfile: 'nigerian',
  profiles: {
    nigerian: {
      fallbackModel: 'benjaminogbonna/whisper-tiny-for-nigerian-common-languages',
      nativeLocale: 'en-NG'
    }
  } as Record<string, SpeechProfile>
};
