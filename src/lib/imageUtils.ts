export interface CompressedImageResult {
  dataUrl: string;
  name: string;
}

/**
 * Compresses an uploaded or camera-captured image on the client so it fits safely
 * in preview sessionStorage and future Cloudflare Workers /api payloads.
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
    reader.onerror = () => reject(new Error('사진 파일을 읽는 중 오류가 발생했습니다.'));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('사진을 불러올 수 없습니다.'));
    image.src = rawDataUrl;
  });

  const { width, height } = img;
  let targetWidth = width;
  let targetHeight = height;

  if (width > maxDimension || height > maxDimension) {
    if (width >= height) {
      targetWidth = maxDimension;
      targetHeight = Math.round((height / width) * maxDimension);
    } else {
      targetHeight = maxDimension;
      targetWidth = Math.round((width / height) * maxDimension);
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, targetWidth);
  canvas.height = Math.max(1, targetHeight);

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return { dataUrl: rawDataUrl, name: file.name };
  }

  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);

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

  let targetWidth = width;
  let targetHeight = height;

  if (width > maxDimension || height > maxDimension) {
    if (width >= height) {
      targetWidth = maxDimension;
      targetHeight = Math.round((height / width) * maxDimension);
    } else {
      targetHeight = maxDimension;
      targetWidth = Math.round((width / height) * maxDimension);
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, targetWidth);
  canvas.height = Math.max(1, targetHeight);

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('카메라 화면을 이미지로 변환할 수 없습니다.');
  }

  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL('image/jpeg', quality);

  return {
    dataUrl,
    name: `captured_space_${Date.now()}.jpg`,
  };
}

