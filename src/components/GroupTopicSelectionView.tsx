import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  Check,
  ChevronDown,
  Clock,
  Cpu,
  Images,
  Info,
  KeyRound,
  Lightbulb,
  Lock,
  Maximize2,
  RefreshCw,
  Send,
  Trash2,
  Unlock,
  Upload,
  Users,
  X,
} from 'lucide-react';
import {
  CLASS_ROOM_PRESETS,
  GROUP_NAME_PRESETS,
  type GroupAuthCode,
  type GroupTopicInput,
  type GroupTopicRecord,
  type ObservationRecord,
  type StorageConnectionStatus,
} from '../types/observation';
import { captureVideoFrame, compressImageFile } from '../lib/imageUtils';
import {
  submitGroupTopic,
  verifyGroupAuthAndFetchObservations,
  type ApiSubmitTopicResult,
} from '../lib/observationApi';
import { StorageStatusNotice } from './StorageStatusNotice';

interface GroupTopicSelectionViewProps {
  observations: ObservationRecord[];
  topics: GroupTopicRecord[];
  groupCodes: GroupAuthCode[];
  storageStatus: StorageConnectionStatus;
  statusDetail?: string;
  isCheckingStorage: boolean;
  onRetryConnection: () => void;
  onTopicSubmitted: (result: ApiSubmitTopicResult) => void;
  onDeletePreviewTopic: (id: string) => void;
  onDirtyChange?: (isDirty: boolean) => void;
}

const INITIAL_TOPIC_FORM: GroupTopicInput = {
  classRoom: '1반',
  groupName: '1모둠',
  groupMembers: '',
  selectedLocation: '',
  referencePhotoDataUrl: '',
  projectTitle: '',
  coreQuestion: '',
  selectionReason: '',
  controlConditionWhen: '',
  controlConditionThen: '',
  controlConditionDraft: '',
};

export const GroupTopicSelectionView: React.FC<GroupTopicSelectionViewProps> = ({
  observations,
  topics,
  groupCodes,
  storageStatus,
  statusDetail,
  isCheckingStorage,
  onRetryConnection,
  onTopicSubmitted,
  onDeletePreviewTopic,
  onDirtyChange,
}) => {
  const baselineFormRef = useRef<GroupTopicInput>(INITIAL_TOPIC_FORM);
  // 상단 구역: 모둠 인증코드 확인 상태
  const [authClassPreset, setAuthClassPreset] = useState<string>('1반');
  const [authClassRoom, setAuthClassRoom] = useState<string>('1반');
  const [authGroupPreset, setAuthGroupPreset] = useState<string>('1모둠');
  const [authGroupName, setAuthGroupName] = useState<string>('1모둠');
  const [authCodeInput, setAuthCodeInput] = useState<string>('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string>('');
  const [unlockedTarget, setUnlockedTarget] = useState<{
    classRoom: string;
    groupName: string;
  } | null>(null);
  const [verifiedObservations, setVerifiedObservations] = useState<
    ObservationRecord[]
  >([]);
  const [verifyNotice, setVerifyNotice] = useState<string>('');
  const [enlargedPhoto, setEnlargedPhoto] = useState<{
    src: string;
    title: string;
  } | null>(null);

  // 하단 구역: 최종 모둠 프로젝트 주제 선정 일지 폼 상태
  const [form, setForm] = useState<GroupTopicInput>(INITIAL_TOPIC_FORM);
  const [formClassPreset, setFormClassPreset] = useState<string>('1반');
  const [formGroupPreset, setFormGroupPreset] = useState<string>('1모둠');
  const [adoptedSensorIdea, setAdoptedSensorIdea] = useState<string>('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [photoError, setPhotoError] = useState('');
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [isRequestingCamera, setIsRequestingCamera] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>(
    'environment'
  );
  const [cameraFallbackAvailable, setCameraFallbackAvailable] = useState(false);
  const [isLesson1PickerOpen, setIsLesson1PickerOpen] = useState(false);
  const [selectedLesson1ObsId, setSelectedLesson1ObsId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitFeedback, setSubmitFeedback] =
    useState<ApiSubmitTopicResult | null>(null);
  const [isFlowMobileExpanded, setIsFlowMobileExpanded] = useState(false);
  const [existingTopicNotice, setExistingTopicNotice] = useState('');

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const nativeCaptureInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const topicFormRef = useRef<HTMLDivElement | null>(null);

  const verifiedObservationsWithPhotos = verifiedObservations.filter((obs) =>
    Boolean(obs.photoDataUrl)
  );

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
    const base = baselineFormRef.current;
    const isDirty =
      form.classRoom !== base.classRoom ||
      form.groupName !== base.groupName ||
      form.groupMembers !== base.groupMembers ||
      form.selectedLocation !== base.selectedLocation ||
      form.referencePhotoDataUrl !== base.referencePhotoDataUrl ||
      form.projectTitle !== base.projectTitle ||
      form.coreQuestion !== base.coreQuestion ||
      form.selectionReason !== base.selectionReason ||
      form.controlConditionWhen !== base.controlConditionWhen ||
      form.controlConditionThen !== base.controlConditionThen ||
      form.controlConditionDraft !== base.controlConditionDraft;
    onDirtyChange?.(isDirty);
  }, [form, onDirtyChange]);

  useEffect(() => {
    return () => {
      onDirtyChange?.(false);
    };
  }, [onDirtyChange]);

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
    setIsLesson1PickerOpen(false);

    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== 'function'
    ) {
      setPhotoError(
        '현재 브라우저 환경에서 실시간 카메라 실행이 지원되지 않습니다. 아래 기기 카메라 또는 사진 파일 업로드를 이용해 주세요.'
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
            '카메라 권한이 허용되지 않았습니다. 브라우저 상단 권한 창에서 "허용"을 선택하거나 아래 기기 카메라·사진 파일 업로드를 이용해 주세요.'
          );
          setCameraFallbackAvailable(true);
        } else if (
          err.name === 'NotFoundError' ||
          err.name === 'DevicesNotFoundError'
        ) {
          setPhotoError(
            '이 기기에서 연결된 카메라(웹캠)를 찾지 못했습니다. 아래 "저장된 사진 파일에서 올리기"를 이용해 주세요.'
          );
        } else if (
          err.name === 'NotReadableError' ||
          err.name === 'TrackStartError'
        ) {
          setPhotoError(
            '카메라가 다른 프로그램에서 사용 중입니다. 다른 앱을 닫고 다시 시도하거나 사진 파일 업로드를 이용해 주세요.'
          );
          setCameraFallbackAvailable(true);
        } else {
          setPhotoError(
            `카메라를 여는 중 문제가 발생했습니다(${err.name}). 사진 파일 업로드를 이용해 주세요.`
          );
          setCameraFallbackAvailable(true);
        }
      } else {
        setPhotoError(
          '카메라를 시작할 수 없습니다. 아래 사진 파일 업로드를 이용해 주세요.'
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
        referencePhotoDataUrl: captured.dataUrl,
      }));
      setSelectedLesson1ObsId('');
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

  const handleAuthClassPresetChange = (value: string) => {
    setAuthClassPreset(value);
    setVerifyError('');
    if (value === '직접 입력') {
      setAuthClassRoom('');
    } else {
      setAuthClassRoom(value);
    }
  };

  const handleAuthGroupPresetSelect = (preset: string) => {
    setAuthGroupPreset(preset);
    setVerifyError('');
    if (preset === '직접 입력') {
      setAuthGroupName('');
    } else {
      setAuthGroupName(preset);
    }
  };

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerifyError('');
    setVerifyNotice('');

    if (!authClassRoom.trim()) {
      setVerifyError('확인할 학급(반)을 선택하거나 입력해 주세요.');
      return;
    }
    if (!authGroupName.trim()) {
      setVerifyError('확인할 모둠을 선택하거나 입력해 주세요.');
      return;
    }
    if (!authCodeInput.trim()) {
      setVerifyError('선생님께 받은 모둠 인증코드를 입력해 주세요.');
      return;
    }

    setIsVerifying(true);
    try {
      const targetClass = authClassRoom.trim();
      const targetGroup = authGroupName.trim();
      const result = await verifyGroupAuthAndFetchObservations(
        targetClass,
        targetGroup,
        authCodeInput.trim(),
        groupCodes,
        observations,
        topics
      );

      if (!result.verified) {
        setVerifyError(result.message);
        return;
      }

      setUnlockedTarget({ classRoom: targetClass, groupName: targetGroup });
      setVerifiedObservations(result.observations);
      setVerifyNotice(result.message);

      // 하단 최종 주제 폼의 학급·모둠 정보 동기화
      if (
        (CLASS_ROOM_PRESETS as readonly string[]).includes(targetClass) &&
        targetClass !== '직접 입력'
      ) {
        setFormClassPreset(targetClass);
      } else {
        setFormClassPreset('직접 입력');
      }

      if (
        (GROUP_NAME_PRESETS as readonly string[]).includes(targetGroup) &&
        targetGroup !== '직접 입력'
      ) {
        setFormGroupPreset(targetGroup);
      } else {
        setFormGroupPreset('직접 입력');
      }

      if (result.existingTopic) {
        const existing = result.existingTopic;
        const loaded: GroupTopicInput = {
          classRoom: targetClass,
          groupName: targetGroup,
          groupMembers: existing.groupMembers || '',
          selectedLocation: existing.selectedLocation || '',
          referencePhotoDataUrl: existing.referencePhotoDataUrl || '',
          projectTitle: existing.projectTitle || '',
          coreQuestion: existing.coreQuestion || '',
          selectionReason: existing.selectionReason || '',
          controlConditionWhen: existing.controlConditionWhen || '',
          controlConditionThen: existing.controlConditionThen || '',
          controlConditionDraft: existing.controlConditionDraft || '',
        };
        baselineFormRef.current = loaded;
        setForm(loaded);
        setErrors({});
        setExistingTopicNotice(
          '이미 제출한 우리 모둠 주제를 불러왔습니다. 수정 후 다시 제출하면 업데이트됩니다.'
        );
      } else {
        setExistingTopicNotice('');
        setForm((prev) => {
          baselineFormRef.current = {
            ...baselineFormRef.current,
            classRoom: targetClass,
            groupName: targetGroup,
          };
          return {
            ...prev,
            classRoom: targetClass,
            groupName: targetGroup,
          };
        });
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const handleLockGroup = () => {
    setUnlockedTarget(null);
    setVerifiedObservations([]);
    setAuthCodeInput('');
    setVerifyError('');
    setVerifyNotice('');
    setExistingTopicNotice('');
    setIsLesson1PickerOpen(false);
    setSelectedLesson1ObsId('');
  };

  const handleFormClassPresetChange = (value: string) => {
    setFormClassPreset(value);
    if (value === '직접 입력') {
      setForm((prev) => ({ ...prev, classRoom: '' }));
    } else {
      setForm((prev) => ({ ...prev, classRoom: value }));
    }
    if (errors.classRoom) {
      setErrors((prev) => ({ ...prev, classRoom: '' }));
    }
  };

  const handleFormGroupPresetSelect = (preset: string) => {
    setFormGroupPreset(preset);
    if (preset === '직접 입력') {
      setForm((prev) => ({ ...prev, groupName: '' }));
    } else {
      setForm((prev) => ({ ...prev, groupName: preset }));
    }
    if (errors.groupName) {
      setErrors((prev) => ({ ...prev, groupName: '' }));
    }
  };

  const handleAdoptObservation = (obs: ObservationRecord) => {
    const locationText = obs.locationDetail
      ? `${obs.locationCategory === '직접 입력' ? '' : obs.locationCategory + ' · '}${obs.locationDetail}`
      : obs.locationCategory;

    setAdoptedSensorIdea(obs.sensorIdea.trim());
    if (obs.photoDataUrl) {
      setSelectedLesson1ObsId(obs.id);
    }

    setForm((prev) => ({
      ...prev,
      selectedLocation: locationText,
      referencePhotoDataUrl: obs.photoDataUrl || prev.referencePhotoDataUrl,
      selectionReason: prev.selectionReason || obs.wasteCause,
    }));

    setErrors((prev) => {
      const next = { ...prev };
      delete next.selectedLocation;
      return next;
    });

    topicFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleSelectLesson1Photo = (obsId: string) => {
    setSelectedLesson1ObsId(obsId);
    if (!obsId) return;

    const chosen = verifiedObservationsWithPhotos.find(
      (obs) => obs.id === obsId
    );
    if (!chosen) return;

    stopCameraStream();
    setPhotoError('');

    const locationText = chosen.locationDetail
      ? `${chosen.locationCategory === '직접 입력' ? '' : chosen.locationCategory + ' · '}${chosen.locationDetail}`
      : chosen.locationCategory;

    if (chosen.sensorIdea.trim()) {
      setAdoptedSensorIdea(chosen.sensorIdea.trim());
    }

    setForm((prev) => ({
      ...prev,
      referencePhotoDataUrl: chosen.photoDataUrl,
      selectedLocation: prev.selectedLocation.trim()
        ? prev.selectedLocation
        : locationText,
      selectionReason: prev.selectionReason || chosen.wasteCause,
    }));

    if (!form.selectedLocation.trim() && errors.selectedLocation) {
      setErrors((prev) => ({ ...prev, selectedLocation: '' }));
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
        referencePhotoDataUrl: compressed.dataUrl,
      }));
      setSelectedLesson1ObsId('');
      setIsLesson1PickerOpen(false);
    } catch (err) {
      setPhotoError(
        err instanceof Error ? err.message : '사진을 처리하지 못했습니다.'
      );
    } finally {
      setIsProcessingPhoto(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      if (nativeCaptureInputRef.current) {
        nativeCaptureInputRef.current.value = '';
      }
    }
  };

  const validate = (): boolean => {
    const nextErrors: Record<string, string> = {};

    if (!form.classRoom.trim()) {
      nextErrors.classRoom = '학급(반)을 선택하거나 입력해 주세요.';
    }
    if (!form.groupName.trim()) {
      nextErrors.groupName = '모둠 이름을 선택하거나 입력해 주세요.';
    }
    if (!form.groupMembers.trim()) {
      nextErrors.groupMembers = '함께 정한 모둠원 이름을 입력해 주세요.';
    }
    if (!form.selectedLocation.trim()) {
      nextErrors.selectedLocation = '모둠이 해결할 학교 공간을 적어 주세요.';
    }
    if (!form.projectTitle.trim()) {
      nextErrors.projectTitle =
        '모둠별로 선정한 최종 프로젝트 주제를 입력해 주세요.';
    }
    if (!form.coreQuestion.trim()) {
      nextErrors.coreQuestion = '모둠의 핵심 질문을 작성해 주세요.';
    }
    if (!form.selectionReason.trim()) {
      nextErrors.selectionReason =
        '이 주제를 선정한 이유(원인과 자동화가 필요한 까닭)를 적어 주세요.';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const whenText = form.controlConditionWhen.trim();
    const thenText = form.controlConditionThen.trim();
    const combinedDraft =
      whenText && thenText
        ? `만약 ${whenText} → ${thenText}`
        : whenText
          ? `만약 ${whenText}`
          : thenText
            ? thenText
            : form.controlConditionDraft.trim();

    setIsSubmitting(true);
    try {
      const cleaned: GroupTopicInput = {
        classRoom: form.classRoom.trim(),
        groupName: form.groupName.trim(),
        groupMembers: form.groupMembers.trim(),
        selectedLocation: form.selectedLocation.trim(),
        referencePhotoDataUrl: form.referencePhotoDataUrl,
        projectTitle: form.projectTitle.trim(),
        coreQuestion: form.coreQuestion.trim(),
        selectionReason: form.selectionReason.trim(),
        controlConditionWhen: whenText,
        controlConditionThen: thenText,
        controlConditionDraft: combinedDraft,
      };

      const result = await submitGroupTopic(cleaned);
      setSubmitFeedback(result);

      if (result.failed) {
        return;
      }

      onTopicSubmitted(result);
      setExistingTopicNotice('');
      setAdoptedSensorIdea('');
      setIsLesson1PickerOpen(false);
      setSelectedLesson1ObsId('');
      stopCameraStream();

      setForm((prev) => {
        const nextBaseline: GroupTopicInput = {
          ...INITIAL_TOPIC_FORM,
          classRoom: prev.classRoom,
          groupName: prev.groupName,
          groupMembers: prev.groupMembers,
        };
        baselineFormRef.current = nextBaseline;
        return nextBaseline;
      });
      setErrors({});
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
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs font-medium text-slate-500">
          중학교 1학년 정보(기술 융합) · 2단계(2차시) · 핵심 질문 도출 및
          알고리즘 설계
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          모둠별 프로젝트 주제 선정
        </h1>
        <p className="max-w-3xl text-sm leading-relaxed text-slate-600 sm:text-base">
          먼저 교사에게 받은 모둠별 인증코드를 입력해 1차시에서 모둠원들이
          제출한 사진과 관찰 일지를 함께 확인한 뒤, 아래에서 우리 모둠의 최종
          프로젝트 주제 한 가지를 선정해 기록하세요.
        </p>
      </div>

      <StorageStatusNotice
        status={storageStatus}
        statusDetail={statusDetail}
        onRetryCheck={onRetryConnection}
        isChecking={isCheckingStorage}
        context="student"
      />

      {/* 2차시 활동 흐름 */}
      <section
        aria-labelledby="lesson2-flow-title"
        className="rounded-xl border border-slate-200 bg-white p-5 space-y-4"
      >
        <div className="flex items-center justify-between gap-3">
          <h2
            id="lesson2-flow-title"
            className="text-base font-semibold text-slate-900"
          >
            2차시 진행 순서
          </h2>
          <button
            type="button"
            onClick={() => setIsFlowMobileExpanded((prev) => !prev)}
            aria-expanded={isFlowMobileExpanded}
            className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 md:hidden whitespace-nowrap"
          >
            <span>{isFlowMobileExpanded ? '접기' : '순서 보기'}</span>
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${
                isFlowMobileExpanded ? 'rotate-180' : ''
              }`}
              aria-hidden="true"
            />
          </button>
        </div>
        <ol
          className={`${
            isFlowMobileExpanded ? 'block' : 'hidden'
          } md:block space-y-4 text-sm text-slate-700`}
        >
          <li className="flex items-start gap-3">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-100 text-xs font-semibold text-slate-700 tabular-nums">
              1
            </span>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-slate-900">
                <KeyRound
                  className="h-4 w-4 shrink-0 text-slate-500"
                  aria-hidden="true"
                />
                <span>모둠 인증 · 1차시 관찰 일지와 사진 불러오기</span>
              </div>
              <p className="leading-relaxed text-slate-600">
                선생님께 안내받은 학급·모둠 인증코드를 입력해 모둠원들이 1차시에
                기록한 현장 사진과 관찰 일지를 한자리에 모읍니다.
              </p>
            </div>
          </li>

          <li className="flex items-start gap-3">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-emerald-100 text-xs font-semibold text-emerald-800 tabular-nums">
              2
            </span>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-slate-900">
                <Users
                  className="h-4 w-4 shrink-0 text-emerald-700"
                  aria-hidden="true"
                />
                <span>모둠 토의 · 해결할 학교 공간과 핵심 질문 정하기</span>
              </div>
              <p className="leading-relaxed text-slate-600">
                1차시 기록을 비교해 단순한 절약 구호가 아닌 센서와 코딩으로
                자동 해결할 문제 1가지를 고르고 핵심 질문에 합의합니다.
              </p>
            </div>
          </li>

          <li className="flex items-start gap-3">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-100 text-xs font-semibold text-slate-700 tabular-nums">
              3
            </span>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-slate-900">
                <Cpu
                  className="h-4 w-4 shrink-0 text-slate-500"
                  aria-hidden="true"
                />
                <span>주제 확정 · 자연어 제어 조건 작성 및 대표 제출</span>
              </div>
              <p className="leading-relaxed text-slate-600">
                「만약 ~(센서 입력) → ~(작동 출력)」 제어 조건 초안을 세우고
                모둠 대표 1명이 제출해 다음 차시 피지컬 컴퓨팅 설계로 이어집니다.
              </p>
            </div>
          </li>
        </ol>
      </section>

      {/* 상단 구역: 모둠 인증코드 입력 및 1차시 개인별 일지 확인 */}
      <section
        aria-labelledby="group-verify-title"
        className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 space-y-5"
      >
        <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold text-emerald-800">
              1단계 · 모둠 인증 후 1차시 개인 일지 확인
            </p>
            <h2
              id="group-verify-title"
              className="mt-1 text-lg font-bold text-slate-900 sm:text-xl"
            >
              우리 모둠 1차시 관찰 기록·사진 불러오기
            </h2>
          </div>

          {unlockedTarget && (
            <button
              type="button"
              onClick={handleLockGroup}
              className="inline-flex min-h-[42px] items-center justify-center gap-1.5 self-start rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap sm:self-auto"
            >
              <Lock className="h-3.5 w-3.5" aria-hidden="true" />
              <span>다른 모둠으로 전환</span>
            </button>
          )}
        </div>

        {!unlockedTarget ? (
          <form onSubmit={handleVerifySubmit} noValidate className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-12">
              <div className="space-y-1.5 sm:col-span-4">
                <label
                  htmlFor="auth-class-room"
                  className="block text-sm font-semibold text-slate-900"
                >
                  1. 학급 (반) 선택
                </label>
                <select
                  id="auth-class-room"
                  value={authClassPreset}
                  onChange={(e) => handleAuthClassPresetChange(e.target.value)}
                  className="min-h-[46px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20"
                >
                  {CLASS_ROOM_PRESETS.map((room) => (
                    <option key={room} value={room}>
                      {room}
                    </option>
                  ))}
                </select>
                {authClassPreset === '직접 입력' && (
                  <input
                    type="text"
                    value={authClassRoom}
                    onChange={(e) => {
                      setAuthClassRoom(e.target.value);
                      setVerifyError('');
                    }}
                    placeholder="예: 13반"
                    aria-label="확인할 학급 직접 입력"
                    maxLength={20}
                    className="mt-1.5 min-h-[42px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-700 focus:outline-none"
                  />
                )}
              </div>

              <div className="space-y-2 sm:col-span-8">
                <p className="text-sm font-semibold text-slate-900">
                  2. 확인할 모둠 선택
                </p>
                <div className="flex flex-wrap gap-2">
                  {GROUP_NAME_PRESETS.map((preset) => {
                    const selected = authGroupPreset === preset;
                    return (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => handleAuthGroupPresetSelect(preset)}
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
                {authGroupPreset === '직접 입력' && (
                  <input
                    type="text"
                    value={authGroupName}
                    onChange={(e) => {
                      setAuthGroupName(e.target.value);
                      setVerifyError('');
                    }}
                    placeholder="예: 10모둠"
                    aria-label="확인할 모둠 이름 직접 입력"
                    maxLength={30}
                    className="min-h-[46px] w-full max-w-xs rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-base text-slate-900 placeholder:text-slate-400 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20"
                  />
                )}
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1 max-w-sm space-y-1.5">
                <label
                  htmlFor="group-auth-code"
                  className="block text-sm font-semibold text-slate-900"
                >
                  3. 교사에게 받은 모둠 인증코드
                </label>
                <div className="relative">
                  <KeyRound
                    className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                    aria-hidden="true"
                  />
                  <input
                    id="group-auth-code"
                    type="text"
                    value={authCodeInput}
                    onChange={(e) => {
                      setAuthCodeInput(e.target.value);
                      setVerifyError('');
                    }}
                    placeholder="선생님이 안내한 코드 입력"
                    maxLength={24}
                    className="min-h-[46px] w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3.5 py-2.5 font-mono text-base text-slate-900 placeholder:font-sans placeholder:text-slate-400 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isVerifying}
                className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-lg bg-emerald-700 px-5 py-2.5 text-center text-sm font-semibold leading-snug text-white transition-colors hover:bg-emerald-800 disabled:opacity-60 shrink-0"
              >
                <Unlock className="h-4 w-4" aria-hidden="true" />
                <span>
                  {isVerifying
                    ? '확인 중...'
                    : '모둠 인증하고 1차시 기록 보기'}
                </span>
              </button>
            </div>

            {verifyError && (
              <div
                role="alert"
                className="rounded-lg border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-900"
              >
                <p className="font-medium leading-relaxed">{verifyError}</p>
              </div>
            )}

            <p className="text-xs leading-relaxed text-slate-500">
              선생님께 안내받은 우리 반·우리 모둠 인증코드를 입력하면, 1차시에
              모둠원들이 제출한 개인 관찰 일지와 현장 사진을 이 구역에서 바로
              모아볼 수 있습니다.
            </p>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-950">
              <div className="flex flex-wrap items-center gap-2">
                <Check
                  className="h-4 w-4 shrink-0 text-emerald-700"
                  aria-hidden="true"
                />
                <span className="font-semibold">
                  {unlockedTarget.classRoom} · {unlockedTarget.groupName} 인증됨
                </span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">
                  1차시 개인 관찰 일지 {verifiedObservations.length}건
                </span>
              </div>
              {verifyNotice && (
                <span className="text-xs text-emerald-900">{verifyNotice}</span>
              )}
            </div>

            {verifiedObservations.length === 0 ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-5 py-8 text-center text-sm text-slate-600">
                <p className="font-semibold text-slate-900">
                  {unlockedTarget.classRoom} {unlockedTarget.groupName}의 1차시
                  개인 관찰 일지가 아직 없습니다
                </p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  1차시 화면에서 학급 「{unlockedTarget.classRoom}」, 소속 모둠
                  「{unlockedTarget.groupName}」으로 개인 기록을 작성하면 이곳에
                  모여 보입니다. 아래에서 직접 공간과 주제를 입력할 수도 있습니다.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {verifiedObservations.map((obs) => {
                  const displayLocation = obs.locationDetail
                    ? `${obs.locationCategory === '직접 입력' ? '' : obs.locationCategory + ' · '}${obs.locationDetail}`
                    : obs.locationCategory;

                  return (
                    <article
                      key={obs.id}
                      className="flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3"
                    >
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-1 text-xs text-slate-500">
                          <span className="font-semibold text-slate-900">
                            {obs.classRoom} · {obs.classInfo} {obs.authorName}
                          </span>
                          <span className="font-medium text-emerald-800">
                            {displayLocation}
                          </span>
                        </div>

                        {obs.photoDataUrl && (
                          <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-white">
                            <img
                              src={obs.photoDataUrl}
                              alt={
                                obs.photoCaption ||
                                `${displayLocation} 관찰 사진`
                              }
                              referrerPolicy="no-referrer"
                              className="h-44 w-full object-contain"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setEnlargedPhoto({
                                  src: obs.photoDataUrl,
                                  title: `${obs.classRoom} · ${obs.groupName} · ${obs.authorName} (${displayLocation})`,
                                })
                              }
                              className="absolute right-2 bottom-2 inline-flex min-h-[34px] items-center gap-1 rounded-md bg-slate-900/80 px-2.5 py-1 text-xs font-medium text-white hover:bg-slate-900"
                            >
                              <Maximize2
                                className="h-3 w-3"
                                aria-hidden="true"
                              />
                              <span>크게</span>
                            </button>
                          </div>
                        )}

                        <div className="space-y-1.5 text-sm">
                          <p className="text-xs font-semibold text-slate-500">
                            에너지 낭비 장면
                          </p>
                          <p className="leading-relaxed text-slate-900">
                            {obs.wasteScene}
                          </p>
                          <p className="pt-1 text-xs font-semibold text-slate-500">
                            원인과 불편한 점
                          </p>
                          <p className="text-xs leading-relaxed text-slate-700 sm:text-sm">
                            {obs.wasteCause}
                          </p>
                          {obs.sensorIdea && (
                            <p className="pt-1 text-xs text-slate-600">
                              <span className="font-semibold text-slate-700">
                                센서 아이디어:{' '}
                              </span>
                              {obs.sensorIdea}
                            </p>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleAdoptObservation(obs)}
                        className="mt-2 inline-flex min-h-[42px] w-full items-center justify-center rounded-lg border border-emerald-700/40 bg-white px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-50"
                      >
                        이 공간·사진을 최종 주제로 가져오기
                      </button>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </section>

      {/* 하단 구역: 최종 모둠별 프로젝트 주제 선정 일지 */}
      <div
        ref={topicFormRef}
        className="grid gap-8 lg:grid-cols-12 lg:items-start"
      >
        <aside className="space-y-4 lg:col-span-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Lightbulb
                className="h-4 w-4 text-emerald-700"
                aria-hidden="true"
              />
              <span>2차시 모둠 협의 가이드</span>
            </div>
            <ol className="space-y-2.5 text-sm leading-relaxed text-slate-600">
              <li>
                <span className="font-semibold text-slate-900">
                  1. 1차시 기록 비교:
                </span>{' '}
                위에서 불러온 모둠원들의 사진과 원인을 보며 가장 시급하거나
                센서로 해결하기 좋은 문제를 고릅니다.
              </li>
              <li>
                <span className="font-semibold text-slate-900">
                  2. 최종 주제 1가지 확정:
                </span>{' '}
                단순한 절약 구호나 경고문이 아니라, 센서와 코딩으로 스스로
                해결하는 시스템 주제 1가지를 정합니다.
              </li>
              <li>
                <span className="font-semibold text-slate-900">
                  3. 자연어 제어 조건 작성:
                </span>{' '}
                「언제(센서 입력)」와 「어떻게(작동 출력)」를 나누어 알고리즘
                흐름을 구체적으로 적습니다.
              </li>
            </ol>
          </div>
        </aside>

        <div className="space-y-6 lg:col-span-8">
          <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
            <div className="border-b border-slate-100 pb-4">
              <p className="text-xs font-semibold text-emerald-800">
                2단계 · 모둠별 1가지 최종 주제 확정
              </p>
              <h2 className="mt-1 text-lg font-bold text-slate-900 sm:text-xl">
                최종 모둠별 프로젝트 주제 선정 일지
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                모둠 토의를 거쳐 결정한 단 하나의 프로젝트 주제와 핵심 질문을
                작성하세요.
              </p>
            </div>

            <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-xs leading-relaxed text-slate-700">
              <Info
                className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700"
                aria-hidden="true"
              />
              <p>
                <span className="font-semibold text-slate-900">
                  모둠당 대표 1명만 작성해 주세요.
                </span>{' '}
                같은 학급·모둠 이름으로 다시 제출하면 이전 내용 대신 최신
                내용으로 덮어써져 모둠당 1가지 최종 주제로 정리됩니다.
              </p>
            </div>

            {existingTopicNotice && (
              <div
                role="status"
                className="mt-3 flex items-start gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 p-3.5 text-xs leading-relaxed text-emerald-950"
              >
                <Check
                  className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700"
                  aria-hidden="true"
                />
                <p className="font-medium">{existingTopicNotice}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate className="mt-5 space-y-5">
              {unlockedTarget ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <p className="text-sm font-semibold text-slate-900">
                      인증된 학급·모둠 (고정됨)
                    </p>
                    <div className="flex min-h-[46px] items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50/70 px-3.5 py-2.5 text-sm font-semibold text-emerald-950">
                      <span>
                        {unlockedTarget.classRoom} · {unlockedTarget.groupName}
                      </span>
                      <Lock
                        className="h-4 w-4 shrink-0 text-emerald-700"
                        aria-hidden="true"
                      />
                    </div>
                    <p className="text-xs leading-relaxed text-slate-500">
                      다른 모둠 주제를 잘못 덮어쓰지 않도록 인증한 모둠으로
                      고정됩니다. 다른 모둠으로 바꾸려면 위 1단계에서 「다른
                      모둠으로 전환」을 눌러 주세요.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="topic-group-members"
                      className="block text-sm font-semibold text-slate-900"
                    >
                      함께 정한 모둠원
                    </label>
                    <input
                      id="topic-group-members"
                      type="text"
                      value={form.groupMembers}
                      onChange={(e) => {
                        setForm({ ...form, groupMembers: e.target.value });
                        if (errors.groupMembers) {
                          setErrors((prev) => ({ ...prev, groupMembers: '' }));
                        }
                      }}
                      placeholder="예: 김에코, 이센서, 박코딩"
                      maxLength={80}
                      className="min-h-[46px] w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-base text-slate-900 placeholder:text-slate-400 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20"
                    />
                    {errors.groupMembers && (
                      <p
                        role="alert"
                        className="text-xs font-medium text-rose-700"
                      >
                        {errors.groupMembers}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label
                        htmlFor="topic-class-room"
                        className="block text-sm font-semibold text-slate-900"
                      >
                        학급 (반)
                      </label>
                      <select
                        id="topic-class-room"
                        value={formClassPreset}
                        onChange={(e) =>
                          handleFormClassPresetChange(e.target.value)
                        }
                        className="min-h-[46px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20"
                      >
                        {CLASS_ROOM_PRESETS.map((room) => (
                          <option key={room} value={room}>
                            {room}
                          </option>
                        ))}
                      </select>
                      {formClassPreset === '직접 입력' && (
                        <input
                          type="text"
                          value={form.classRoom}
                          onChange={(e) => {
                            setForm({ ...form, classRoom: e.target.value });
                            if (errors.classRoom) {
                              setErrors((prev) => ({
                                ...prev,
                                classRoom: '',
                              }));
                            }
                          }}
                          placeholder="예: 13반"
                          aria-label="학급 직접 입력"
                          maxLength={20}
                          className="mt-1.5 min-h-[42px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-700 focus:outline-none"
                        />
                      )}
                      {errors.classRoom && (
                        <p
                          role="alert"
                          className="text-xs font-medium text-rose-700"
                        >
                          {errors.classRoom}
                        </p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <label
                        htmlFor="topic-group-members"
                        className="block text-sm font-semibold text-slate-900"
                      >
                        함께 정한 모둠원
                      </label>
                      <input
                        id="topic-group-members"
                        type="text"
                        value={form.groupMembers}
                        onChange={(e) => {
                          setForm({ ...form, groupMembers: e.target.value });
                          if (errors.groupMembers) {
                            setErrors((prev) => ({
                              ...prev,
                              groupMembers: '',
                            }));
                          }
                        }}
                        placeholder="예: 김에코, 이센서, 박코딩"
                        maxLength={80}
                        className="min-h-[46px] w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-base text-slate-900 placeholder:text-slate-400 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20"
                      />
                      {errors.groupMembers && (
                        <p
                          role="alert"
                          className="text-xs font-medium text-rose-700"
                        >
                          {errors.groupMembers}
                        </p>
                      )}
                    </div>
                  </div>

                  <fieldset className="space-y-2">
                    <legend className="text-sm font-semibold text-slate-900">
                      1. 모둠 선택
                    </legend>
                    <div className="flex flex-wrap gap-2">
                      {GROUP_NAME_PRESETS.map((preset) => {
                        const selected = formGroupPreset === preset;
                        return (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => handleFormGroupPresetSelect(preset)}
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
                    {formGroupPreset === '직접 입력' && (
                      <input
                        type="text"
                        value={form.groupName}
                        onChange={(e) => {
                          setForm({ ...form, groupName: e.target.value });
                          if (errors.groupName) {
                            setErrors((prev) => ({ ...prev, groupName: '' }));
                          }
                        }}
                        placeholder="예: 10모둠"
                        aria-label="모둠 이름 직접 입력"
                        maxLength={30}
                        className="min-h-[46px] w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-base text-slate-900 placeholder:text-slate-400 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20"
                      />
                    )}
                    {errors.groupName && (
                      <p
                        role="alert"
                        className="text-xs font-medium text-rose-700"
                      >
                        {errors.groupName}
                      </p>
                    )}
                  </fieldset>
                </>
              )}

              <div className="space-y-3">
                <label
                  htmlFor="selected-location"
                  className="block text-sm font-semibold text-slate-900"
                >
                  2. 최종 선정한 학교 공간
                </label>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="sr-only"
                />

                <input
                  ref={nativeCaptureInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhotoUpload}
                  className="sr-only"
                />

                <div className="grid gap-3 md:grid-cols-12 md:items-stretch">
                  <div className="flex flex-col space-y-1.5 md:col-span-7">
                    <textarea
                      id="selected-location"
                      rows={4}
                      value={form.selectedLocation}
                      onChange={(e) => {
                        setForm({ ...form, selectedLocation: e.target.value });
                        if (errors.selectedLocation) {
                          setErrors((prev) => ({
                            ...prev,
                            selectedLocation: '',
                          }));
                        }
                      }}
                      placeholder={
                        '사진에 대한 설명을 작성해주세요.\n예: 빈 교실, 2층 2반 교실'
                      }
                      maxLength={200}
                      className="min-h-[120px] w-full flex-1 rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-base leading-relaxed text-slate-900 placeholder:text-slate-400 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20"
                    />
                    {errors.selectedLocation && (
                      <p
                        role="alert"
                        className="text-xs font-medium text-rose-700"
                      >
                        {errors.selectedLocation}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col justify-between gap-2.5 md:col-span-5 min-w-0">
                    <button
                      type="button"
                      disabled={isRequestingCamera || isProcessingPhoto}
                      onClick={() => void startCamera(facingMode)}
                      className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-lg border border-emerald-700 bg-emerald-700 px-3.5 py-2.5 text-center text-sm font-semibold leading-snug text-white transition-colors hover:bg-emerald-800 disabled:opacity-60"
                    >
                      <Camera className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>
                        {isRequestingCamera
                          ? '카메라 권한 확인 중...'
                          : '현장 사진 직접 올리기'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setIsLesson1PickerOpen((prev) => !prev)
                      }
                      aria-expanded={isLesson1PickerOpen}
                      className={`inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-lg border px-3.5 py-2.5 text-center text-sm font-semibold leading-snug transition-colors ${
                        isLesson1PickerOpen
                          ? 'border-emerald-700 bg-emerald-50 text-emerald-900'
                          : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
                      }`}
                    >
                      <Images
                        className="h-4 w-4 shrink-0 text-emerald-700"
                        aria-hidden="true"
                      />
                      <span>1차시 기록에서 선택하기</span>
                      <ChevronDown
                        className={`h-4 w-4 shrink-0 transition-transform ${
                          isLesson1PickerOpen ? 'rotate-180' : ''
                        }`}
                        aria-hidden="true"
                      />
                    </button>

                    <button
                      type="button"
                      disabled={isRequestingCamera || isProcessingPhoto}
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex min-h-[38px] w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-center text-xs font-medium leading-snug text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                    >
                      <Upload className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span>
                        {isProcessingPhoto
                          ? '사진 불러오는 중...'
                          : '저장된 사진 파일에서 올리기'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* 1차시 기록에서 선택하기 드롭다운 */}
                {isLesson1PickerOpen && (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 space-y-2">
                    {!unlockedTarget ? (
                      <p className="text-xs leading-relaxed text-slate-600">
                        먼저 위{' '}
                        <span className="font-semibold text-slate-900">
                          「1단계 · 모둠 인증 후 1차시 개인 일지 확인」
                        </span>
                        에서 학급·모둠과 인증코드를 입력해 1차시 기록을 불러와
                        주세요.
                      </p>
                    ) : verifiedObservationsWithPhotos.length === 0 ? (
                      <p className="text-xs leading-relaxed text-slate-600">
                        불러온 {unlockedTarget.classRoom}{' '}
                        {unlockedTarget.groupName}의 1차시 기록 중 첨부된
                        사진이 없습니다. 오른쪽{' '}
                        <span className="font-semibold text-slate-900">
                          [현장 사진 직접 올리기]
                        </span>
                        로 촬영하거나 사진 파일에서 올려 주세요.
                      </p>
                    ) : (
                      <div className="space-y-1.5">
                        <label
                          htmlFor="lesson1-photo-select"
                          className="block text-xs font-semibold text-slate-800"
                        >
                          1단계에서 불러온 {unlockedTarget.classRoom}{' '}
                          {unlockedTarget.groupName} 사진 선택 (
                          {verifiedObservationsWithPhotos.length}장)
                        </label>
                        <select
                          id="lesson1-photo-select"
                          value={selectedLesson1ObsId}
                          onChange={(e) =>
                            handleSelectLesson1Photo(e.target.value)
                          }
                          className="min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20"
                        >
                          <option value="">
                            -- 1차시 모둠 사진 중 하나를 선택하세요 --
                          </option>
                          {verifiedObservationsWithPhotos.map((obs) => {
                            const locText = obs.locationDetail
                              ? `${obs.locationCategory === '직접 입력' ? '' : obs.locationCategory + ' · '}${obs.locationDetail}`
                              : obs.locationCategory;
                            const captionSuffix = obs.photoCaption
                              ? ` (${obs.photoCaption})`
                              : '';
                            return (
                              <option key={obs.id} value={obs.id}>
                                {obs.authorName} · {locText}
                                {captionSuffix}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    )}
                  </div>
                )}

                {/* 실시간 카메라 촬영 화면 */}
                {isCameraOpen && (
                  <div className="space-y-3 rounded-xl border border-slate-300 bg-slate-950 p-3">
                    <div className="overflow-hidden rounded-lg bg-black">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="mx-auto max-h-72 w-full object-contain"
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
                          <RefreshCw
                            className="h-3.5 w-3.5"
                            aria-hidden="true"
                          />
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

                {/* 선택한 / 촬영한 사진 미리보기 */}
                {!isCameraOpen && form.referencePhotoDataUrl && (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
                      <span className="font-semibold text-slate-800">
                        선택한 현장 기준 사진 (후속 구현 시 활용)
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => void startCamera(facingMode)}
                          className="inline-flex min-h-[36px] items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          <Camera className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>다시 촬영</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setForm((prev) => ({
                              ...prev,
                              referencePhotoDataUrl: '',
                            }));
                            setSelectedLesson1ObsId('');
                          }}
                          className="inline-flex min-h-[36px] items-center gap-1 rounded-md px-2 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                        >
                          <X className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>제거</span>
                        </button>
                      </div>
                    </div>
                    <img
                      src={form.referencePhotoDataUrl}
                      alt="모둠이 선정한 현장 기준 사진"
                      referrerPolicy="no-referrer"
                      className="max-h-56 w-full rounded-md border border-slate-200 bg-white object-contain"
                    />
                    <p className="text-xs text-slate-600">
                      사진에 친구 얼굴이나 이름표 등 개인정보가 나오지 않았는지
                      확인해 주세요.
                    </p>
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

              <div className="space-y-1.5">
                <label
                  htmlFor="project-title"
                  className="block text-sm font-semibold text-slate-900"
                >
                  3. 최종 모둠 프로젝트 주제 (1가지)
                </label>
                <input
                  id="project-title"
                  type="text"
                  value={form.projectTitle}
                  onChange={(e) => {
                    setForm({ ...form, projectTitle: e.target.value });
                    if (errors.projectTitle) {
                      setErrors((prev) => ({ ...prev, projectTitle: '' }));
                    }
                  }}
                  placeholder="예: 인체감지 센서를 활용한 빈 교실 자동 소등 스마트 에코 기기"
                  maxLength={120}
                  className="min-h-[46px] w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-base text-slate-900 placeholder:text-slate-400 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20"
                />
                {errors.projectTitle && (
                  <p role="alert" className="text-xs font-medium text-rose-700">
                    {errors.projectTitle}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="core-question"
                  className="block text-sm font-semibold text-slate-900"
                >
                  4. 모둠 핵심 질문 (어떻게 해결할 수 있을까?)
                </label>
                <textarea
                  id="core-question"
                  rows={2}
                  value={form.coreQuestion}
                  onChange={(e) => {
                    setForm({ ...form, coreQuestion: e.target.value });
                    if (errors.coreQuestion) {
                      setErrors((prev) => ({ ...prev, coreQuestion: '' }));
                    }
                  }}
                  placeholder="예: 이동 수업 때 아무도 없는 교실에 켜져 있는 조명을 센서와 코딩으로 어떻게 자동으로 끄게 할 수 있을까?"
                  maxLength={250}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-base leading-relaxed text-slate-900 placeholder:text-slate-400 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20"
                />
                {errors.coreQuestion && (
                  <p role="alert" className="text-xs font-medium text-rose-700">
                    {errors.coreQuestion}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="selection-reason"
                  className="block text-sm font-semibold text-slate-900"
                >
                  5. 주제를 선정한 이유 (원인·문제점과 기존 경고문 대신 센서
                  자동화가 필요한 이유)
                </label>
                <textarea
                  id="selection-reason"
                  rows={2}
                  value={form.selectionReason}
                  onChange={(e) => {
                    setForm({ ...form, selectionReason: e.target.value });
                    if (errors.selectionReason) {
                      setErrors((prev) => ({ ...prev, selectionReason: '' }));
                    }
                  }}
                  placeholder="예: 이동 수업 시간마다 불이 켜져 있어 낭비가 잦고, 스위치 옆 종이 경고문만 붙여두면 잘 보지 않아 센서로 자동 제어할 필요가 있기 때문"
                  maxLength={300}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-base leading-relaxed text-slate-900 placeholder:text-slate-400 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20"
                />
                {errors.selectionReason && (
                  <p role="alert" className="text-xs font-medium text-rose-700">
                    {errors.selectionReason}
                  </p>
                )}
              </div>

              {/* 6. 구조화된 자연어 센서 제어 조건 초안 */}
              <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-900">
                    6. 센서 제어 조건 초안 (자연어 알고리즘: 만약 ~라면 →
                    ~한다)
                  </p>
                  <p className="text-xs text-slate-600">
                    센서가 감지하는 「조건」과 장치가 움직이는 「동작」을 나누어
                    작성하면 다음 차시 코딩 설계로 바로 이어집니다.
                  </p>
                  {adoptedSensorIdea && (
                    <p className="pt-1 text-xs font-medium text-emerald-800">
                      가져온 1차시 센서 아이디어 참고: {adoptedSensorIdea}
                    </p>
                  )}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="control-when"
                      className="block text-xs font-semibold text-slate-800"
                    >
                      언제 · 센서 입력 조건 (만약 ~라면)
                    </label>
                    <textarea
                      id="control-when"
                      rows={2}
                      value={form.controlConditionWhen}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          controlConditionWhen: e.target.value,
                        })
                      }
                      placeholder="예: 조도 센서가 밝고, 인체감지 센서에 3분 동안 움직임이 없다면"
                      maxLength={180}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base leading-relaxed text-slate-900 placeholder:text-slate-400 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="control-then"
                      className="block text-xs font-semibold text-slate-800"
                    >
                      어떻게 · 작동 출력 (~한다)
                    </label>
                    <textarea
                      id="control-then"
                      rows={2}
                      value={form.controlConditionThen}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          controlConditionThen: e.target.value,
                        })
                      }
                      placeholder="예: LED(조명)를 끄거나 서보모터로 스위치를 내려 절전한다"
                      maxLength={180}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base leading-relaxed text-slate-900 placeholder:text-slate-400 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || isProcessingPhoto}
                className="flex min-h-[50px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-base font-semibold text-white transition-colors hover:bg-emerald-800 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
              >
                <Send className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  {isSubmitting
                    ? '확인 중...'
                    : '최종 모둠 프로젝트 주제 제출하기'}
                </span>
              </button>
            </form>

            {submitFeedback && (
              <div
                role={submitFeedback.failed ? 'alert' : 'status'}
                className={`mt-5 rounded-xl border p-4 text-sm ${
                  submitFeedback.failed
                    ? 'border-rose-300 bg-rose-50 text-rose-950'
                    : submitFeedback.savedToServer
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-950'
                      : 'border-amber-300 bg-amber-50 text-amber-950'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  {submitFeedback.savedToServer && !submitFeedback.failed ? (
                    <Check
                      className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700"
                      aria-hidden="true"
                    />
                  ) : (
                    <AlertTriangle
                      className={`mt-0.5 h-4 w-4 shrink-0 ${
                        submitFeedback.failed
                          ? 'text-rose-700'
                          : 'text-amber-700'
                      }`}
                      aria-hidden="true"
                    />
                  )}
                  <div className="space-y-1.5">
                    <p className="font-semibold">
                      {submitFeedback.failed
                        ? '저장에 실패했습니다 · 다시 확인해 주세요'
                        : submitFeedback.savedToServer
                          ? '모둠 프로젝트 주제가 서버에 저장되었습니다'
                          : '서버에 저장되지 않음 (저장 준비 중 · 임시 미리보기)'}
                    </p>
                    <p className="leading-relaxed opacity-90">
                      {submitFeedback.message}
                    </p>
                    {!submitFeedback.failed && (
                      <p className="text-xs opacity-85">
                        모둠별 1가지 최종 주제로 정리되었으며, 다음 차시에
                        선생님과 함께 피지컬 컴퓨팅 설계로 이어집니다.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>

          {topics.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
              <div className="flex items-center justify-between gap-4">
                <h3 className="text-sm font-semibold text-slate-900 tabular-nums">
                  제출된 모둠별 프로젝트 주제 일지 ({topics.length})
                </h3>
                <span className="text-xs text-slate-500">
                  {topics[0].syncState === 'saved-to-api'
                    ? '서버 저장됨'
                    : '임시 미리보기 · 저장 준비 중'}
                </span>
              </div>
              <ul className="divide-y divide-slate-100">
                {topics.map((topic) => (
                  <li
                    key={topic.id}
                    className="flex items-start justify-between gap-3 py-3 text-sm"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
                        <span className="font-semibold text-emerald-800">
                          {topic.classRoom} · {topic.groupName}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{topic.selectedLocation}</span>
                        <span aria-hidden="true">·</span>
                        <span className="inline-flex items-center gap-1 tabular-nums">
                          <Clock className="h-3 w-3" aria-hidden="true" />
                          {formatTime(topic.createdAt)}
                        </span>
                      </div>
                      <p className="font-semibold text-slate-900">
                        {topic.projectTitle}
                      </p>
                      <p className="text-xs text-slate-600">
                        {topic.coreQuestion}
                      </p>
                      {topic.controlConditionDraft && (
                        <p className="text-xs text-slate-500">
                          제어 흐름: {topic.controlConditionDraft}
                        </p>
                      )}
                    </div>
                    {topic.syncState === 'preview-only' && (
                      <button
                        type="button"
                        onClick={() => onDeletePreviewTopic(topic.id)}
                        aria-label="임시 주제 일지 삭제"
                        className="flex min-h-[40px] min-w-[40px] shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* 사진 크게 보기 모달 */}
      {enlargedPhoto && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={enlargedPhoto.title}
          onClick={() => setEnlargedPhoto(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-3xl overflow-hidden rounded-xl bg-white shadow-xl"
          >
            <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-4 py-3">
              <p className="text-sm font-semibold text-slate-900 truncate">
                {enlargedPhoto.title}
              </p>
              <button
                type="button"
                onClick={() => setEnlargedPhoto(null)}
                aria-label="사진 닫기"
                className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <div className="bg-slate-900 p-2">
              <img
                src={enlargedPhoto.src}
                alt={enlargedPhoto.title}
                referrerPolicy="no-referrer"
                className="max-h-[75vh] w-full object-contain mx-auto"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
