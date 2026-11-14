import React, { useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Camera,
  Check,
  Clock,
  KeyRound,
  Lightbulb,
  Lock,
  Maximize2,
  Send,
  Trash2,
  Unlock,
  Users,
  X,
} from 'lucide-react';
import {
  GROUP_NAME_PRESETS,
  type GroupAuthCode,
  type GroupTopicInput,
  type GroupTopicRecord,
  type ObservationRecord,
  type StorageConnectionStatus,
} from '../types/observation';
import { compressImageFile } from '../lib/imageUtils';
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
  isCheckingStorage: boolean;
  onRetryConnection: () => void;
  onTopicSubmitted: (result: ApiSubmitTopicResult) => void;
  onDeletePreviewTopic: (id: string) => void;
  onGoToTeacherView: () => void;
  onGoToTeacherCodes: () => void;
}

const INITIAL_TOPIC_FORM: GroupTopicInput = {
  classInfo: '',
  groupName: '1모둠',
  groupMembers: '',
  selectedLocation: '',
  referencePhotoDataUrl: '',
  projectTitle: '',
  coreQuestion: '',
  selectionReason: '',
  controlConditionDraft: '',
};

export const GroupTopicSelectionView: React.FC<GroupTopicSelectionViewProps> = ({
  observations,
  topics,
  groupCodes,
  storageStatus,
  isCheckingStorage,
  onRetryConnection,
  onTopicSubmitted,
  onDeletePreviewTopic,
  onGoToTeacherView,
  onGoToTeacherCodes,
}) => {
  // 상단 구역: 모둠 인증코드 확인 상태
  const [authGroupPreset, setAuthGroupPreset] = useState<string>('1모둠');
  const [authGroupName, setAuthGroupName] = useState<string>('1모둠');
  const [authCodeInput, setAuthCodeInput] = useState<string>('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string>('');
  const [unlockedGroup, setUnlockedGroup] = useState<string | null>(null);
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
  const [formGroupPreset, setFormGroupPreset] = useState<string>('1모둠');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [photoError, setPhotoError] = useState('');
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitFeedback, setSubmitFeedback] =
    useState<ApiSubmitTopicResult | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const topicFormRef = useRef<HTMLDivElement | null>(null);

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
      const result = await verifyGroupAuthAndFetchObservations(
        authGroupName.trim(),
        authCodeInput.trim(),
        groupCodes,
        observations
      );

      if (!result.verified) {
        setVerifyError(result.message);
        return;
      }

      const targetGroup = authGroupName.trim();
      setUnlockedGroup(targetGroup);
      setVerifiedObservations(result.observations);
      setVerifyNotice(result.message);

      // 하단 최종 주제 폼의 모둠 정보도 자연스럽게 동기화
      if (
        (GROUP_NAME_PRESETS as readonly string[]).includes(targetGroup) &&
        targetGroup !== '직접 입력'
      ) {
        setFormGroupPreset(targetGroup);
      } else {
        setFormGroupPreset('직접 입력');
      }
      setForm((prev) => ({
        ...prev,
        groupName: targetGroup,
      }));
    } finally {
      setIsVerifying(false);
    }
  };

  const handleLockGroup = () => {
    setUnlockedGroup(null);
    setVerifiedObservations([]);
    setAuthCodeInput('');
    setVerifyError('');
    setVerifyNotice('');
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

    setForm((prev) => ({
      ...prev,
      selectedLocation: locationText,
      referencePhotoDataUrl: obs.photoDataUrl || prev.referencePhotoDataUrl,
      selectionReason: prev.selectionReason || obs.wasteCause,
      controlConditionDraft: prev.controlConditionDraft || obs.sensorIdea,
    }));

    setErrors((prev) => {
      const next = { ...prev };
      delete next.selectedLocation;
      return next;
    });

    topicFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPhotoError('');
    setIsProcessingPhoto(true);
    try {
      const compressed = await compressImageFile(file);
      setForm((prev) => ({
        ...prev,
        referencePhotoDataUrl: compressed.dataUrl,
      }));
    } catch (err) {
      setPhotoError(
        err instanceof Error ? err.message : '사진을 처리하지 못했습니다.'
      );
    } finally {
      setIsProcessingPhoto(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const validate = (): boolean => {
    const nextErrors: Record<string, string> = {};

    if (!form.classInfo.trim()) {
      nextErrors.classInfo = '학년·반을 입력해 주세요. (예: 1학년 2반)';
    }
    if (!form.groupName.trim()) {
      nextErrors.groupName = '모둠 이름을 선택하거나 입력해 주세요.';
    }
    if (!form.groupMembers.trim()) {
      nextErrors.groupMembers = '모둠원 이름을 입력해 주세요.';
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
        '이 주제를 선정한 이유(원인과 해결 필요성)를 적어 주세요.';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const cleaned: GroupTopicInput = {
        classInfo: form.classInfo.trim(),
        groupName: form.groupName.trim(),
        groupMembers: form.groupMembers.trim(),
        selectedLocation: form.selectedLocation.trim(),
        referencePhotoDataUrl: form.referencePhotoDataUrl,
        projectTitle: form.projectTitle.trim(),
        coreQuestion: form.coreQuestion.trim(),
        selectionReason: form.selectionReason.trim(),
        controlConditionDraft: form.controlConditionDraft.trim(),
      };

      const result = await submitGroupTopic(cleaned);
      setSubmitFeedback(result);
      onTopicSubmitted(result);

      setForm((prev) => ({
        ...INITIAL_TOPIC_FORM,
        classInfo: prev.classInfo,
        groupName: prev.groupName,
        groupMembers: prev.groupMembers,
      }));
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
        onRetryCheck={onRetryConnection}
        isChecking={isCheckingStorage}
        context="student"
      />

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

          {unlockedGroup && (
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

        {!unlockedGroup ? (
          <form onSubmit={handleVerifySubmit} noValidate className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-900">
                1. 확인할 모둠 선택
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
                  placeholder="예: 7모둠"
                  aria-label="확인할 모둠 이름 직접 입력"
                  maxLength={30}
                  className="min-h-[46px] w-full max-w-xs rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-base text-slate-900 placeholder:text-slate-400 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20"
                />
              )}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1 max-w-sm space-y-1.5">
                <label
                  htmlFor="group-auth-code"
                  className="block text-sm font-semibold text-slate-900"
                >
                  2. 교사에게 받은 모둠 인증코드
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
                className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-800 disabled:opacity-60 whitespace-nowrap shrink-0"
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
                className="flex flex-col gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-900 sm:flex-row sm:items-center sm:justify-between"
              >
                <p className="font-medium leading-relaxed">{verifyError}</p>
                {groupCodes.length === 0 && (
                  <button
                    type="button"
                    onClick={onGoToTeacherCodes}
                    className="inline-flex min-h-[38px] items-center gap-1 self-start rounded-md border border-rose-300 bg-white px-3 py-1.5 text-xs font-semibold text-rose-900 hover:bg-rose-100/60 whitespace-nowrap shrink-0 sm:self-auto"
                  >
                    <span>교사 화면에서 인증코드 만들기</span>
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                )}
              </div>
            )}

            <p className="text-xs leading-relaxed text-slate-500">
              교사가 「교사 확인 → 모둠 인증코드 관리」에서 만든 인증코드를
              입력하면, 해당 모둠 소속 학생들이 1차시에 제출한 개인별 일지와
              현장 사진을 이 구역에서 바로 모아볼 수 있습니다.
            </p>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-950">
              <div className="flex items-center gap-2">
                <Check
                  className="h-4 w-4 shrink-0 text-emerald-700"
                  aria-hidden="true"
                />
                <span className="font-semibold">{unlockedGroup} 인증됨</span>
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
                  {unlockedGroup}의 1차시 개인 관찰 일지가 아직 없습니다
                </p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  1차시 화면에서 소속 모둠을 「{unlockedGroup}」으로 선택해
                  개인 기록을 작성하면 이곳에 모여 보입니다. 아래에서 직접 공간과
                  주제를 입력할 수도 있습니다.
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
                            {obs.classInfo} {obs.authorName}
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
                                  title: `${obs.groupName} · ${obs.authorName} (${displayLocation})`,
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
                모둠이 함께 만들 에너지 절약 시스템의 이름과 핵심 질문을
                정합니다.
              </li>
              <li>
                <span className="font-semibold text-slate-900">
                  3. 자연어 제어 조건 작성:
                </span>{' '}
                경고문이 아니라 센서 조건(“만약 ~라면 ~한다”)으로 해결 흐름을
                적습니다.
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

            <form onSubmit={handleSubmit} noValidate className="mt-5 space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label
                    htmlFor="topic-class-info"
                    className="block text-sm font-semibold text-slate-900"
                  >
                    학년 · 반
                  </label>
                  <input
                    id="topic-class-info"
                    type="text"
                    value={form.classInfo}
                    onChange={(e) => {
                      setForm({ ...form, classInfo: e.target.value });
                      if (errors.classInfo) {
                        setErrors((prev) => ({ ...prev, classInfo: '' }));
                      }
                    }}
                    placeholder="예: 1학년 2반"
                    maxLength={40}
                    className="min-h-[46px] w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-base text-slate-900 placeholder:text-slate-400 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20"
                  />
                  {errors.classInfo && (
                    <p
                      role="alert"
                      className="text-xs font-medium text-rose-700"
                    >
                      {errors.classInfo}
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
                    placeholder="예: 7모둠"
                    aria-label="모둠 이름 직접 입력"
                    maxLength={30}
                    className="min-h-[46px] w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-base text-slate-900 placeholder:text-slate-400 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20"
                  />
                )}
                {errors.groupName && (
                  <p role="alert" className="text-xs font-medium text-rose-700">
                    {errors.groupName}
                  </p>
                )}
              </fieldset>

              <div className="space-y-2.5">
                <label
                  htmlFor="selected-location"
                  className="block text-sm font-semibold text-slate-900"
                >
                  2. 최종 선정한 학교 공간
                </label>
                <input
                  id="selected-location"
                  type="text"
                  value={form.selectedLocation}
                  onChange={(e) => {
                    setForm({ ...form, selectedLocation: e.target.value });
                    if (errors.selectedLocation) {
                      setErrors((prev) => ({ ...prev, selectedLocation: '' }));
                    }
                  }}
                  placeholder="예: 빈 교실 · 2층 1학년 2반 교실"
                  maxLength={80}
                  className="min-h-[46px] w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-base text-slate-900 placeholder:text-slate-400 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20"
                />
                {errors.selectedLocation && (
                  <p role="alert" className="text-xs font-medium text-rose-700">
                    {errors.selectedLocation}
                  </p>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="sr-only"
                />

                {form.referencePhotoDataUrl ? (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2 text-xs text-slate-600">
                      <span className="font-semibold text-slate-800">
                        선택한 현장 기준 사진 (후속 구현 시 활용)
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setForm((prev) => ({
                            ...prev,
                            referencePhotoDataUrl: '',
                          }))
                        }
                        className="inline-flex min-h-[36px] items-center gap-1 rounded-md px-2 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                      >
                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>제거</span>
                      </button>
                    </div>
                    <img
                      src={form.referencePhotoDataUrl}
                      alt="모둠이 선정한 현장 기준 사진"
                      referrerPolicy="no-referrer"
                      className="max-h-52 w-full rounded-md border border-slate-200 object-contain bg-white"
                    />
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={isProcessingPhoto}
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-slate-300 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    <Camera
                      className="h-4 w-4 text-emerald-700"
                      aria-hidden="true"
                    />
                    <span>
                      {isProcessingPhoto
                        ? '사진을 불러오는 중...'
                        : '현장 기준 사진 직접 올리기 (또는 위 1차시 기록에서 선택)'}
                    </span>
                  </button>
                )}

                {photoError && (
                  <p role="alert" className="text-xs font-medium text-rose-700">
                    {photoError}
                  </p>
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
                  5. 주제를 선정한 이유 (원인과 해결 필요성)
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
                  placeholder="예: 우리 반 이동 수업 시간마다 불이 켜져 있어 낭비가 잦고, 경고문만 붙여두면 잘 지켜지지 않기 때문"
                  maxLength={300}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-base leading-relaxed text-slate-900 placeholder:text-slate-400 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20"
                />
                {errors.selectionReason && (
                  <p role="alert" className="text-xs font-medium text-rose-700">
                    {errors.selectionReason}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="control-draft"
                  className="block text-sm font-semibold text-slate-900"
                >
                  6. 센서 제어 조건 초안 (자연어: 만약 ~라면 ~한다)
                </label>
                <textarea
                  id="control-draft"
                  rows={2}
                  value={form.controlConditionDraft}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      controlConditionDraft: e.target.value,
                    })
                  }
                  placeholder="예: 만약 조도 센서가 밝은 상태이고 인체감지 센서에 3분 동안 움직임이 없으면, LED(조명)를 끈다."
                  maxLength={300}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-base leading-relaxed text-slate-900 placeholder:text-slate-400 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20"
                />
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
                        ? '모둠 프로젝트 주제가 서버에 저장되었습니다'
                        : '입력 완료 (저장 준비 중 · 임시 미리보기)'}
                    </p>
                    <p className="leading-relaxed opacity-90">
                      {submitFeedback.message}
                    </p>
                    <button
                      type="button"
                      onClick={onGoToTeacherView}
                      className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-current/20 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 hover:bg-slate-50"
                    >
                      <span>교사 확인 화면에서 선정된 모둠 주제 보기</span>
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
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
                          {topic.groupName}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{topic.classInfo}</span>
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
