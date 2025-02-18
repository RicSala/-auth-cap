// export const SUPPORTED_AUDIO_FORMATS = [
//   'webm',
//   'ogg',
//   'wav',
//   'm4a',
//   'mp3',
//   'mp4',
//   'mpeg',
//   'mpga',
//   'flac',
//   'ogg',
// ];

export const AUDIO_CONFIGS = {
  'audio/webm;codecs=opus': {
    extension: 'webm',
    estimatedSizeMBPerMinute: 0.75,
    priority: 1,
  },
  'audio/webm': {
    extension: 'webm',
    estimatedSizeMBPerMinute: 1,
    priority: 2,
  },
  'audio/mp4': {
    extension: 'mp4',
    estimatedSizeMBPerMinute: 1.5,
    priority: 3,
  },
  'audio/mpeg': {
    extension: 'mp3',
    estimatedSizeMBPerMinute: 1.5,
    priority: 4,
  },
} as const;

// Type for MIME types
export type SupportedMimeType = keyof typeof AUDIO_CONFIGS;
export type SupportedFormats =
  (typeof AUDIO_CONFIGS)[keyof typeof AUDIO_CONFIGS]['extension'];

export function getBestSupportedMimeType(): SupportedMimeType {
  return (
    (Object.keys(AUDIO_CONFIGS) as SupportedMimeType[])
      .sort((a, b) => AUDIO_CONFIGS[a].priority - AUDIO_CONFIGS[b].priority)
      .find((type) => MediaRecorder.isTypeSupported(type)) ?? 'audio/mp4'
  );
}

export function listSupportedFileExtensions(): SupportedFormats[] {
  return Object.keys(AUDIO_CONFIGS).map(
    (key) => AUDIO_CONFIGS[key as keyof typeof AUDIO_CONFIGS].extension
  );
}

export function acceptedAudioFormatsString(): string {
  return listSupportedFileExtensions()
    .map((ext) => `.${ext}`)
    .join(', ');
}

export function isSupportedMimeType(
  mimeType: string
): mimeType is SupportedMimeType {
  return Object.keys(AUDIO_CONFIGS).includes(mimeType);
}

export function getFileExtensionOrThrow(mimeType: string): SupportedFormats {
  if (!isSupportedMimeType(mimeType)) {
    throw new Error(`Formato no soportado: ${mimeType}`);
  }
  return AUDIO_CONFIGS[mimeType].extension;
}

export const getMimeTypeFromExtension = (
  extension: string
): SupportedMimeType => {
  const mimeType = Object.keys(AUDIO_CONFIGS).find(
    (key) =>
      AUDIO_CONFIGS[key as keyof typeof AUDIO_CONFIGS].extension === extension
  );
  if (!mimeType) {
    throw new Error(`Formato no soportado: ${extension}`);
  }
  return mimeType as SupportedMimeType;
};

export function generateFileName(mimeType: SupportedMimeType): string {
  const extension = getFileExtensionOrThrow(mimeType);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `recording-${timestamp}.${extension}`;
}
