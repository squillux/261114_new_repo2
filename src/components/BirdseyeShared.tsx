import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, KeyRound, Lock, Unlock, X } from 'lucide-react';
import { CLASS_ROOM_PRESETS, GROUP_NAME_PRESETS } from '../types/observation';
import {
  fetchStudentBirdseye,
  loadSavedCredential,
  saveCredential,
  type GroupCredential,
  type StudentBirdseyeData,
} from '../lib/birdseyeApi';

/* ---------- 차시 진행 순서 ---------- */

export interface FlowStep {
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' }>;
  title: string;
  description: string;
  highlight?: boolean;
}

export const LessonFlowSection: React.FC<{
  id: string;
  title: string;
  steps: FlowStep[];
}> = ({ id, title, steps }) => {
  const [expanded, setExpanded] = useState(false);
  return (
    <section
      aria-labelledby={id}
      className="rounded-xl border border-slate-200 bg-white p-5 space-y-4"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id={id} className="text-base font-semibold text-slate-900">
          {title}
        </h2>
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          aria-expanded={expanded}
          className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 md:hidden whitespace-nowrap"
        >
          <span>{expanded ? '접기' : '순서 보기'}</span>
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </button>
      </div>
      <ol
        className={`${expanded ? 'grid' : 'hidden'} md:grid gap-4 text-sm text-slate-700 ${
          steps.length >= 4 ? 'md:grid-cols-2 lg:grid-cols-4' : 'md:grid-cols-3'
        }`}
      >
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <li key={step.title} className="flex items-start gap-3">
              <span
                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-semibold tabular-nums ${
                  step.highlight
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                {index + 1}
              </span>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-slate-900">
                  <Icon
                    className={`h-4 w-4 shrink-0 ${
                      step.highlight ? 'text-emerald-700' : 'text-slate-500'
                    }`}
                    aria-hidden="true"
                  />
                  <span>{step.title}</span>
                </div>
                <p className="leading-relaxed text-slate-600">{step.description}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
};

/* ---------- 모둠 인증 카드 (2차시와 같은 방식) ---------- */

interface GroupAuthCardProps {
  stepLabel: string;
  title: string;
  submitLabel: string;
  helpText: string;
  verified: { classRoom: string; groupName: string } | null;
  verifiedSummary?: React.ReactNode;
  onVerified: (data: StudentBirdseyeData, cred: GroupCredential) => void;
  onSignOut: () => void;
}

export const GroupAuthCard: React.FC<GroupAuthCardProps> = ({
  stepLabel,
  title,
  submitLabel,
  helpText,
  verified,
  verifiedSummary,
  onVerified,
  onSignOut,
}) => {
  const [classPreset, setClassPreset] = useState('1반');
  const [classRoom, setClassRoom] = useState('1반');
  const [groupPreset, setGroupPreset] = useState('1모둠');
  const [groupName, setGroupName] = useState('1모둠');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const triedSaved = useRef(false);

  const verify = async (cred: GroupCredential, silent = false) => {
    setBusy(true);
    setError('');
    const res = await fetchStudentBirdseye(cred);
    setBusy(false);
    if (!res.ok) {
      if (silent) {
        if (res.status === 401 || res.status === 404) saveCredential(null);
        return;
      }
      setError(res.error);
      return;
    }
    saveCredential(cred);
    setCode('');
    onVerified(res, cred);
  };

  // 같은 수업 시간에 다시 들어오면 인증코드를 다시 묻지 않음
  useEffect(() => {
    if (triedSaved.current || verified) return;
    triedSaved.current = true;
    const saved = loadSavedCredential();
    if (saved) void verify(saved, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!classRoom.trim()) return setError('학급(반)을 선택하거나 입력해 주세요.');
    if (!groupName.trim()) return setError('모둠을 선택하거나 입력해 주세요.');
    if (!code.trim()) return setError('선생님께 받은 모둠 인증코드를 입력해 주세요.');
    void verify({
      classRoom: classRoom.trim(),
      groupName: groupName.trim(),
      code: code.trim(),
    });
  };

  return (
    <section
      aria-labelledby="birdseye-auth-title"
      className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 space-y-5"
    >
      <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold text-emerald-800">{stepLabel}</p>
          <h2
            id="birdseye-auth-title"
            className="mt-1 text-lg font-bold text-slate-900 sm:text-xl"
          >
            {title}
          </h2>
        </div>
        {verified && (
          <button
            type="button"
            onClick={() => {
              saveCredential(null);
              onSignOut();
            }}
            className="inline-flex min-h-[42px] items-center justify-center gap-1.5 self-start rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap sm:self-auto"
          >
            <Lock className="h-3.5 w-3.5" aria-hidden="true" />
            <span>다른 모둠으로 전환</span>
          </button>
        )}
      </div>

      {verified ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-950">
          <div className="flex flex-wrap items-center gap-2">
            <Check className="h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
            <span className="font-semibold">
              {verified.classRoom} · {verified.groupName} 인증됨
            </span>
          </div>
          {verifiedSummary && (
            <span className="text-xs text-emerald-900">{verifiedSummary}</span>
          )}
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-12">
            <div className="space-y-1.5 sm:col-span-4">
              <label
                htmlFor="birdseye-class"
                className="block text-sm font-semibold text-slate-900"
              >
                1. 학급 (반) 선택
              </label>
              <select
                id="birdseye-class"
                value={classPreset}
                onChange={(e) => {
                  setClassPreset(e.target.value);
                  setClassRoom(e.target.value === '직접 입력' ? '' : e.target.value);
                  setError('');
                }}
                className="min-h-[46px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20"
              >
                {CLASS_ROOM_PRESETS.map((room) => (
                  <option key={room} value={room}>
                    {room}
                  </option>
                ))}
              </select>
              {classPreset === '직접 입력' && (
                <input
                  type="text"
                  value={classRoom}
                  onChange={(e) => {
                    setClassRoom(e.target.value);
                    setError('');
                  }}
                  placeholder="예: 13반"
                  aria-label="학급 직접 입력"
                  maxLength={20}
                  className="mt-1.5 min-h-[42px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-700 focus:outline-none"
                />
              )}
            </div>

            <div className="space-y-2 sm:col-span-8">
              <p className="text-sm font-semibold text-slate-900">2. 우리 모둠 선택</p>
              <div className="flex flex-wrap gap-2">
                {GROUP_NAME_PRESETS.map((preset) => {
                  const selected = groupPreset === preset;
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        setGroupPreset(preset);
                        setGroupName(preset === '직접 입력' ? '' : preset);
                        setError('');
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
              {groupPreset === '직접 입력' && (
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => {
                    setGroupName(e.target.value);
                    setError('');
                  }}
                  placeholder="예: 10모둠"
                  aria-label="모둠 이름 직접 입력"
                  maxLength={30}
                  className="min-h-[46px] w-full max-w-xs rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-base text-slate-900 placeholder:text-slate-400 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20"
                />
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 max-w-sm space-y-1.5">
              <label
                htmlFor="birdseye-code"
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
                  id="birdseye-code"
                  type="text"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value);
                    setError('');
                  }}
                  placeholder="선생님이 안내한 코드 입력"
                  maxLength={24}
                  autoComplete="off"
                  className="min-h-[46px] w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3.5 py-2.5 font-mono text-base text-slate-900 placeholder:font-sans placeholder:text-slate-400 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-800 disabled:opacity-60 shrink-0"
            >
              <Unlock className="h-4 w-4" aria-hidden="true" />
              <span>{busy ? '확인 중...' : submitLabel}</span>
            </button>
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-lg border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-900"
            >
              <p className="font-medium leading-relaxed">{error}</p>
            </div>
          )}

          <p className="text-xs leading-relaxed text-slate-500">{helpText}</p>
        </form>
      )}
    </section>
  );
};

/* ---------- 사진 크게 보기 ---------- */

export const ImageModal: React.FC<{
  src: string;
  title: string;
  caption?: string;
  onClose: () => void;
}> = ({ src, title, caption, onClose }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-4xl overflow-hidden rounded-xl bg-white shadow-xl"
      >
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-4 py-3">
          <p className="truncate text-sm font-semibold text-slate-900">{title}</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="bg-slate-900 p-2">
          <img
            src={src}
            alt={title}
            referrerPolicy="no-referrer"
            className="mx-auto max-h-[75vh] w-full object-contain"
          />
        </div>
        {caption && (
          <p className="border-t border-slate-200 px-4 py-2.5 text-xs text-slate-600">
            {caption}
          </p>
        )}
      </div>
    </div>
  );
};

/* ---------- 복사 버튼 ---------- */

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const t = document.createElement('textarea');
    t.value = text;
    document.body.appendChild(t);
    t.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    t.remove();
    return ok;
  }
}

export const CopyButton: React.FC<{
  text: string;
  label: string;
  className?: string;
  icon?: React.ReactNode;
}> = ({ text, label, className, icon }) => {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        if (await copyText(text)) {
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        }
      }}
      disabled={!text}
      className={
        className ??
        'inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap'
      }
    >
      {done ? <Check className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" /> : icon}
      <span>{done ? '복사했어요' : label}</span>
    </button>
  );
};
