export interface CompressedImageResult {
  dataUrl: string;
  name: string;
}

const MAX_SAFE_DATA_URL_LENGTH = 680_000;

function renderResizedJpeg(
  source: HTMLImageElement | HTMLVideoElement,
  sourceWidth: number,
  sourceHeight: number,
  maxDimension: number,
  quality: number
): string | null {
  let targetWidth = sourceWidth;
  let targetHeight = sourceHeight;

  if (sourceWidth > maxDimension || sourceHeight > maxDimension) {
    if (sourceWidth >= sourceHeight) {
      targetWidth = maxDimension;
      targetHeight = Math.round((sourceHeight / sourceWidth) * maxDimension);
    } else {
      targetHeight = maxDimension;
      targetWidth = Math.round((sourceWidth / sourceHeight) * maxDimension);
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, targetWidth);
  canvas.height = Math.max(1, targetHeight);

  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', quality);
}

function encodeWithinLimit(
  source: HTMLImageElement | HTMLVideoElement,
  sourceWidth: number,
  sourceHeight: number,
  initialMaxDimension: number,
  initialQuality: number
): string | null {
  const attempts: Array<{ dim: number; quality: number }> = [
    { dim: initialMaxDimension, quality: initialQuality },
    { dim: Math.min(initialMaxDimension, 960), quality: 0.65 },
    { dim: Math.min(initialMaxDimension, 800), quality: 0.55 },
    { dim: Math.min(initialMaxDimension, 640), quality: 0.45 },
  ];

  let lastOutput: string | null = null;
  for (const step of attempts) {
    const encoded = renderResizedJpeg(
      source,
      sourceWidth,
      sourceHeight,
      step.dim,
      step.quality
    );
    if (!encoded) return null;
    lastOutput = encoded;
    if (encoded.length <= MAX_SAFE_DATA_URL_LENGTH) {
      return encoded;
    }
  }
  return lastOutput;
}

/**
 * Compresses an uploaded or camera-captured image on the client so it fits safely
 * in preview sessionStorage and Cloudflare Workers /api payloads.
 */
export async function compressImageFile(
  file: File,
  maxDimension = 1024,
  quality = 0.78
): Promise<CompressedImageResult> {
  if (!file.type.startsWith('image/')) {
    throw new Error('이미지 파일(사진)만 선택할 수 있습니다.');
  }

  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('사진 파일을 읽을 수 없습니다.'));
      }
    };
    reader.onerror = () =>
      reject(new Error('사진 파일을 읽는 중 오류가 발생했습니다.'));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('사진을 불러올 수 없습니다.'));
    image.src = rawDataUrl;
  });

  const compressedDataUrl = encodeWithinLimit(
    img,
    img.width,
    img.height,
    maxDimension,
    quality
  );

  if (!compressedDataUrl) {
    if (rawDataUrl.length > MAX_SAFE_DATA_URL_LENGTH) {
      throw new Error('사진 용량이 너무 커서 압축할 수 없습니다.');
    }
    return { dataUrl: rawDataUrl, name: file.name || 'observed_space.jpg' };
  }

  if (compressedDataUrl.length > 740_000) {
    throw new Error(
      '사진 용량이 허용 범위를 초과했습니다. 다른 사진으로 다시 시도해 주세요.'
    );
  }

  return {
    dataUrl: compressedDataUrl,
    name: file.name || 'observed_space.jpg',
  };
}

/**
 * Captures and compresses a single frame from a live HTMLVideoElement stream.
 */
export function captureVideoFrame(
  video: HTMLVideoElement,
  maxDimension = 1024,
  quality = 0.78
): CompressedImageResult {
  const width = video.videoWidth || 1280;
  const height = video.videoHeight || 720;

  const dataUrl = encodeWithinLimit(video, width, height, maxDimension, quality);
  if (!dataUrl) {
    throw new Error('카메라 화면을 이미지로 변환할 수 없습니다.');
  }

  return {
    dataUrl,
    name: `captured_space_${Date.now()}.jpg`,
  };
}


