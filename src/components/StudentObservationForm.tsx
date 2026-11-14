import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Camera,
  Check,
  Clock,
  RefreshCw,
  Send,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  GROUP_NAME_PRESETS,
  SCHOOL_LOCATION_PRESETS,
  type ObservationInput,
  type ObservationRecord,
} from '../types/observation';
import { captureVideoFrame, compressImageFile } from '../lib/imageUtils';
import {
  submitObservation,
  type ApiSubmitObservationResult,
} from '../lib/observationApi';

interface StudentObservationFormProps {
  onObservationSubmitted: (result: ApiSubmitObservationResult) => void;
  sessionRecords: ObservationRecord[];
  onDeletePreviewRecord: (id: string) => void;
  onGoToTeacherView: () => void;
  onGoToLesson2: () => void;
}

const INITIAL_FORM: ObservationInput = {
  classInfo: '',
  authorName: '',
  groupName: '1모둠',
  locationCategory: '복도',
  locationDetail: '',
  wasteScene: '',
  wasteCause: '',
  sensorIdea: '',
  photoDataUrl: '',
  photoCaption: '',
  privacyConfirmed: false,
};

export const StudentObservationForm: React.FC<StudentObservationFormProps> = ({
  onObservationSubmitted,
  sessionRecords,
  onDeletePreviewRecord,
  onGoToTeacherView,
  onGoToLesson2,
}) => {
  const [form, setForm] = useState<ObservationInput>(INITIAL_FORM);
  const [groupPreset, setGroupPreset] = useState<string>('1모둠');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [photoError, setPhotoError] = useState<string>('');
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [isRequestingCamera, setIsRequestingCamera] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>(
    'environment'
  );
  const [cameraFallbackAvailable, setCameraFallbackAvailable] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitFeedback, setSubmitFeedback] =
    useState<ApiSubmitObservationResult | null>(null);

  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const nativeCaptureInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCameraStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraOpen(false);
  }, []);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (isCameraOpen && videoRef.current && streamRef.current) {
      const videoEl = videoRef.current;
      videoEl.srcObject = streamRef.current;
      void videoEl.play().catch(() => {
        // Ignore autoplay promise rejection if already playing
      });
    }
  }, [isCameraOpen]);

  const startCamera = async (targetFacing: 'environment' | 'user') => {
    setPhotoError('');
    setCameraFallbackAvailable(false);

    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== 'function'
    ) {
      setPhotoError(
        '현재 브라우저 환경에서 실시간 카메라 실행이 지원되지 않습니다. 아래 기기 카메라 또는 사진 업로드하기를 이용해 주세요.'
      );
      setCameraFallbackAvailable(true);
      return;
    }

    stopCameraStream();
    setIsRequestingCamera(true);

    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: targetFacing } },
          audio: false,
        });
      } catch (firstErr) {
        // Retry with generic video constraint if ideal facingMode fails on some webcams
        if (
          firstErr instanceof DOMException &&
          (firstErr.name === 'OverconstrainedError' ||
            firstErr.name === 'ConstraintNotSatisfiedError')
        ) {
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        } else {
          throw firstErr;
        }
      }

      streamRef.current = stream;
      setFacingMode(targetFacing);
      setIsCameraOpen(true);
    } catch (err) {
      stopCameraStream();
      if (err instanceof DOMException) {
        if (
          err.name === 'NotAllowedError' ||
          err.name === 'PermissionDeniedError'
        ) {
          setPhotoError(
            '카메라 권한이 허용되지 않았습니다. 브라우저 상단의 카메라 권한 안내에서 "허용"을 선택하거나, 아래 기기 카메라/사진 업로드하기를 이용해 주세요.'
          );
          setCameraFallbackAvailable(true);
        } else if (
          err.name === 'NotFoundError' ||
          err.name === 'DevicesNotFoundError'
        ) {
          setPhotoError(
            '이 기기에서 연결된 카메라(웹캠)를 찾지 못했습니다. [사진 업로드하기] 버튼으로 저장된 사진을 올려 주세요.'
          );
        } else if (
          err.name === 'NotReadableError' ||
          err.name === 'TrackStartError'
        ) {
          setPhotoError(
            '카메라가 다른 프로그램에서 사용 중입니다. 다른 앱을 닫고 다시 시도하거나 [사진 업로드하기]를 이용해 주세요.'
          );
          setCameraFallbackAvailable(true);
        } else {
          setPhotoError(
            `카메라를 여는 중 문제가 발생했습니다(${err.name}). [사진 업로드하기]를 이용해 주세요.`
          );
          setCameraFallbackAvailable(true);
        }
      } else {
        setPhotoError(
          '카메라를 시작할 수 없습니다. [사진 업로드하기] 버튼을 이용해 주세요.'
        );
        setCameraFallbackAvailable(true);
      }
    } finally {
      setIsRequestingCamera(false);
    }
  };

  const handleCapturePhoto = () => {
    if (!videoRef.current) return;
    setPhotoError('');
    try {
      const captured = captureVideoFrame(videoRef.current);
      setForm((prev) => ({
        ...prev,
        photoDataUrl: captured.dataUrl,
        photoCaption: prev.photoCaption || '',
      }));
      stopCameraStream();
    } catch (err) {
      setPhotoError(
        err instanceof Error ? err.message : '사진 촬영에 실패했습니다.'
      );
    }
  };

  const handleSwitchCamera = () => {
    const nextFacing = facingMode === 'environment' ? 'user' : 'environment';
    void startCamera(nextFacing);
  };

  const handleGroupPresetSelect = (preset: string) => {
    setGroupPreset(preset);
    if (preset === '직접 입력') {
      setForm((prev) => ({ ...prev, groupName: '' }));
    } else {
      setForm((prev) => ({ ...prev, groupName: preset }));
    }
    if (errors.groupName) {
      setErrors((prev) => ({ ...prev, groupName: '' }));
    }
  };

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPhotoError('');
    setCameraFallbackAvailable(false);
    stopCameraStream();
    setIsProcessingPhoto(true);
    try {
      const compressed = await compressImageFile(file);
      setForm((prev) => ({
        ...prev,
        photoDataUrl: compressed.dataUrl,
        photoCaption: prev.photoCaption || compressed.name,
      }));
    } catch (err) {
      setPhotoError(
        err instanceof Error ? err.message : '사진을 처리하지 못했습니다.'
      );
    } finally {
      setIsProcessingPhoto(false);
      if (uploadInputRef.current) {
        uploadInputRef.current.value = '';
      }
      if (nativeCaptureInputRef.current) {
        nativeCaptureInputRef.current.value = '';
      }
    }
  };

  const handleRemovePhoto = () => {
    setForm((prev) => ({
      ...prev,
      photoDataUrl: '',
      photoCaption: '',
    }));
    setPhotoError('');
  };

  const validate = (): boolean => {
    const nextErrors: Record<string, string> = {};

    if (!form.classInfo.trim()) {
      nextErrors.classInfo = '학반·번호를 입력해 주세요. (예: 1학년 2반 5번)';
    }

    if (!form.authorName.trim()) {
      nextErrors.authorName = '이름을 입력해 주세요.';
    }

    if (!form.groupName.trim()) {
      nextErrors.groupName =
        '소속 모둠을 선택하거나 입력해 주세요. (교사가 모둠별로 모아볼 때 사용합니다)';
    }

    if (
      form.locationCategory === '직접 입력' &&
      !form.locationDetail.trim()
    ) {
      nextErrors.locationDetail = '관찰한 공간의 이름을 입력해 주세요.';
    }

    if (!form.wasteScene.trim()) {
      nextErrors.wasteScene = '발견한 에너지 낭비 장면을 구체적으로 적어 주세요.';
    }

    if (!form.wasteCause.trim()) {
      nextErrors.wasteCause = '에너지가 낭비되는 원인이나 문제점을 적어 주세요.';
    }

    if (!form.privacyConfirmed) {
      nextErrors.privacyConfirmed =
        '사진 촬영 및 디지털 안전 약속 확인에 체크해 주세요.';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const cleaned: ObservationInput = {
        ...form,
        classInfo: form.classInfo.trim(),
        authorName: form.authorName.trim(),
        groupName: form.groupName.trim(),
        locationDetail: form.locationDetail.trim(),
        wasteScene: form.wasteScene.trim(),
        wasteCause: form.wasteCause.trim(),
        sensorIdea: form.sensorIdea.trim(),
        photoCaption: form.photoCaption.trim(),
      };

      const result = await submitObservation(cleaned);
      setSubmitFeedback(result);
      onObservationSubmitted(result);

      setForm((prev) => ({
        ...INITIAL_FORM,
        classInfo: prev.classInfo,
        authorName: prev.authorName,
        groupName: prev.groupName,
      }));
      setErrors({});
      setPhotoError('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTime = (iso: string) => {
    try {
      return new Intl.DateTimeFormat('ko-KR', {
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(iso));
    } catch {
      return '';
    }
  };

  return (
    <section
      id="observation-form"
      aria-labelledby="observation-form-title"
      className="space-y-6"
    >
      <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="border-b border-slate-100 pb-4">
          <p className="text-xs font-semibold text-emerald-800">
            1단계 · 개인별 작성 (완료 후 교사가 모둠별로 결과를 공개합니다)
          </p>
          <h2
            id="observation-form-title"
            className="mt-1 text-lg font-bold text-slate-900 sm:text-xl"
          >
            개인 관찰 일지 작성하기
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            내 학반·이름과 소속 모둠을 적고, 발견한 에너지 낭비 공간의 사진과
            내용을 기록하세요.
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="mt-5 space-y-5">
          {/* 1. 학생 및 소속 모둠 정보 */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label
                htmlFor="class-info"
                className="block text-sm font-semibold text-slate-900"
              >
                학반 · 번호
              </label>
              <input
                id="class-info"
                type="text"
                value={form.classInfo}
                onChange={(e) => {
                  setForm({ ...form, classInfo: e.target.value });
                  if (errors.classInfo) {
                    setErrors((prev) => ({ ...prev, classInfo: '' }));
                  }
                }}
                placeholder="예: 1학년 2반 5번"
                maxLength={40}
                className="min-h-[46px] w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-base text-slate-900 placeholder:text-slate-400 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20"
              />
              {errors.classInfo && (
                <p role="alert" className="text-xs font-medium text-rose-700">
                  {errors.classInfo}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="author-name"
                className="block text-sm font-semibold text-slate-900"
              >
                이름
              </label>
              <input
                id="author-name"
                type="text"
                value={form.authorName}
                onChange={(e) => {
                  setForm({ ...form, authorName: e.target.value });
                  if (errors.authorName) {
                    setErrors((prev) => ({ ...prev, authorName: '' }));
                  }
                }}
                placeholder="예: 김에코"
                maxLength={40}
                className="min-h-[46px] w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-base text-slate-900 placeholder:text-slate-400 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20"
              />
              {errors.authorName && (
                <p role="alert" className="text-xs font-medium text-rose-700">
                  {errors.authorName}
                </p>
              )}
            </div>
          </div>

          {/* 소속 모둠 선택 */}
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-slate-900">
              1. 소속 모둠 선택
            </legend>
            <p className="text-xs text-slate-500">
              개인 작성이 모두 끝나면 선생님이 모둠별로 결과를 모아 보여줄 때
              기준이 됩니다.
            </p>
            <div className="flex flex-wrap gap-2">
              {GROUP_NAME_PRESETS.map((preset) => {
                const selected = groupPreset === preset;
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => handleGroupPresetSelect(preset)}
                    aria-pressed={selected}
                    className={`min-h-[44px] rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                      selected
                        ? 'border-emerald-700 bg-emerald-700 text-white'
                        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {preset}
                  </button>
                );
              })}
            </div>
            {groupPreset === '직접 입력' && (
              <div className="pt-1">
                <label htmlFor="custom-group-name" className="sr-only">
                  모둠 이름 직접 입력
                </label>
                <input
                  id="custom-group-name"
                  type="text"
                  value={form.groupName}
                  onChange={(e) => {
                    setForm({ ...form, groupName: e.target.value });
                    if (errors.groupName) {
                      setErrors((prev) => ({ ...prev, groupName: '' }));
                    }
                  }}
                  placeholder="예: 7모둠 또는 에코탐험대"
                  maxLength={30}
                  className="min-h-[46px] w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-base text-slate-900 placeholder:text-slate-400 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20"
                />
              </div>
            )}
            {errors.groupName && (
              <p role="alert" className="text-xs font-medium text-rose-700">
                {errors.groupName}
              </p>
            )}
          </fieldset>

          {/* 2. 관찰한 학교 공간 */}
          <fieldset className="space-y-2.5">
            <legend className="text-sm font-semibold text-slate-900">
              2. 관찰한 학교 공간
            </legend>
            <div className="flex flex-wrap gap-2">
              {SCHOOL_LOCATION_PRESETS.map((preset) => {
                const selected = form.locationCategory === preset;
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      setForm({ ...form, locationCategory: preset });
                      if (errors.locationDetail) {
                        setErrors((prev) => ({ ...prev, locationDetail: '' }));
                      }
                    }}
                    aria-pressed={selected}
                    className={`min-h-[44px] rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                      selected
                        ? 'border-emerald-700 bg-emerald-700 text-white'
                        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {preset}
                  </button>
                );
              })}
            </div>

            <div className="space-y-1.5 pt-1">
              <label
                htmlFor="location-detail"
                className="block text-xs font-medium text-slate-600"
              >
                {form.locationCategory === '직접 입력'
                  ? '관찰한 공간 이름 (필수)'
                  : '세부 위치 메모 (선택 · 예: 2층 1-3반 앞, 본관 중앙계단)'}
              </label>
              <input
                id="location-detail"
                type="text"
                value={form.locationDetail}
                onChange={(e) => {
                  setForm({ ...form, locationDetail: e.target.value });
                  if (errors.locationDetail) {
                    setErrors((prev) => ({ ...prev, locationDetail: '' }));
                  }
                }}
                placeholder={
                  form.locationCategory === '직접 입력'
                    ? '예: 급식실 입구, 도서관 열람실'
                    : '예: 2층 1-3반 앞'
                }
                maxLength={60}
                className="min-h-[46px] w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-base text-slate-900 placeholder:text-slate-400 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20"
              />
              {errors.locationDetail && (
                <p role="alert" className="text-xs font-medium text-rose-700">
                  {errors.locationDetail}
                </p>
              )}
            </div>
          </fieldset>

          {/* 3. 관찰 장소 사진 찍기 / 올리기 */}
          <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-slate-900">
                3. 관찰 장소 사진 찍기 / 올리기
              </p>
              <p className="text-xs leading-relaxed text-slate-600">
                제출한 사진은 나중에 프로그램으로 해결한 모습을 구현할 때 기준
                사진으로 그대로 사용합니다. 친구 얼굴이 나오지 않도록 공간과
                설비만 촬영해 주세요.
              </p>
            </div>

            {/* 사진 업로드용 파일 선택기 (capture 없음: 파일/앨범 열기) */}
            <input
              ref={uploadInputRef}
              id="location-photo-upload"
              type="file"
              accept="image/*"
              onChange={handlePhotoSelect}
              className="sr-only"
            />

            {/* 권한 차단/미지원 환경용 기기 카메라 fallback 입력 */}
            <input
              ref={nativeCaptureInputRef}
              id="location-photo-native-capture"
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhotoSelect}
              className="sr-only"
            />

            {/* 실시간 카메라 뷰파인더 */}
            {isCameraOpen && (
              <div className="space-y-3 rounded-xl border border-slate-300 bg-slate-950 p-3">
                <div className="overflow-hidden rounded-lg bg-black">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="max-h-72 w-full object-contain mx-auto"
                  />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCapturePhoto}
                      className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 whitespace-nowrap"
                    >
                      <Camera className="h-4 w-4" aria-hidden="true" />
                      <span>지금 촬영하기</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleSwitchCamera}
                      className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-100 hover:bg-slate-700 whitespace-nowrap"
                    >
                      <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>카메라 전환</span>
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={stopCameraStream}
                    className="inline-flex min-h-[44px] items-center justify-center gap-1 rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 whitespace-nowrap"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>닫기</span>
                  </button>
                </div>
              </div>
            )}

            {/* 두 개의 분리된 기본 버튼: [사진 촬영하기] / [사진 업로드하기] */}
            {!isCameraOpen && !form.photoDataUrl && (
              <div className="grid grid-cols-1 gap-2.5 pt-1 sm:grid-cols-2">
                <button
                  type="button"
                  disabled={isRequestingCamera || isProcessingPhoto}
                  onClick={() => void startCamera(facingMode)}
                  className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-lg border border-emerald-700 bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-800 disabled:opacity-60 whitespace-nowrap"
                >
                  <Camera className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>
                    {isRequestingCamera
                      ? '카메라 권한 확인 중...'
                      : '사진 촬영하기'}
                  </span>
                </button>
                <button
                  type="button"
                  disabled={isRequestingCamera || isProcessingPhoto}
                  onClick={() => uploadInputRef.current?.click()}
                  className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-100 disabled:opacity-60 whitespace-nowrap"
                >
                  <Upload className="h-4 w-4 shrink-0 text-slate-600" aria-hidden="true" />
                  <span>
                    {isProcessingPhoto ? '사진 불러오는 중...' : '사진 업로드하기'}
                  </span>
                </button>
              </div>
            )}

            {/* 촬영/업로드 완료된 사진 미리보기 */}
            {!isCameraOpen && form.photoDataUrl && (
              <div className="space-y-3 pt-1">
                <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-slate-900/5">
                  <img
                    src={form.photoDataUrl}
                    alt={form.photoCaption || '관찰한 학교 공간 사진 미리보기'}
                    referrerPolicy="no-referrer"
                    className="max-h-64 w-full object-contain mx-auto"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <input
                    type="text"
                    value={form.photoCaption}
                    onChange={(e) =>
                      setForm({ ...form, photoCaption: e.target.value })
                    }
                    placeholder="사진 설명 한 줄 (예: 빈 교실 천장 형광등 6개 켜짐)"
                    aria-label="사진 설명"
                    maxLength={80}
                    className="min-h-[42px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-700 focus:outline-none"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void startCamera(facingMode)}
                      className="inline-flex min-h-[42px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                    >
                      <Camera className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>다시 촬영하기</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => uploadInputRef.current?.click()}
                      className="inline-flex min-h-[42px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                    >
                      <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>다른 사진 업로드</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      className="inline-flex min-h-[42px] items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 whitespace-nowrap"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>삭제</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {photoError && (
              <div
                role="alert"
                className="space-y-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900"
              >
                <p className="font-medium leading-relaxed">{photoError}</p>
                {cameraFallbackAvailable && (
                  <button
                    type="button"
                    onClick={() => nativeCaptureInputRef.current?.click()}
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-semibold text-rose-900 hover:bg-rose-100/50"
                  >
                    <Camera className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>기기 카메라 앱으로 찍기</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* 4. 발견한 에너지 낭비 장면 */}
          <div className="space-y-1.5">
            <label
              htmlFor="waste-scene"
              className="block text-sm font-semibold text-slate-900"
            >
              4. 발견한 에너지 낭비 장면
            </label>
            <p className="text-xs text-slate-500">
              언제, 어디에서, 어떤 에너지(조명, 냉난방기 등)가 불필요하게 쓰이고
              있었나요?
            </p>
            <textarea
              id="waste-scene"
              rows={3}
              value={form.wasteScene}
              onChange={(e) => {
                setForm({ ...form, wasteScene: e.target.value });
                if (errors.wasteScene) {
                  setErrors((prev) => ({ ...prev, wasteScene: '' }));
                }
              }}
              placeholder="예: 이동 수업 시간이라 교실에 아무도 없는데 형광등과 선풍기가 모두 켜져 있음"
              maxLength={400}
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-base leading-relaxed text-slate-900 placeholder:text-slate-400 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20"
            />
            {errors.wasteScene && (
              <p role="alert" className="text-xs font-medium text-rose-700">
                {errors.wasteScene}
              </p>
            )}
          </div>

          {/* 5. 낭비 원인 또는 문제점 */}
          <div className="space-y-1.5">
            <label
              htmlFor="waste-cause"
              className="block text-sm font-semibold text-slate-900"
            >
              5. 왜 낭비되고 있을까? (원인과 불편한 점)
            </label>
            <textarea
              id="waste-cause"
              rows={2}
              value={form.wasteCause}
              onChange={(e) => {
                setForm({ ...form, wasteCause: e.target.value });
                if (errors.wasteCause) {
                  setErrors((prev) => ({ ...prev, wasteCause: '' }));
                }
              }}
              placeholder="예: 급하게 이동하느라 스위치를 끄는 것을 잊어버리고, 복도에서는 켜져 있는지 바로 확인하기 어려움"
              maxLength={300}
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-base leading-relaxed text-slate-900 placeholder:text-slate-400 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20"
            />
            {errors.wasteCause && (
              <p role="alert" className="text-xs font-medium text-rose-700">
                {errors.wasteCause}
              </p>
            )}
          </div>

          {/* 6. 센서로 바꾸는 한 줄 아이디어 (선택) */}
          <div className="space-y-1.5">
            <label
              htmlFor="sensor-idea"
              className="block text-sm font-semibold text-slate-900"
            >
              6. 센서와 코딩으로 해결한다면? (선택)
            </label>
            <input
              id="sensor-idea"
              type="text"
              value={form.sensorIdea}
              onChange={(e) =>
                setForm({ ...form, sensorIdea: e.target.value })
              }
              placeholder="예: 인체감지 센서로 5분 동안 움직임이 없으면 조명이 자동으로 꺼지게 하기"
              maxLength={200}
              className="min-h-[46px] w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-base text-slate-900 placeholder:text-slate-400 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20"
            />
          </div>

          {/* 디지털 안전 확인 */}
          <div className="space-y-1.5 rounded-lg border border-slate-200 bg-slate-50 p-3.5">
            <label className="flex min-h-[44px] cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={form.privacyConfirmed}
                onChange={(e) => {
                  setForm({ ...form, privacyConfirmed: e.target.checked });
                  if (errors.privacyConfirmed) {
                    setErrors((prev) => ({ ...prev, privacyConfirmed: '' }));
                  }
                }}
                className="mt-1 h-5 w-5 shrink-0 rounded border-slate-400 text-emerald-700 focus:ring-emerald-700"
              />
              <span className="text-sm leading-relaxed text-slate-700">
                사진과 글에 친구 얼굴 등 개인정보·초상권을 포함하지 않고,
                학교 공간의 에너지 낭비 사실만 기록했습니다.
              </span>
            </label>
            {errors.privacyConfirmed && (
              <p role="alert" className="text-xs font-medium text-rose-700">
                {errors.privacyConfirmed}
              </p>
            )}
          </div>

          {/* 제출 버튼 */}
          <button
            type="submit"
            disabled={isSubmitting || isProcessingPhoto}
            className="flex min-h-[50px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-base font-semibold text-white transition-colors hover:bg-emerald-800 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
          >
            <Send className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              {isSubmitting ? '확인 중...' : '개인 관찰 일지 제출하기'}
            </span>
          </button>
        </form>

        {/* 제출 결과 피드백 */}
        {submitFeedback && (
          <div
            role="status"
            className={`mt-5 rounded-xl border p-4 text-sm ${
              submitFeedback.savedToServer
                ? 'border-emerald-200 bg-emerald-50 text-emerald-950'
                : 'border-amber-300 bg-amber-50 text-amber-950'
            }`}
          >
            <div className="flex items-start gap-2.5">
              {submitFeedback.savedToServer ? (
                <Check
                  className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700"
                  aria-hidden="true"
                />
              ) : (
                <AlertTriangle
                  className="mt-0.5 h-4 w-4 shrink-0 text-amber-700"
                  aria-hidden="true"
                />
              )}
              <div className="space-y-2">
                <p className="font-semibold">
                  {submitFeedback.savedToServer
                    ? '개인 관찰 일지가 서버에 저장되었습니다'
                    : '입력 완료 (저장 준비 중 · 임시 미리보기)'}
                </p>
                <p className="leading-relaxed opacity-90">
                  {submitFeedback.message}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={onGoToTeacherView}
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-current/20 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 hover:bg-slate-50"
                  >
                    <span>교사 화면에서 모둠별 결과 보기</span>
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={onGoToLesson2}
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-current/20 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-900 hover:bg-emerald-50"
                  >
                    <span>2차시 · 모둠별 프로젝트 주제 선정으로 이동</span>
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 방금 이 화면에서 입력한 기록 목록 */}
      {sessionRecords.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-sm font-semibold text-slate-900 tabular-nums">
              이 기기에서 입력된 개인 관찰 일지 ({sessionRecords.length})
            </h3>
            <span className="text-xs text-slate-500">
              {sessionRecords[0].syncState === 'saved-to-api'
                ? '서버 저장됨'
                : '임시 미리보기 · 저장 준비 중'}
            </span>
          </div>
          <ul className="divide-y divide-slate-100">
            {sessionRecords.map((item) => {
              const displayLocation = item.locationDetail
                ? `${item.locationCategory === '직접 입력' ? '' : item.locationCategory + ' · '}${item.locationDetail}`
                : item.locationCategory;

              return (
                <li
                  key={item.id}
                  className="flex items-start justify-between gap-3 py-3 text-sm"
                >
                  <div className="flex items-start gap-3">
                    {item.photoDataUrl && (
                      <img
                        src={item.photoDataUrl}
                        alt={item.photoCaption || `${displayLocation} 관찰 사진`}
                        referrerPolicy="no-referrer"
                        className="h-14 w-14 shrink-0 rounded-lg border border-slate-200 object-cover"
                      />
                    )}
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
                        <span className="font-semibold text-emerald-800">
                          {item.groupName || '모둠 미지정'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-medium text-slate-800">
                          {item.classInfo} {item.authorName}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{displayLocation}</span>
                        <span aria-hidden="true">·</span>
                        <span className="inline-flex items-center gap-1 tabular-nums">
                          <Clock className="h-3 w-3" aria-hidden="true" />
                          {formatTime(item.createdAt)}
                        </span>
                      </div>
                      <p className="text-slate-800 leading-relaxed">
                        {item.wasteScene}
                      </p>
                    </div>
                  </div>

                  {item.syncState === 'preview-only' && (
                    <button
                      type="button"
                      onClick={() => onDeletePreviewRecord(item.id)}
                      aria-label="임시 기록 삭제"
                      className="flex min-h-[40px] min-w-[40px] shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
};
