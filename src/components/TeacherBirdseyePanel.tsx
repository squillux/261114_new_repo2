import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Image as ImageIcon,
  Info,
  Maximize2,
  MonitorPlay,
  RefreshCw,
  Star,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { compressImageFile } from '../lib/imageUtils';
import {
  deleteTeacherBirdseyeImage,
  fetchTeacherBirdseyeImage,
  fetchTeacherBirdseyeOverview,
  fetchTeacherReferencePhoto,
  setTeacherFinalVersion,
  uploadTeacherBirdseyeImage,
  type TeacherBirdseyeGroup,
} from '../lib/birdseyeApi';
import { EVAL_ITEMS, aiImageLabel, formatDateTime } from '../lib/birdseyeContent';
import { CopyButton, ImageModal } from './BirdseyeShared';

const REFRESH_MS = 15_000;

type ImageLoader = (
  classRoom: string,
  groupName: string,
  version: number | 'reference'
) => Promise<string>;

const groupKey = (g: { classRoom: string; groupName: string }) =>
  `${g.classRoom}::${g.groupName}`;

const sortGroups = (a: TeacherBirdseyeGroup, b: TeacherBirdseyeGroup) =>
  a.classRoom.localeCompare(b.classRoom, 'ko', { numeric: true }) ||
  a.groupName.localeCompare(b.groupName, 'ko', { numeric: true });

function hasNewFixRequest(g: TeacherBirdseyeGroup): boolean {
  if (!g.reviewSavedAt || !g.review?.fixText) return false;
  const latest = g.versions[g.versions.length - 1]?.createdAt || '';
  return g.reviewSavedAt > latest;
}

function statusOf(g: TeacherBirdseyeGroup): { text: string; tone: string } {
  if (hasNewFixRequest(g)) {
    return { text: '새 수정 요청', tone: 'bg-amber-100 text-amber-900' };
  }
  if (g.versions.length > 0) {
    return {
      text: `${g.finalVersion}차 최종 · ${g.versions.length}개 업로드`,
      tone: 'bg-emerald-100 text-emerald-800',
    };
  }
  if (g.promptText) return { text: '생성 대기', tone: 'bg-sky-100 text-sky-900' };
  return { text: '프롬프트 미제출', tone: 'bg-slate-100 text-slate-600' };
}

export const TeacherBirdseyePanel: React.FC = () => {
  const [groups, setGroups] = useState<TeacherBirdseyeGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatedAt, setUpdatedAt] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [presenting, setPresenting] = useState<number | null>(null);
  const cache = useRef(new Map<string, string>());
  const inflight = useRef(new Map<string, Promise<string>>());

  const refresh = useCallback(async () => {
    const res = await fetchTeacherBirdseyeOverview();
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setError('');
    setGroups([...res.groups].sort(sortGroups));
    setUpdatedAt(new Date().toISOString());
  }, []);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => {
      if (!document.hidden) void refresh();
    }, REFRESH_MS);
    return () => window.clearInterval(id);
  }, [refresh]);

  const classes = useMemo(
    () =>
      Array.from(new Set(groups.map((g) => g.classRoom))).sort((a, b) =>
        a.localeCompare(b, 'ko', { numeric: true })
      ),
    [groups]
  );

  useEffect(() => {
    if (classes.length === 0) return;
    if (!classFilter || !classes.includes(classFilter)) {
      const withActivity = groups.find((g) => g.promptText || g.versions.length);
      setClassFilter(withActivity?.classRoom || classes[0]);
    }
  }, [classes, classFilter, groups]);

  const visible = groups.filter((g) => g.classRoom === classFilter);
  const presentable = visible.filter((g) => g.finalVersion !== null);

  const loadImage: ImageLoader = useCallback(async (classRoom, groupName, version) => {
    const key = `${classRoom}::${groupName}::${version}`;
    const cached = cache.current.get(key);
    if (cached !== undefined) return cached;
    const pending = inflight.current.get(key);
    if (pending) return pending;
    const job = (async () => {
      const res =
        version === 'reference'
          ? await fetchTeacherReferencePhoto(classRoom, groupName)
          : await fetchTeacherBirdseyeImage(classRoom, groupName, version);
      const src = res.ok ? res.dataUrl : '';
      if (res.ok) cache.current.set(key, src);
      inflight.current.delete(key);
      return src;
    })();
    inflight.current.set(key, job);
    return job;
  }, []);

  const forgetImage = (g: TeacherBirdseyeGroup, version: number) =>
    cache.current.delete(`${g.classRoom}::${g.groupName}::${version}`);

  const stats = {
    total: visible.length,
    prompts: visible.filter((g) => g.promptText).length,
    uploaded: visible.filter((g) => g.versions.length > 0).length,
    newFix: visible.filter(hasNewFixRequest).length,
  };

  return (
    <div className="space-y-4">
      {/* 사용 안내 */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Info className="h-4 w-4 text-emerald-700" aria-hidden="true" />
          <span>가상 조감도 진행 방법</span>
        </div>
        <div className="grid gap-3 text-sm leading-relaxed text-slate-600 md:grid-cols-2">
          <div className="rounded-lg bg-slate-50 p-3.5">
            <p className="font-semibold text-slate-900">7차시 → 8차시 사이</p>
            <p className="mt-1">
              ① 원본 사진 내려받기 → ② 프롬프트 복사 → ③ Gemini 등에 사진과 함께 붙여 넣어
              생성 → ④ 결과를 「조감도 올리기」. 모둠마다 Gemini 대화창을 따로 열어 두면 8차시
              수정이 편해요.
            </p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3.5">
            <p className="font-semibold text-slate-900">8차시 수업 중</p>
            <p className="mt-1">
              「새 수정 요청」 모둠의 수정 요청을 복사해 같은 대화창에 붙여 넣고, 결과를 다시
              올리면 학생 화면에 10초 안에 최종본으로 바뀌어요.
            </p>
          </div>
        </div>
      </section>

      {/* 학급 선택 + 요약 */}
      <section className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="birdseye-class-filter" className="text-sm font-semibold text-slate-900">
            학급
          </label>
          <select
            id="birdseye-class-filter"
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="min-h-[42px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-700 focus:outline-none"
          >
            {classes.length === 0 && <option value="">학급 없음</option>}
            {classes.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <span className="text-xs text-slate-600 tabular-nums">
            프롬프트 {stats.prompts}/{stats.total} · 조감도 {stats.uploaded}/{stats.total}
          </span>
          {stats.newFix > 0 && (
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-900 tabular-nums">
              새 수정 요청 {stats.newFix}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500">
            {updatedAt ? `${formatDateTime(updatedAt)} 갱신 · 15초마다 자동` : ''}
          </span>
          <button
            type="button"
            onClick={() => void refresh()}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>새로고침</span>
          </button>
          <button
            type="button"
            onClick={() => setPresenting(0)}
            disabled={presentable.length === 0}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50 whitespace-nowrap"
          >
            <MonitorPlay className="h-3.5 w-3.5" aria-hidden="true" />
            <span>발표 모드</span>
          </button>
        </div>
      </section>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-rose-200 bg-rose-50 p-3.5 text-xs font-medium text-rose-900"
        >
          {error}
        </div>
      )}

      {loading ? (
        <p className="rounded-xl border border-slate-200 bg-white px-5 py-10 text-center text-sm text-slate-500">
          불러오는 중...
        </p>
      ) : visible.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-10 text-center text-sm text-slate-600">
          <p className="font-semibold text-slate-900">아직 표시할 모둠이 없어요</p>
          <p className="mt-1 text-xs text-slate-500">
            모둠 인증코드를 만들거나 3~4차시 주제가 제출되면 여기에 모둠이 나타나요.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {visible.map((g) => (
            <GroupCard
              key={groupKey(g)}
              group={g}
              loadImage={loadImage}
              onChanged={refresh}
              forgetImage={forgetImage}
            />
          ))}
        </div>
      )}

      {presenting !== null && presentable.length > 0 && (
        <PresentationMode
          groups={presentable}
          index={Math.min(presenting, presentable.length - 1)}
          onIndex={setPresenting}
          loadImage={loadImage}
          onClose={() => setPresenting(null)}
        />
      )}
    </div>
  );
};

/* ---------- 모둠 카드 ---------- */

const GroupCard: React.FC<{
  group: TeacherBirdseyeGroup;
  loadImage: ImageLoader;
  onChanged: () => Promise<void>;
  forgetImage: (g: TeacherBirdseyeGroup, version: number) => void;
}> = ({ group: g, loadImage, onChanged, forgetImage }) => {
  const [reference, setReference] = useState('');
  const [selected, setSelected] = useState<number | null>(g.finalVersion);
  const [selectedSrc, setSelectedSrc] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [modal, setModal] = useState<{ src: string; title: string } | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const status = statusOf(g);
  const newFix = hasNewFixRequest(g);
  const nextVersion = (g.versions[g.versions.length - 1]?.version || 0) + 1;

  useEffect(() => {
    if (!g.hasReferencePhoto) return;
    let alive = true;
    void loadImage(g.classRoom, g.groupName, 'reference').then((src) => alive && setReference(src));
    return () => {
      alive = false;
    };
  }, [g.classRoom, g.groupName, g.hasReferencePhoto, loadImage]);

  // 최종본이 바뀌면 선택도 따라감
  useEffect(() => {
    setSelected(g.finalVersion);
    setConfirmDelete(false);
  }, [g.finalVersion, g.versions.length]);

  useEffect(() => {
    if (selected === null) {
      setSelectedSrc('');
      return;
    }
    let alive = true;
    void loadImage(g.classRoom, g.groupName, selected).then((src) => alive && setSelectedSrc(src));
    return () => {
      alive = false;
    };
  }, [g.classRoom, g.groupName, selected, loadImage]);

  const handleUpload = async (file: File | undefined) => {
    if (!file) return;
    setError('');
    setBusy('upload');
    try {
      const compressed = await compressImageFile(file, 1600, 0.85);
      const res = await uploadTeacherBirdseyeImage(g.classRoom, g.groupName, compressed.dataUrl);
      if (!res.ok) setError(res.error);
      else await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : '이미지를 올리지 못했습니다.');
    } finally {
      setBusy('');
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleMakeFinal = async () => {
    if (selected === null) return;
    setBusy('final');
    const res = await setTeacherFinalVersion(g.classRoom, g.groupName, selected);
    setBusy('');
    if (!res.ok) setError(res.error);
    else await onChanged();
  };

  const handleDelete = async () => {
    if (selected === null) return;
    setBusy('delete');
    const res = await deleteTeacherBirdseyeImage(g.classRoom, g.groupName, selected);
    setBusy('');
    setConfirmDelete(false);
    if (!res.ok) setError(res.error);
    else {
      forgetImage(g, selected);
      await onChanged();
    }
  };

  const review = g.review;
  const uncheckedCount = review ? EVAL_ITEMS.length - review.checks.length : 0;

  return (
    <article
      className={`flex flex-col rounded-xl border bg-white p-4 sm:p-5 space-y-4 ${
        newFix ? 'border-amber-300 ring-1 ring-amber-200' : 'border-slate-200'
      }`}
    >
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-base font-bold text-slate-900">
            {g.classRoom} · {g.groupName}
          </p>
          <p className="mt-0.5 text-sm leading-relaxed text-slate-600">
            {g.projectTitle || '3~4차시 주제 미제출'}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${status.tone}`}>
          {status.text}
        </span>
      </header>

      {/* 원본 · 조감도 */}
      <div className="grid grid-cols-2 gap-3">
        <figure className="space-y-1.5">
          <figcaption className="text-xs font-semibold text-slate-500">원본 사진</figcaption>
          <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
            {reference ? (
              <>
                <img
                  src={reference}
                  alt={`${g.groupName} 원본 사진`}
                  className="aspect-[4/3] w-full cursor-zoom-in object-cover"
                  onClick={() => setModal({ src: reference, title: `${g.classRoom} · ${g.groupName} · 원본 사진` })}
                />
                <a
                  href={reference}
                  download={`${g.classRoom}_${g.groupName}_원본.jpg`}
                  className="absolute right-1.5 bottom-1.5 inline-flex min-h-[32px] items-center gap-1 rounded-md bg-slate-900/80 px-2 py-1 text-[11px] font-medium text-white hover:bg-slate-900"
                >
                  <Download className="h-3 w-3" aria-hidden="true" />
                  내려받기
                </a>
              </>
            ) : (
              <div className="flex aspect-[4/3] items-center justify-center px-2 text-center text-xs text-slate-400">
                {g.hasReferencePhoto ? '불러오는 중…' : '대표 사진 없음'}
              </div>
            )}
          </div>
        </figure>

        <figure className="space-y-1.5">
          <figcaption className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>{selected ? `${selected}차 조감도` : 'AI 조감도'}</span>
            {selected !== null && selected === g.finalVersion && (
              <span className="inline-flex items-center gap-0.5 text-emerald-700">
                <Star className="h-3 w-3 fill-current" aria-hidden="true" />
                최종
              </span>
            )}
          </figcaption>
          <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
            {selectedSrc ? (
              <>
                <img
                  src={selectedSrc}
                  alt={`${g.groupName} ${selected}차 조감도`}
                  className="aspect-[4/3] w-full cursor-zoom-in object-cover"
                  onClick={() =>
                    setModal({ src: selectedSrc, title: `${g.classRoom} · ${g.groupName} · ${selected}차 조감도` })
                  }
                />
                <button
                  type="button"
                  onClick={() =>
                    setModal({ src: selectedSrc, title: `${g.classRoom} · ${g.groupName} · ${selected}차 조감도` })
                  }
                  className="absolute right-1.5 bottom-1.5 inline-flex min-h-[32px] items-center gap-1 rounded-md bg-slate-900/80 px-2 py-1 text-[11px] font-medium text-white hover:bg-slate-900"
                >
                  <Maximize2 className="h-3 w-3" aria-hidden="true" />
                  크게
                </button>
              </>
            ) : (
              <div className="flex aspect-[4/3] flex-col items-center justify-center gap-1 text-xs text-slate-400">
                <ImageIcon className="h-5 w-5" aria-hidden="true" />
                {selected !== null ? '불러오는 중…' : '아직 없음'}
              </div>
            )}
          </div>
        </figure>
      </div>

      {/* 버전 선택 + 업로드 */}
      <div className="flex flex-wrap items-center gap-2">
        {g.versions.map((v) => (
          <button
            key={v.version}
            type="button"
            onClick={() => {
              setSelected(v.version);
              setConfirmDelete(false);
            }}
            title={formatDateTime(v.createdAt)}
            className={`inline-flex min-h-[36px] items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold tabular-nums ${
              selected === v.version
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            {v.version}차
            {v.version === g.finalVersion && <Star className="h-3 w-3 fill-current" aria-hidden="true" />}
          </button>
        ))}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => void handleUpload(e.target.files?.[0])}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy === 'upload'}
          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-60 whitespace-nowrap"
        >
          <Upload className="h-3.5 w-3.5" aria-hidden="true" />
          {busy === 'upload' ? '올리는 중…' : `조감도 올리기 (${nextVersion}차)`}
        </button>
      </div>

      {selected !== null && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {selected !== g.finalVersion && (
            <button
              type="button"
              onClick={() => void handleMakeFinal()}
              disabled={busy === 'final'}
              className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-emerald-700/40 bg-white px-2.5 py-1 font-semibold text-emerald-800 hover:bg-emerald-50 disabled:opacity-60"
            >
              <Star className="h-3.5 w-3.5" aria-hidden="true" />
              {selected}차를 최종본으로
            </button>
          )}
          {confirmDelete ? (
            <span className="inline-flex flex-wrap items-center gap-1.5 rounded-lg bg-rose-50 px-2.5 py-1 text-rose-900">
              {selected}차를 삭제할까요?
              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={busy === 'delete'}
                className="rounded-md bg-rose-600 px-2 py-0.5 font-semibold text-white hover:bg-rose-700"
              >
                삭제
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="rounded-md px-2 py-0.5 font-semibold text-rose-900 hover:bg-rose-100"
              >
                취소
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 font-semibold text-slate-600 hover:bg-rose-50 hover:text-rose-700"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              {selected}차 삭제
            </button>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-900">
          {error}
        </p>
      )}

      {/* 7차시 프롬프트 */}
      <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3.5 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold text-slate-700">
            7차시 프롬프트
            {g.promptSubmittedAt && (
              <span className="ml-1.5 font-normal text-slate-500">
                {formatDateTime(g.promptSubmittedAt)}
              </span>
            )}
          </p>
          {g.promptText && (
            <CopyButton
              text={g.promptText}
              label="프롬프트 복사"
              icon={<Copy className="h-3.5 w-3.5" aria-hidden="true" />}
            />
          )}
        </div>
        {g.promptText ? (
          <>
            <p
              className={`whitespace-pre-wrap text-xs leading-relaxed text-slate-800 ${
                showPrompt ? '' : 'line-clamp-3'
              }`}
            >
              {g.promptText}
            </p>
            <button
              type="button"
              onClick={() => setShowPrompt((p) => !p)}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800"
            >
              {showPrompt ? '접기' : '전체 보기'}
            </button>
          </>
        ) : (
          <p className="text-xs text-slate-500">아직 제출하지 않았어요.</p>
        )}
      </div>

      {/* 8차시 수정 요청 */}
      {review && (
        <div
          className={`rounded-lg border p-3.5 space-y-2 ${
            newFix ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold text-slate-700">
              8차시 학생 판단
              <span className="ml-1.5 font-normal text-slate-500">
                {review.basedOnVersion ? `${review.basedOnVersion}차 기준 · ` : ''}
                {formatDateTime(g.reviewSavedAt)}
              </span>
            </p>
            {review.fixText && (
              <CopyButton
                text={review.fixText}
                label="수정 요청 복사"
                icon={<Copy className="h-3.5 w-3.5" aria-hidden="true" />}
              />
            )}
          </div>
          <p className="text-xs text-slate-600 tabular-nums">
            평가표 {review.checks.length}/{EVAL_ITEMS.length} 만족
            {uncheckedCount > 0 ? ` · ${uncheckedCount}개 수정 필요` : ''}
          </p>
          {review.fixText ? (
            <p className="whitespace-pre-wrap text-xs leading-relaxed text-slate-800">
              {review.fixText}
            </p>
          ) : (
            <p className="text-xs font-semibold text-emerald-800">
              모든 항목 만족 — 수정 요청 없음
            </p>
          )}
          {review.reflection && (
            <p className="border-t border-slate-200 pt-2 text-xs leading-relaxed text-slate-700">
              <span className="font-semibold">한 줄 성찰:</span> {review.reflection}
            </p>
          )}
        </div>
      )}

      {modal && <ImageModal src={modal.src} title={modal.title} onClose={() => setModal(null)} />}
    </article>
  );
};

/* ---------- 발표 모드 ---------- */

const PresentationMode: React.FC<{
  groups: TeacherBirdseyeGroup[];
  index: number;
  onIndex: (i: number) => void;
  loadImage: ImageLoader;
  onClose: () => void;
}> = ({ groups, index, onIndex, loadImage, onClose }) => {
  const g = groups[index];
  const [src, setSrc] = useState('');

  useEffect(() => {
    let alive = true;
    setSrc('');
    if (g.finalVersion !== null) {
      void loadImage(g.classRoom, g.groupName, g.finalVersion).then((s) => alive && setSrc(s));
    }
    return () => {
      alive = false;
    };
  }, [g.classRoom, g.groupName, g.finalVersion, loadImage]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') onIndex(Math.min(index + 1, groups.length - 1));
      if (e.key === 'ArrowLeft') onIndex(Math.max(index - 1, 0));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, groups.length, onIndex, onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="가상 조감도 발표 모드"
      className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-white"
    >
      <div className="flex items-center justify-between gap-4 px-5 py-4 sm:px-8">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-emerald-300">
            {g.classRoom} · {g.groupName} · {g.finalVersion}차 최종
          </p>
          <p className="truncate text-lg font-bold sm:text-2xl">
            {g.projectTitle || '우리 모둠 가상 조감도'}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
        >
          <X className="h-4 w-4" aria-hidden="true" />
          닫기
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-4">
        {src ? (
          <img src={src} alt={`${g.groupName} 최종 조감도`} className="max-h-full max-w-full object-contain" />
        ) : (
          <p className="text-sm text-slate-400">불러오는 중…</p>
        )}
        <button
          type="button"
          onClick={() => onIndex(Math.max(index - 1, 0))}
          disabled={index === 0}
          aria-label="이전 모둠"
          className="absolute left-3 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30"
        >
          <ChevronLeft className="h-6 w-6" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => onIndex(Math.min(index + 1, groups.length - 1))}
          disabled={index === groups.length - 1}
          aria-label="다음 모둠"
          className="absolute right-3 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30"
        >
          <ChevronRight className="h-6 w-6" aria-hidden="true" />
        </button>
      </div>

      <div className="flex flex-col gap-1 px-5 py-4 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <span>{aiImageLabel(`${g.groupName} 기기`)}</span>
        <span className="tabular-nums">
          {index + 1} / {groups.length} · ← → 키로 넘기기
        </span>
      </div>
    </div>
  );
};
