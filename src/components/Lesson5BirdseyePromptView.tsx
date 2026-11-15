import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Info,
  KeyRound,
  Lightbulb,
  Lock,
  Maximize2,
  PenLine,
  Send,
  Sparkles,
  X,
} from 'lucide-react';
import type { StorageConnectionStatus } from '../types/observation';
import {
  submitBirdseyePrompt,
  type GroupCredential,
  type StudentBirdseyeData,
} from '../lib/birdseyeApi';
import {
  OWN_MAX_LENGTH,
  OWN_OPTION,
  PROMPT_CHECKS,
  PROMPT_FIELDS,
  composePrompt,
  formatDateTime,
  hasInappropriateWord,
  prefillFromTopic,
  type PromptValues,
} from '../lib/birdseyeContent';
import { StorageStatusNotice } from './StorageStatusNotice';
import { GroupAuthCard, ImageModal, LessonFlowSection } from './BirdseyeShared';

interface Lesson5Props {
  storageStatus: StorageConnectionStatus;
  statusDetail?: string;
  isCheckingStorage: boolean;
  onRetryConnection: () => void;
  onGoToLesson6: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}

const COMPARE_OPTIONS = [
  { good: false, text: '"복도에 멋진 에너지 절약 기계 넣어 줘."' },
  {
    good: true,
    text: '"복도 전등 스위치 위 벽에 손바닥만 한 흰색 상자를 달아 줘. 앞면에 인체 감지 센서와 초록 LED가 있고, 사람이 없어서 전등이 꺼진 장면이야. 나머지 배경은 그대로 둬."',
  },
];

function ownModesFor(values: PromptValues): Record<string, boolean> {
  const modes: Record<string, boolean> = {};
  PROMPT_FIELDS.forEach((f) => {
    const v = values[f.id];
    if (f.options && v && !f.options.includes(v)) modes[f.id] = true;
  });
  return modes;
}

export const Lesson5BirdseyePromptView: React.FC<Lesson5Props> = ({
  storageStatus,
  statusDetail,
  isCheckingStorage,
  onRetryConnection,
  onGoToLesson6,
  onDirtyChange,
}) => {
  const [cred, setCred] = useState<GroupCredential | null>(null);
  const [data, setData] = useState<StudentBirdseyeData | null>(null);
  const [values, setValues] = useState<PromptValues>({});
  const [ownModes, setOwnModes] = useState<Record<string, boolean>>({});
  const [compareAnswer, setCompareAnswer] = useState<number | null>(null);
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedAt, setSubmittedAt] = useState('');
  const [justSubmitted, setJustSubmitted] = useState(false);
  const [enlarged, setEnlarged] = useState(false);
  const baselineRef = useRef('');

  const prompt = useMemo(() => composePrompt(values), [values]);
  const checks = PROMPT_CHECKS.map((c) => ({ label: c.label, ok: c.ok(values) }));
  const allChecked = checks.every((c) => c.ok);

  useEffect(() => {
    onDirtyChange?.(Boolean(cred) && JSON.stringify(values) !== baselineRef.current);
  }, [values, cred, onDirtyChange]);

  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);

  const handleVerified = (loaded: StudentBirdseyeData, nextCred: GroupCredential) => {
    const initial = loaded.promptFields ?? prefillFromTopic(loaded.topic);
    baselineRef.current = JSON.stringify(initial);
    setCred(nextCred);
    setData(loaded);
    setValues(initial);
    setOwnModes(ownModesFor(initial));
    setSubmittedAt(loaded.promptSubmittedAt);
    setJustSubmitted(false);
    setFormError('');
  };

  const handleSignOut = () => {
    setCred(null);
    setData(null);
    setValues({});
    setOwnModes({});
    setSubmittedAt('');
    baselineRef.current = '';
  };

  const setValue = (id: string, value: string) => {
    setValues((prev) => ({ ...prev, [id]: value }));
    setFormError('');
    setJustSubmitted(false);
  };

  const handleSelect = (id: string, selected: string) => {
    if (selected === OWN_OPTION) {
      setOwnModes((prev) => ({ ...prev, [id]: true }));
      setValue(id, '');
    } else {
      setOwnModes((prev) => ({ ...prev, [id]: false }));
      setValue(id, selected);
    }
  };

  const handleSubmit = async () => {
    if (!cred) return;
    if (hasInappropriateWord(prompt)) {
      setFormError('학교 수업에 맞지 않는 낱말이 있어요. 고친 뒤 다시 제출해 주세요.');
      return;
    }
    const missing = checks.filter((c) => !c.ok).map((c) => c.label);
    if (missing.length) {
      setFormError(
        `아직 비어 있어요: ${missing.join(', ')} — 모두 채우면 AI가 더 정확하게 그려요.`
      );
      return;
    }
    setIsSubmitting(true);
    const cleaned: PromptValues = {};
    Object.entries(values).forEach(([k, v]) => {
      if (v.trim()) cleaned[k] = v.trim();
    });
    const res = await submitBirdseyePrompt(cred, cleaned, prompt);
    setIsSubmitting(false);
    if (!res.ok) {
      setFormError(res.error);
      return;
    }
    baselineRef.current = JSON.stringify(values);
    onDirtyChange?.(false);
    setSubmittedAt(res.promptSubmittedAt);
    setJustSubmitted(true);
  };

  const topic = data?.topic ?? null;
  const referencePhoto = topic?.referencePhotoDataUrl || '';

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs font-medium text-slate-500">
          중학교 1학년 정보(기술 융합) · 4단계(5차시) · AI 이미지 생성기를 활용한 가상
          조감도 제작
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          가상 조감도 프롬프트 만들기
        </h1>
        <p className="max-w-3xl text-sm leading-relaxed text-slate-600 sm:text-base">
          우리 모둠 기기가 학교에 실제로 설치된다면 어떤 모습일까요? 2차시에 고른 우리
          모둠 사진을 바탕으로, AI에게 정확하게 부탁하는 문장(프롬프트)을 함께 만들어
          선생님께 제출해요.
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
        id="lesson5-flow-title"
        title="5차시 진행 순서"
        steps={[
          {
            icon: KeyRound,
            title: '모둠 인증 · 2차시 주제 불러오기',
            description:
              '모둠 인증코드를 입력하면 2차시에 확정한 주제와 대표 사진이 자동으로 들어와요.',
          },
          {
            icon: PenLine,
            title: 'H · 학생이 먼저: 프롬프트 설계',
            description:
              '어디에, 무엇을, 어떤 모양, 어떻게 작동, 왜 — 5가지를 채워 AI에게 부탁할 문장을 완성해요.',
            highlight: true,
          },
          {
            icon: Sparkles,
            title: 'A · AI가 돕기: 선생님이 생성',
            description:
              '제출한 프롬프트로 선생님이 조감도를 만들어 올려요. 6차시에 확인하고 판단해요.',
          },
        ]}
      />

      <GroupAuthCard
        stepLabel="1단계 · 모둠 인증"
        title="우리 모둠 주제와 대표 사진 불러오기"
        submitLabel="모둠 인증하고 시작하기"
        helpText="2차시와 같은 모둠 인증코드를 입력하세요. 우리 모둠이 확정한 주제와 대표 사진만 불러와요."
        verified={cred}
        verifiedSummary={
          submittedAt ? `프롬프트 제출함 · ${formatDateTime(submittedAt)}` : '아직 제출 전'
        }
        onVerified={handleVerified}
        onSignOut={handleSignOut}
      />

      <div className="grid gap-8 lg:grid-cols-12 lg:items-start">
        {/* 생각 열기 */}
        <aside className="space-y-4 lg:col-span-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Lightbulb className="h-4 w-4 text-emerald-700" aria-hidden="true" />
              <span>생각 열기 · 어느 부탁이 더 좋을까요?</span>
            </div>
            <p className="text-xs leading-relaxed text-slate-600">
              같은 복도 사진을 AI에게 주었어요. 우리 기기가 원하는 모습으로 나올 가능성이
              높은 쪽을 골라 보세요.
            </p>
            <div className="space-y-2">
              {COMPARE_OPTIONS.map((opt, i) => {
                const picked = compareAnswer === i;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setCompareAnswer(i)}
                    className={`w-full rounded-lg border px-3.5 py-3 text-left text-sm leading-relaxed transition-colors ${
                      picked
                        ? opt.good
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-950'
                          : 'border-rose-300 bg-rose-50 text-rose-950'
                        : 'border-slate-200 bg-slate-50/60 text-slate-800 hover:bg-slate-50'
                    }`}
                  >
                    {opt.text}
                  </button>
                );
              })}
            </div>
            {compareAnswer !== null && (
              <p
                role="status"
                className={`rounded-lg px-3 py-2 text-xs font-medium leading-relaxed ${
                  COMPARE_OPTIONS[compareAnswer].good
                    ? 'bg-emerald-50 text-emerald-900'
                    : 'bg-rose-50 text-rose-900'
                }`}
              >
                {COMPARE_OPTIONS[compareAnswer].good
                  ? '맞아요! 위치·기기·모양·작동 장면·지킬 것이 모두 들어 있어요.'
                  : '"멋진 기계"만으로는 AI가 무엇을 어디에 그려야 할지 몰라요. 다른 쪽과 비교해 보세요.'}
              </p>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
            <p className="text-sm font-semibold text-slate-900">좋은 프롬프트의 5요소</p>
            <ol className="space-y-2 text-sm leading-relaxed text-slate-600">
              <li>
                <span className="font-semibold text-slate-900">어디에</span> — 사진 속
                설치 위치
              </li>
              <li>
                <span className="font-semibold text-slate-900">무엇을</span> — 센서와
                액추에이터
              </li>
              <li>
                <span className="font-semibold text-slate-900">어떤 모양</span> — 크기와
                색
              </li>
              <li>
                <span className="font-semibold text-slate-900">어떻게 작동</span> — 그림
                속 장면
              </li>
              <li>
                <span className="font-semibold text-slate-900">지킬 것</span> — 배경
                유지, 사람 넣지 않기 (자동으로 들어가요)
              </li>
            </ol>
          </div>
        </aside>

        {/* 프롬프트 설계 */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 lg:col-span-8">
          <div className="border-b border-slate-100 pb-4">
            <p className="text-xs font-semibold text-emerald-800">
              2단계 · H 학생이 먼저
            </p>
            <h2 className="mt-1 text-lg font-bold text-slate-900 sm:text-xl">
              우리 모둠 조감도 프롬프트 설계
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              걷기 활동에서 찾은 문제와 우리가 설계한 알고리즘(센서 → 처리 → 액추에이터)을
              떠올리며 골라요. 원하는 보기가 없으면 「직접 쓰기」를 고르세요.
            </p>
          </div>

          {!cred || !data ? (
            <div className="mt-5 flex flex-col items-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center">
              <Lock className="h-5 w-5 text-slate-400" aria-hidden="true" />
              <p className="text-sm font-semibold text-slate-900">
                위에서 모둠 인증을 먼저 해 주세요
              </p>
              <p className="text-xs text-slate-500">
                인증하면 2차시 주제가 자동으로 채워져요.
              </p>
            </div>
          ) : (
            <div className="mt-5 space-y-5">
              {/* 2차시 주제·대표 사진 */}
              <div className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4 sm:grid-cols-5">
                <div className="sm:col-span-2">
                  {referencePhoto ? (
                    <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-white">
                      <img
                        src={referencePhoto}
                        alt="2차시 모둠 대표 사진"
                        referrerPolicy="no-referrer"
                        className="h-40 w-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => setEnlarged(true)}
                        className="absolute right-2 bottom-2 inline-flex min-h-[34px] items-center gap-1 rounded-md bg-slate-900/80 px-2.5 py-1 text-xs font-medium text-white hover:bg-slate-900"
                      >
                        <Maximize2 className="h-3 w-3" aria-hidden="true" />
                        <span>크게</span>
                      </button>
                    </div>
                  ) : (
                    <div className="flex h-40 flex-col items-center justify-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 text-center text-xs text-amber-900">
                      <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                      <span className="font-semibold">2차시 대표 사진이 없어요</span>
                      <span>선생님께 알려 주세요.</span>
                    </div>
                  )}
                </div>
                <div className="space-y-2 text-sm sm:col-span-3">
                  <p className="text-xs font-semibold text-slate-500">
                    AI가 바꿀 원본 사진 · 2차시 확정 주제
                  </p>
                  {topic ? (
                    <>
                      <p className="font-semibold leading-relaxed text-slate-900">
                        {topic.projectTitle}
                      </p>
                      <p className="text-xs text-slate-600">
                        <span className="font-semibold text-slate-700">공간:</span>{' '}
                        {topic.selectedLocation}
                      </p>
                      {(topic.controlConditionWhen || topic.controlConditionThen) && (
                        <p className="text-xs leading-relaxed text-slate-600">
                          <span className="font-semibold text-slate-700">제어 조건:</span>{' '}
                          {topic.controlConditionWhen} → {topic.controlConditionThen}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-xs leading-relaxed text-amber-900">
                      아직 2차시 모둠 주제가 제출되지 않았어요. 아래 칸을 직접 채워도
                      괜찮아요.
                    </p>
                  )}
                </div>
              </div>

              {/* 항목 */}
              <div className="grid gap-4 sm:grid-cols-2">
                {PROMPT_FIELDS.map((field) => {
                  const value = values[field.id] || '';
                  const isOwn = Boolean(ownModes[field.id]);
                  const inputId = `prompt-${field.id}`;
                  return (
                    <div
                      key={field.id}
                      className={`space-y-1.5 ${field.wide ? 'sm:col-span-2' : ''}`}
                    >
                      <label
                        htmlFor={inputId}
                        className="block text-sm font-semibold text-slate-900"
                      >
                        {field.label}{' '}
                        <span className="text-xs font-normal text-slate-500">
                          {field.help}
                        </span>
                      </label>
                      {field.options ? (
                        <>
                          <select
                            id={inputId}
                            value={isOwn ? OWN_OPTION : value}
                            onChange={(e) => handleSelect(field.id, e.target.value)}
                            className={`min-h-[46px] w-full rounded-lg border bg-white px-3 py-2.5 text-base focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 ${
                              value || isOwn
                                ? 'border-slate-300 text-slate-900'
                                : 'border-slate-300 text-slate-400'
                            }`}
                          >
                            <option value="">고르기</option>
                            {field.options.map((o) => (
                              <option key={o} value={o}>
                                {o}
                              </option>
                            ))}
                            <option value={OWN_OPTION}>{OWN_OPTION}</option>
                          </select>
                          {isOwn && (
                            <input
                              type="text"
                              value={value}
                              onChange={(e) => setValue(field.id, e.target.value)}
                              maxLength={OWN_MAX_LENGTH}
                              placeholder={`직접 써요 (${OWN_MAX_LENGTH}자까지)`}
                              aria-label={`${field.label} 직접 쓰기`}
                              className="min-h-[42px] w-full rounded-lg border border-emerald-300 bg-emerald-50/40 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20"
                            />
                          )}
                        </>
                      ) : (
                        <input
                          id={inputId}
                          type="text"
                          value={value}
                          onChange={(e) => setValue(field.id, e.target.value)}
                          maxLength={field.id === 'extra' ? 40 : 20}
                          placeholder={field.placeholder}
                          className="min-h-[46px] w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-base text-slate-900 placeholder:text-slate-400 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20"
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* 완성된 프롬프트 */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">완성된 프롬프트</p>
                  <div className="flex flex-wrap gap-1.5">
                    {checks.map((c) => (
                      <span
                        key={c.label}
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          c.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {c.ok ? (
                          <Check className="h-3 w-3" aria-hidden="true" />
                        ) : (
                          <X className="h-3 w-3" aria-hidden="true" />
                        )}
                        {c.label}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="whitespace-pre-wrap rounded-xl border-2 border-dashed border-emerald-300 bg-emerald-50/30 px-4 py-3.5 text-sm leading-relaxed text-slate-900">
                  {prompt}
                </div>
              </div>

              <div className="flex items-start gap-2.5 rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-xs leading-relaxed text-slate-700">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
                <p>
                  <span className="font-semibold text-slate-900">
                    모둠당 대표 1명이 제출해 주세요.
                  </span>{' '}
                  다시 제출하면 최신 내용으로 바뀌어요. 선생님은 이 문장과 우리 모둠 사진으로
                  조감도를 만들어요.
                </p>
              </div>

              {formError && (
                <div
                  role="alert"
                  className="rounded-lg border border-rose-200 bg-rose-50 p-3.5 text-xs font-medium leading-relaxed text-rose-900"
                >
                  {formError}
                </div>
              )}

              {justSubmitted && (
                <div
                  role="status"
                  className="flex flex-col gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-start gap-2.5">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
                    <p className="leading-relaxed">
                      <span className="font-semibold">선생님께 제출했어요!</span> 다음
                      시간(6차시)까지 선생님이 조감도를 만들어 올려 줄 거예요.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onGoToLesson6}
                    className="inline-flex min-h-[40px] items-center justify-center gap-1.5 self-start rounded-lg border border-emerald-700/40 bg-white px-3.5 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 whitespace-nowrap sm:self-auto"
                  >
                    <span>6차시 화면 미리 보기</span>
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              )}

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-slate-500">
                  {submittedAt
                    ? `마지막 제출: ${formatDateTime(submittedAt)}`
                    : '아직 제출하지 않았어요.'}
                </p>
                <button
                  type="button"
                  onClick={() => void handleSubmit()}
                  disabled={isSubmitting}
                  className={`inline-flex min-h-[50px] items-center justify-center gap-2 rounded-xl px-6 py-3 text-base font-semibold text-white transition-colors disabled:opacity-60 ${
                    allChecked ? 'bg-emerald-700 hover:bg-emerald-800' : 'bg-slate-400 hover:bg-slate-500'
                  }`}
                >
                  <Send className="h-4 w-4" aria-hidden="true" />
                  <span>
                    {isSubmitting
                      ? '제출 중...'
                      : submittedAt
                        ? '수정한 프롬프트 다시 제출하기'
                        : '선생님께 프롬프트 제출하기'}
                  </span>
                </button>
              </div>
            </div>
          )}
        </section>
      </div>

      {enlarged && referencePhoto && (
        <ImageModal
          src={referencePhoto}
          title={`${cred?.classRoom} · ${cred?.groupName} · 2차시 대표 사진`}
          onClose={() => setEnlarged(false)}
        />
      )}
    </div>
  );
};
