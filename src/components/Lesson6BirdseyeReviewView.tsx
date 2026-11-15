import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  Check,
  ClipboardCheck,
  Copy,
  Image as ImageIcon,
  KeyRound,
  Lock,
  Maximize2,
  MessageSquareText,
  Scale,
  Send,
  X,
} from 'lucide-react';
import type { StorageConnectionStatus } from '../types/observation';
import {
  fetchStudentImage,
  fetchStudentStatus,
  submitBirdseyeReview,
  type BirdseyeVersion,
  type GroupCredential,
  type StudentBirdseyeData,
} from '../lib/birdseyeApi';
import {
  ETHICS_ITEMS,
  EVAL_ITEMS,
  aiImageLabel,
  composeFixRequest,
  formatDateTime,
  hasInappropriateWord,
  prefillFromTopic,
} from '../lib/birdseyeContent';
import { StorageStatusNotice } from './StorageStatusNotice';
import { CopyButton, GroupAuthCard, ImageModal, LessonFlowSection } from './BirdseyeShared';

interface Lesson6Props {
  storageStatus: StorageConnectionStatus;
  statusDetail?: string;
  isCheckingStorage: boolean;
  onRetryConnection: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}

const POLL_MS = 10_000;

export const Lesson6BirdseyeReviewView: React.FC<Lesson6Props> = ({
  storageStatus,
  statusDetail,
  isCheckingStorage,
  onRetryConnection,
  onDirtyChange,
}) => {
  const [cred, setCred] = useState<GroupCredential | null>(null);
  const [data, setData] = useState<StudentBirdseyeData | null>(null);
  const [versions, setVersions] = useState<BirdseyeVersion[]>([]);
  const [finalVersion, setFinalVersion] = useState<number | null>(null);
  const [finalImage, setFinalImage] = useState('');
  const [arrivalNotice, setArrivalNotice] = useState('');
  const [modal, setModal] = useState<{ src: string; title: string; caption?: string } | null>(
    null
  );
  const [loadingVersion, setLoadingVersion] = useState<number | null>(null);
  const imageCache = useRef(new Map<number, string>());

  const [checks, setChecks] = useState<number[]>([]);
  const [extraFix, setExtraFix] = useState('');
  const [reflection, setReflection] = useState('');
  const [savedAt, setSavedAt] = useState('');
  const [saveError, setSaveError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [ethicsAnswers, setEthicsAnswers] = useState<Record<number, boolean>>({});

  const promptValues = useMemo(
    () => data?.promptFields ?? prefillFromTopic(data?.topic ?? null),
    [data]
  );
  const fixText = composeFixRequest(checks, extraFix, promptValues);
  const label = aiImageLabel(promptValues.name || '');
  const referencePhoto = data?.topic?.referencePhotoDataUrl || '';

  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);

  const handleVerified = (loaded: StudentBirdseyeData, nextCred: GroupCredential) => {
    imageCache.current.clear();
    if (loaded.finalVersion !== null && loaded.finalImageDataUrl) {
      imageCache.current.set(loaded.finalVersion, loaded.finalImageDataUrl);
    }
    setCred(nextCred);
    setData(loaded);
    setVersions(loaded.versions);
    setFinalVersion(loaded.finalVersion);
    setFinalImage(loaded.finalImageDataUrl);
    // 지난 평가가 지금 최종본에 대한 것일 때만 체크를 이어서 보여 줌
    const sameVersion = loaded.review?.basedOnVersion === loaded.finalVersion;
    setChecks(sameVersion ? (loaded.review?.checks ?? []) : []);
    setExtraFix(sameVersion ? (loaded.review?.extraFix ?? '') : '');
    setReflection(loaded.review?.reflection ?? '');
    setSavedAt(loaded.reviewSavedAt);
    setArrivalNotice('');
    setDirty(false);
  };

  const handleSignOut = () => {
    setCred(null);
    setData(null);
    setVersions([]);
    setFinalVersion(null);
    setFinalImage('');
    setDirty(false);
  };

  // 선생님이 새 조감도를 올리면 10초 안에 자동으로 반영
  const finalRef = useRef<number | null>(null);
  finalRef.current = finalVersion;
  const maxVersionRef = useRef(0);
  maxVersionRef.current = versions.reduce((m, v) => Math.max(m, v.version), 0);
  const poll = useCallback(async () => {
    if (!cred || document.hidden) return;
    const status = await fetchStudentStatus(cred);
    if (!status.ok) return;
    const previousMax = maxVersionRef.current;
    setVersions(status.versions);
    if (status.finalVersion === finalRef.current) return;
    if (status.finalVersion === null) {
      setFinalVersion(null);
      setFinalImage('');
      return;
    }
    const target = status.finalVersion;
    let src = imageCache.current.get(target);
    if (!src) {
      const img = await fetchStudentImage(cred, target);
      if (!img.ok) return;
      src = img.dataUrl;
      imageCache.current.set(target, src);
    }
    const isNewUpload = target > previousMax;
    setFinalVersion(target);
    setFinalImage(src);
    // 새 조감도가 오면 평가표는 새로 체크하도록 비움 (성찰은 유지)
    setChecks([]);
    setExtraFix('');
    setArrivalNotice(
      isNewUpload
        ? `선생님이 새 조감도(${target}차)를 올렸어요! 평가표를 다시 체크해 보세요.`
        : `선생님이 ${target}차 조감도를 최종본으로 정했어요. 평가표를 다시 체크해 보세요.`
    );
  }, [cred]);

  useEffect(() => {
    if (!cred) return;
    const id = window.setInterval(() => void poll(), POLL_MS);
    const onVisible = () => !document.hidden && void poll();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [cred, poll]);

  const openVersion = async (version: number) => {
    if (!cred) return;
    let src = imageCache.current.get(version);
    if (!src) {
      setLoadingVersion(version);
      const img = await fetchStudentImage(cred, version);
      setLoadingVersion(null);
      if (!img.ok) return;
      src = img.dataUrl;
      imageCache.current.set(version, src);
    }
    setModal({
      src,
      title: `${cred.classRoom} · ${cred.groupName} · ${version}차 조감도${
        version === finalVersion ? ' (최종)' : ''
      }`,
      caption: label,
    });
  };

  const toggleCheck = (i: number) => {
    setChecks((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]));
    setDirty(true);
    setSaveError('');
  };

  const handleSave = async () => {
    if (!cred) return;
    if (hasInappropriateWord(`${extraFix} ${reflection}`)) {
      setSaveError('학교 수업에 맞지 않는 낱말이 있어요. 고친 뒤 다시 저장해 주세요.');
      return;
    }
    setIsSaving(true);
    setSaveError('');
    const res = await submitBirdseyeReview(cred, {
      checks,
      extraFix,
      fixText,
      reflection,
      basedOnVersion: finalVersion,
    });
    setIsSaving(false);
    if (!res.ok) {
      setSaveError(res.error);
      return;
    }
    setSavedAt(res.reviewSavedAt);
    setDirty(false);
  };

  const finalCreatedAt = versions.find((v) => v.version === finalVersion)?.createdAt || '';

  const saveButton = (text: string) => (
    <button
      type="button"
      onClick={() => void handleSave()}
      disabled={isSaving || !finalImage}
      className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-800 disabled:opacity-60 whitespace-nowrap"
    >
      <Send className="h-4 w-4" aria-hidden="true" />
      <span>{isSaving ? '저장 중...' : text}</span>
    </button>
  );

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs font-medium text-slate-500">
          중학교 1학년 정보(기술 융합) · 5단계(6차시) · 가상 조감도 판단 및 시연·제안
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          가상 조감도 확인하고 판단하기
        </h1>
        <p className="max-w-3xl text-sm leading-relaxed text-slate-600 sm:text-base">
          선생님이 우리 모둠 프롬프트로 만든 조감도를 원래 사진과 비교해 보세요. AI가 잘
          그린 점과 고쳐야 할 점을 우리가 판단하고, 발표에 쓸 최종 조감도를 완성해요.
        </p>
      </div>

      <StorageStatusNotice
        status={storageStatus}
        statusDetail={statusDetail}
        onRetryCheck={onRetryConnection}
        isChecking={isCheckingStorage}
        context="student"
      />

      <LessonFlowSection
        id="lesson6-flow-title"
        title="6차시 진행 순서"
        steps={[
          {
            icon: KeyRound,
            title: '모둠 인증 · 우리 조감도 열기',
            description: '우리 모둠 조감도만 볼 수 있어요. 새 버전이 오면 자동으로 바뀌어요.',
          },
          {
            icon: ClipboardCheck,
            title: 'H · 학생이 판단: 평가표',
            description: '원본 사진과 비교하며 맞는 항목에 체크해요. 못 한 항목이 수정 요청이 돼요.',
            highlight: true,
          },
          {
            icon: MessageSquareText,
            title: '수정 요청 보내기',
            description: '선생님이 수정 요청으로 다음 버전을 만들어 올려 줘요.',
          },
          {
            icon: Scale,
            title: 'AI 윤리 · 발표 준비',
            description: 'AI 이미지 표시 문구를 붙이고, 한 줄 성찰을 남겨요.',
          },
        ]}
      />

      <GroupAuthCard
        stepLabel="1단계 · 모둠 인증"
        title="우리 모둠 가상 조감도 열기"
        submitLabel="모둠 인증하고 조감도 보기"
        helpText="모둠 인증코드가 맞아야 우리 모둠 조감도만 열려요. 다른 모둠의 조감도는 볼 수 없어요."
        verified={cred}
        verifiedSummary={
          finalVersion ? `조감도 ${versions.length}개 · 최종 ${finalVersion}차` : '조감도 준비 중'
        }
        onVerified={handleVerified}
        onSignOut={handleSignOut}
      />

      {!cred || !data ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center">
          <Lock className="h-5 w-5 text-slate-400" aria-hidden="true" />
          <p className="text-sm font-semibold text-slate-900">
            위에서 모둠 인증을 하면 우리 모둠 조감도가 열려요
          </p>
        </div>
      ) : (
        <>
          {/* 조감도 비교 */}
          <section
            aria-labelledby="birdseye-compare-title"
            className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 space-y-4"
          >
            <div className="flex flex-col gap-2 border-b border-slate-100 pb-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold text-emerald-800">
                  2단계 · 원본과 AI 조감도 비교
                </p>
                <h2
                  id="birdseye-compare-title"
                  className="mt-1 text-lg font-bold text-slate-900 sm:text-xl"
                >
                  {data.topic?.projectTitle || '우리 모둠 가상 조감도'}
                </h2>
              </div>
              <p className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-600" />
                </span>
                새 조감도를 자동으로 확인하고 있어요
              </p>
            </div>

            {arrivalNotice && (
              <div
                role="status"
                className="flex items-center justify-between gap-3 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-950"
              >
                <span className="inline-flex items-center gap-2 font-semibold">
                  <Bell className="h-4 w-4 text-emerald-700" aria-hidden="true" />
                  {arrivalNotice}
                </span>
                <button
                  type="button"
                  onClick={() => setArrivalNotice('')}
                  aria-label="알림 닫기"
                  className="flex min-h-[32px] min-w-[32px] items-center justify-center rounded-md text-emerald-800 hover:bg-emerald-100"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <figure className="space-y-2">
                <figcaption className="text-xs font-semibold text-slate-500">
                  원래 사진 (2차시)
                </figcaption>
                <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                  {referencePhoto ? (
                    <>
                      <img
                        src={referencePhoto}
                        alt="2차시 모둠 대표 사진"
                        referrerPolicy="no-referrer"
                        className="aspect-[4/3] w-full object-contain"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setModal({
                            src: referencePhoto,
                            title: `${cred.classRoom} · ${cred.groupName} · 원래 사진`,
                          })
                        }
                        className="absolute right-2 bottom-2 inline-flex min-h-[34px] items-center gap-1 rounded-md bg-slate-900/80 px-2.5 py-1 text-xs font-medium text-white hover:bg-slate-900"
                      >
                        <Maximize2 className="h-3 w-3" aria-hidden="true" />
                        <span>크게</span>
                      </button>
                    </>
                  ) : (
                    <div className="flex aspect-[4/3] items-center justify-center text-xs text-slate-500">
                      2차시 대표 사진이 없어요
                    </div>
                  )}
                </div>
              </figure>

              <figure className="space-y-2">
                <figcaption className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-500">
                  <span>AI 가상 조감도</span>
                  {finalVersion && (
                    <span className="rounded-full bg-emerald-700 px-2 py-0.5 text-[11px] font-semibold text-white tabular-nums">
                      {finalVersion}차 · 최종
                      {finalCreatedAt ? ` · ${formatDateTime(finalCreatedAt)}` : ''}
                    </span>
                  )}
                </figcaption>
                <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                  {finalImage ? (
                    <>
                      <img
                        src={finalImage}
                        alt="AI로 만든 가상 조감도"
                        referrerPolicy="no-referrer"
                        className="aspect-[4/3] w-full object-contain"
                      />
                      <button
                        type="button"
                        onClick={() => finalVersion && void openVersion(finalVersion)}
                        className="absolute right-2 bottom-2 inline-flex min-h-[34px] items-center gap-1 rounded-md bg-slate-900/80 px-2.5 py-1 text-xs font-medium text-white hover:bg-slate-900"
                      >
                        <Maximize2 className="h-3 w-3" aria-hidden="true" />
                        <span>크게</span>
                      </button>
                    </>
                  ) : (
                    <div className="flex aspect-[4/3] flex-col items-center justify-center gap-2 px-6 text-center">
                      <ImageIcon className="h-6 w-6 text-slate-400" aria-hidden="true" />
                      <p className="text-sm font-semibold text-slate-700">
                        아직 조감도가 올라오지 않았어요
                      </p>
                      <p className="text-xs leading-relaxed text-slate-500">
                        선생님이 올리면 새로고침하지 않아도 여기에 자동으로 나타나요.
                      </p>
                    </div>
                  )}
                </div>
              </figure>
            </div>

            {versions.length > 1 && (
              <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                <span className="text-xs font-semibold text-slate-500">이전 버전 보기</span>
                {versions.map((v) => (
                  <button
                    key={v.version}
                    type="button"
                    onClick={() => void openVersion(v.version)}
                    className={`inline-flex min-h-[36px] items-center gap-1 rounded-lg border px-3 py-1 text-xs font-semibold tabular-nums ${
                      v.version === finalVersion
                        ? 'border-emerald-700 bg-emerald-50 text-emerald-800'
                        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {loadingVersion === v.version ? '불러오는 중…' : `${v.version}차`}
                    {v.version === finalVersion && <Check className="h-3 w-3" aria-hidden="true" />}
                  </button>
                ))}
              </div>
            )}
          </section>

          <div className="grid gap-8 lg:grid-cols-12 lg:items-start">
            {/* 평가표 + 수정 요청 + 성찰 */}
            <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 space-y-5 lg:col-span-7">
              <div className="border-b border-slate-100 pb-4">
                <p className="text-xs font-semibold text-emerald-800">3단계 · H 학생이 판단</p>
                <h2 className="mt-1 text-lg font-bold text-slate-900 sm:text-xl">
                  AI 조감도 평가표
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  최종 조감도를 보고 맞으면 체크해요. 체크하지 못한 항목이 다음 수정 요청이
                  돼요.
                </p>
              </div>

              <ul className="space-y-2">
                {EVAL_ITEMS.map((item, i) => {
                  const on = checks.includes(i);
                  return (
                    <li key={item.label}>
                      <label
                        className={`flex min-h-[48px] cursor-pointer items-center gap-3 rounded-lg border px-3.5 py-2.5 text-sm transition-colors ${
                          on
                            ? 'border-emerald-300 bg-emerald-50/60 text-emerald-950'
                            : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
                        } ${!finalImage ? 'opacity-60' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={on}
                          disabled={!finalImage}
                          onChange={() => toggleCheck(i)}
                          className="h-5 w-5 shrink-0 accent-emerald-700"
                        />
                        <span className="leading-relaxed">{item.label}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>

              <div className="space-y-1.5">
                <label
                  htmlFor="birdseye-extra-fix"
                  className="block text-sm font-semibold text-slate-900"
                >
                  더 고치고 싶은 점{' '}
                  <span className="text-xs font-normal text-slate-500">선택 · 100자까지</span>
                </label>
                <input
                  id="birdseye-extra-fix"
                  type="text"
                  value={extraFix}
                  disabled={!finalImage}
                  onChange={(e) => {
                    setExtraFix(e.target.value);
                    setDirty(true);
                  }}
                  maxLength={100}
                  placeholder="예: 기기 옆에 '에너지 지킴이' 스티커를 붙여 줘"
                  className="min-h-[46px] w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-base text-slate-900 placeholder:text-slate-400 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 disabled:bg-slate-50"
                />
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold text-slate-900">수정 요청 문장</p>
                {fixText ? (
                  <div className="whitespace-pre-wrap rounded-xl border-2 border-dashed border-emerald-300 bg-emerald-50/30 px-4 py-3.5 text-sm leading-relaxed text-slate-900">
                    {fixText}
                  </div>
                ) : (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3.5 text-sm font-semibold text-emerald-900">
                    모든 항목을 만족해요! 수정 없이 이 조감도를 발표에 써요.
                  </div>
                )}
                <p className="text-xs leading-relaxed text-slate-500">
                  AI는 그럴듯하게 그리지만, 실제로 작동하는지는 판단하지 못해요. 센서가 사람을
                  감지할 수 있는 위치인지, 전선과 전원은 어떻게 연결될지는{' '}
                  <span className="font-semibold text-slate-700">우리가</span> 판단해요.
                </p>
              </div>

              <div className="flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-slate-500">
                  {savedAt
                    ? `선생님께 보냄 · ${formatDateTime(savedAt)}${dirty ? ' (바뀐 내용 있음)' : ''}`
                    : finalImage
                      ? '아직 보내지 않았어요.'
                      : '조감도가 올라오면 평가할 수 있어요.'}
                </p>
                {saveButton(fixText ? '선생님께 수정 요청 보내기' : '평가 결과 저장하기')}
              </div>

              {saveError && (
                <p
                  role="alert"
                  className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-900"
                >
                  {saveError}
                </p>
              )}
            </section>

            {/* AI 윤리 + 표시 문구 */}
            <aside className="space-y-4 lg:col-span-5">
              <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Scale className="h-4 w-4 text-emerald-700" aria-hidden="true" />
                  <span>AI 윤리 · 괜찮을까요?</span>
                </div>
                <ul className="space-y-2.5">
                  {ETHICS_ITEMS.map((item, i) => {
                    const answer = ethicsAnswers[i];
                    const answered = answer !== undefined;
                    const correct = answered && answer === item.ok;
                    return (
                      <li key={i} className="rounded-lg border border-slate-200 p-3 space-y-2">
                        <p className="text-sm leading-relaxed text-slate-800">{item.text}</p>
                        <div className="flex gap-2">
                          {[true, false].map((choice) => {
                            const picked = answer === choice;
                            return (
                              <button
                                key={String(choice)}
                                type="button"
                                onClick={() =>
                                  setEthicsAnswers((prev) => ({ ...prev, [i]: choice }))
                                }
                                className={`min-h-[36px] flex-1 rounded-md border px-2 py-1 text-xs font-semibold ${
                                  picked
                                    ? choice === item.ok
                                      ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                                      : 'border-rose-300 bg-rose-50 text-rose-800'
                                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                                }`}
                              >
                                {choice ? '괜찮아요' : '안 돼요'}
                              </button>
                            );
                          })}
                        </div>
                        {answered && (
                          <p
                            className={`text-xs leading-relaxed ${
                              correct ? 'text-emerald-800' : 'text-rose-800'
                            }`}
                          >
                            {correct ? item.why : '다시 생각해 봐요.'}
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
                <p className="text-sm font-semibold text-slate-900">AI 이미지 표시 문구</p>
                <p className="text-xs leading-relaxed text-slate-600">
                  발표 자료나 게시물에 조감도를 넣을 때 아래 문구를 함께 붙여요.
                </p>
                <p className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm font-medium leading-relaxed text-slate-900">
                  {label}
                </p>
                <CopyButton
                  text={label}
                  label="표시 문구 복사"
                  icon={<Copy className="h-3.5 w-3.5" aria-hidden="true" />}
                />
              </div>
            </aside>
          </div>

          {/* 한 줄 성찰 */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 space-y-3">
            <p className="text-xs font-semibold text-emerald-800">4단계 · 정리</p>
            <h2 className="text-lg font-bold text-slate-900">한 줄 성찰</h2>
            <p className="text-sm leading-relaxed text-slate-700">
              AI는 우리가 상상한 기기를 <span className="font-semibold">보이게</span> 해
              주었어요. 그렇다면 기기를 <span className="font-semibold">작동하게</span> 만드는
              것은 누구의 몫일까요?
            </p>
            <textarea
              value={reflection}
              onChange={(e) => {
                setReflection(e.target.value);
                setDirty(true);
              }}
              rows={3}
              maxLength={300}
              placeholder="예: AI는 모습만 보여 주고, 센서 값과 조건을 정해 실제로 작동하게 만드는 건 우리의 코드다."
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-base text-slate-900 placeholder:text-slate-400 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20"
            />
            <div className="flex justify-end">{saveButton('성찰 저장하기')}</div>
          </section>
        </>
      )}

      {modal && (
        <ImageModal
          src={modal.src}
          title={modal.title}
          caption={modal.caption}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
};
