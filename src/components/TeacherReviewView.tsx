import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Clock,
  Copy,
  Eye,
  EyeOff,
  FileText,
  Image as ImageIcon,
  KeyRound,
  Lock,
  LogOut,
  Maximize2,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  User,
  Users,
  X,
} from 'lucide-react';
import {
  CLASS_ROOM_PRESETS,
  GROUP_NAME_PRESETS,
  type GroupAuthCode,
  type GroupTopicRecord,
  type ObservationRecord,
  type StorageConnectionStatus,
} from '../types/observation';
import {
  saveBulkGroupCodes,
  saveGroupCode,
  type ApiSaveBulkCodesResult,
  type ApiSaveCodeResult,
  type ApiTeacherLoginResult,
} from '../lib/observationApi';
import { StorageStatusNotice } from './StorageStatusNotice';

export type TeacherStageTab = 'lesson1' | 'lesson2' | 'codes';

interface TeacherReviewViewProps {
  observations: ObservationRecord[];
  topics: GroupTopicRecord[];
  groupCodes: GroupAuthCode[];
  initialTab?: TeacherStageTab;
  storageStatus: StorageConnectionStatus;
  statusDetail?: string;
  isCheckingStorage: boolean;
  isTeacherAuthenticated: boolean;
  isTeacherAuthConfigured: boolean;
  isRefreshingData: boolean;
  availableClassesFromServer?: string[];
  photosDeferred?: boolean;
  totalObservationCount?: number;
  selectedServerClassFilter?: string;
  onClassFilterServerChange?: (classRoom: string) => Promise<void>;
  onLoadObservationPhoto?: (id: string) => Promise<void>;
  onTeacherLogin: (password: string) => Promise<ApiTeacherLoginResult>;
  onTeacherLogout: () => Promise<void>;
  onRefreshData: () => Promise<void>;
  onRetryConnection: () => void;
  onClearPreviewRecords: () => void;
  onDeleteObservation: (id: string) => void;
  onDeleteTopic: (id: string) => void;
  onGroupCodeSaved: (result: ApiSaveCodeResult) => void;
  onBulkGroupCodesSaved: (result: ApiSaveBulkCodesResult) => void;
  onDeleteGroupCode: (classRoom: string, groupName: string) => void;
  onGoToLesson1: () => void;
  onGoToLesson2: () => void;
}

type Lesson1DisplayMode = 'by-group' | 'by-individual';

interface GroupBucket {
  key: string;
  classRoom: string;
  groupName: string;
  items: ObservationRecord[];
}

export const TeacherReviewView: React.FC<TeacherReviewViewProps> = ({
  observations,
  topics,
  groupCodes,
  initialTab = 'lesson1',
  storageStatus,
  statusDetail,
  isCheckingStorage,
  isTeacherAuthenticated,
  isTeacherAuthConfigured,
  isRefreshingData,
  availableClassesFromServer = [],
  photosDeferred = false,
  totalObservationCount,
  selectedServerClassFilter = 'all',
  onClassFilterServerChange,
  onLoadObservationPhoto,
  onTeacherLogin,
  onTeacherLogout,
  onRefreshData,
  onRetryConnection,
  onClearPreviewRecords,
  onDeleteObservation,
  onDeleteTopic,
  onGroupCodeSaved,
  onBulkGroupCodesSaved,
  onDeleteGroupCode,
  onGoToLesson1,
  onGoToLesson2,
}) => {
  const [stageTab, setStageTab] = useState<TeacherStageTab>(initialTab);
  const [teacherPassword, setTeacherPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [displayMode, setDisplayMode] =
    useState<Lesson1DisplayMode>('by-group');
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>(
    selectedServerClassFilter || 'all'
  );
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>('all');
  const [locationFilter, setLocationFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showGroupCodesInLesson1, setShowGroupCodesInLesson1] = useState(false);
  const [loadingPhotoId, setLoadingPhotoId] = useState<string | null>(null);
  const [confirmDeleteObsId, setConfirmDeleteObsId] = useState<string | null>(
    null
  );
  const [confirmDeleteTopicId, setConfirmDeleteTopicId] = useState<
    string | null
  >(null);
  const [confirmDeleteCodeKey, setConfirmDeleteCodeKey] = useState<
    string | null
  >(null);
  const [enlargedPhoto, setEnlargedPhoto] = useState<{
    src: string;
    title: string;
  } | null>(null);

  // 모둠 인증코드 관리 상태
  const [codeClassPreset, setCodeClassPreset] = useState<string>('1학년 1반');
  const [codeClassRoom, setCodeClassRoom] = useState<string>('1학년 1반');
  const [codeGroupPreset, setCodeGroupPreset] = useState<string>('1모둠');
  const [codeGroupName, setCodeGroupName] = useState<string>('1모둠');
  const [codeValue, setCodeValue] = useState<string>('');
  const [codeFormError, setCodeFormError] = useState<string>('');
  const [isSavingCode, setIsSavingCode] = useState(false);
  const [isBulkGenerating, setIsBulkGenerating] = useState(false);
  const [confirmBulkOverwriteClass, setConfirmBulkOverwriteClass] = useState<
    string | null
  >(null);
  const [codeListClassFilter, setCodeListClassFilter] = useState<string>('all');
  const [copiedCodesNotice, setCopiedCodesNotice] = useState<string>('');
  const [codeSaveFeedback, setCodeSaveFeedback] = useState<{
    savedToServer: boolean;
    failed: boolean;
    status: StorageConnectionStatus;
    message: string;
  } | null>(null);

  const availableClasses = useMemo(() => {
    const set = new Set<string>();
    availableClassesFromServer.forEach((cls) => {
      const c = cls?.trim();
      if (c) set.add(c);
    });
    observations.forEach((o) => {
      const c = o.classRoom?.trim();
      if (c) set.add(c);
    });
    topics.forEach((t) => {
      const c = t.classRoom?.trim();
      if (c) set.add(c);
    });
    groupCodes.forEach((g) => {
      const c = g.classRoom?.trim();
      if (c) set.add(c);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ko'));
  }, [availableClassesFromServer, observations, topics, groupCodes]);

  const availableGroupNames = useMemo(() => {
    const map = new Map<string, number>();
    observations.forEach((obs) => {
      const cls = obs.classRoom?.trim() || '학급 미지정';
      if (selectedClassFilter !== 'all' && cls !== selectedClassFilter) return;
      const grp = obs.groupName.trim() || '모둠 미지정';
      map.set(grp, (map.get(grp) || 0) + 1);
    });
    topics.forEach((t) => {
      const cls = t.classRoom?.trim() || '학급 미지정';
      if (selectedClassFilter !== 'all' && cls !== selectedClassFilter) return;
      const grp = t.groupName.trim() || '모둠 미지정';
      if (!map.has(grp)) map.set(grp, 0);
    });
    return Array.from(map.entries()).sort(([a], [b]) =>
      a.localeCompare(b, 'ko')
    );
  }, [observations, topics, selectedClassFilter]);

  const availableLocations = useMemo(() => {
    const set = new Set<string>();
    observations.forEach((r) => {
      if (r.locationCategory) set.add(r.locationCategory);
    });
    return Array.from(set);
  }, [observations]);

  const filteredObservations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return observations.filter((item) => {
      const classKey = item.classRoom?.trim() || '학급 미지정';
      const groupKey = item.groupName.trim() || '모둠 미지정';
      if (selectedClassFilter !== 'all' && classKey !== selectedClassFilter) {
        return false;
      }
      if (selectedGroupFilter !== 'all' && groupKey !== selectedGroupFilter) {
        return false;
      }
      if (
        locationFilter !== 'all' &&
        item.locationCategory !== locationFilter
      ) {
        return false;
      }
      if (!q) return true;
      const target = [
        item.classRoom,
        item.classInfo,
        item.authorName,
        item.groupName,
        item.locationCategory,
        item.locationDetail,
        item.wasteScene,
        item.wasteCause,
        item.sensorIdea,
        item.photoCaption,
      ]
        .join(' ')
        .toLowerCase();
      return target.includes(q);
    });
  }, [
    observations,
    selectedClassFilter,
    selectedGroupFilter,
    locationFilter,
    searchQuery,
  ]);

  const filteredGroupBuckets = useMemo<GroupBucket[]>(() => {
    const map = new Map<string, GroupBucket>();
    filteredObservations.forEach((obs) => {
      const classRoom = obs.classRoom?.trim() || '학급 미지정';
      const groupName = obs.groupName.trim() || '모둠 미지정';
      const key = `${classRoom}::${groupName}`;
      const existing = map.get(key);
      if (existing) {
        existing.items.push(obs);
      } else {
        map.set(key, {
          key,
          classRoom,
          groupName,
          items: [obs],
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => {
      const clsCmp = a.classRoom.localeCompare(b.classRoom, 'ko');
      if (clsCmp !== 0) return clsCmp;
      return a.groupName.localeCompare(b.groupName, 'ko');
    });
  }, [filteredObservations]);

  const totalGroupBucketCount = useMemo(() => {
    const set = new Set<string>();
    observations.forEach((obs) => {
      const classRoom = obs.classRoom?.trim() || '학급 미지정';
      const groupName = obs.groupName.trim() || '모둠 미지정';
      set.add(`${classRoom}::${groupName}`);
    });
    return set.size;
  }, [observations]);

  const filteredTopics = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return topics.filter((topic) => {
      const classKey = topic.classRoom?.trim() || '학급 미지정';
      const groupKey = topic.groupName.trim() || '모둠 미지정';
      if (selectedClassFilter !== 'all' && classKey !== selectedClassFilter) {
        return false;
      }
      if (selectedGroupFilter !== 'all' && groupKey !== selectedGroupFilter) {
        return false;
      }
      if (!q) return true;
      return [
        topic.classRoom,
        topic.groupName,
        topic.groupMembers,
        topic.selectedLocation,
        topic.projectTitle,
        topic.coreQuestion,
        topic.selectionReason,
        topic.controlConditionWhen,
        topic.controlConditionThen,
        topic.controlConditionDraft,
      ]
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [topics, selectedClassFilter, selectedGroupFilter, searchQuery]);

  const stats = useMemo(() => {
    const photoCount = observations.filter((r) =>
      Boolean(r.photoDataUrl || r.hasPhoto)
    ).length;
    const obsCount =
      selectedClassFilter === 'all' && typeof totalObservationCount === 'number'
        ? Math.max(totalObservationCount, observations.length)
        : observations.length;
    return {
      observations: obsCount,
      groupsWithObs: totalGroupBucketCount,
      photos: photoCount,
      topics: topics.length,
    };
  }, [
    observations,
    totalGroupBucketCount,
    topics.length,
    selectedClassFilter,
    totalObservationCount,
  ]);

  const hasPreviewOnlyRecords =
    observations.some((r) => r.syncState === 'preview-only') ||
    topics.some((t) => t.syncState === 'preview-only') ||
    groupCodes.some((c) => c.syncState === 'preview-only');

  const formatDateTime = (iso: string) => {
    try {
      return new Intl.DateTimeFormat('ko-KR', {
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  };

  const prefillExistingCode = (targetClass: string, targetGroup: string) => {
    const existing = groupCodes.find(
      (c) =>
        c.classRoom.trim() === targetClass.trim() &&
        c.groupName.trim() === targetGroup.trim()
    );
    if (existing) {
      setCodeValue(existing.code);
    }
  };

  const handleCodeClassChange = (value: string) => {
    setCodeClassPreset(value);
    setCodeFormError('');
    setConfirmBulkOverwriteClass(null);
    if (value === '직접 입력') {
      setCodeClassRoom('');
    } else {
      setCodeClassRoom(value);
      prefillExistingCode(value, codeGroupName);
    }
  };

  const handleCodePresetSelect = (preset: string) => {
    setCodeGroupPreset(preset);
    setCodeFormError('');
    if (preset === '직접 입력') {
      setCodeGroupName('');
    } else {
      setCodeGroupName(preset);
      prefillExistingCode(codeClassRoom, preset);
    }
  };

  const handleGenerateSampleCode = () => {
    const randomFour = String(Math.floor(1000 + Math.random() * 9000));
    setCodeValue(randomFour);
    setCodeFormError('');
  };

  const handleSaveGroupCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setCodeFormError('');

    if (!codeClassRoom.trim()) {
      setCodeFormError('학급(반)을 선택하거나 입력해 주세요.');
      return;
    }
    if (!codeGroupName.trim()) {
      setCodeFormError('모둠 이름을 선택하거나 입력해 주세요.');
      return;
    }
    if (!codeValue.trim()) {
      setCodeFormError('모둠에 안내할 인증코드를 입력해 주세요.');
      return;
    }

    setIsSavingCode(true);
    try {
      const result = await saveGroupCode(
        codeClassRoom.trim(),
        codeGroupName.trim(),
        codeValue.trim()
      );
      setCodeSaveFeedback(result);
      onGroupCodeSaved(result);
      if (!result.failed) {
        setCodeValue('');
      }
    } finally {
      setIsSavingCode(false);
    }
  };

  const executeBulkGenerateCodes = async (targetClass: string) => {
    const groupPresets = GROUP_NAME_PRESETS.filter((g) => g !== '직접 입력');
    const entries = groupPresets.map((groupName) => ({
      groupName,
      code: String(Math.floor(1000 + Math.random() * 9000)),
    }));

    setIsBulkGenerating(true);
    setConfirmBulkOverwriteClass(null);
    try {
      const result = await saveBulkGroupCodes(targetClass, entries);
      setCodeSaveFeedback({
        savedToServer: result.savedToServer,
        failed: result.failed,
        status: result.status,
        message: result.message,
      });
      if (!result.failed) {
        onBulkGroupCodesSaved(result);
        setCodeListClassFilter(targetClass);
      }
    } finally {
      setIsBulkGenerating(false);
    }
  };

  const handleBulkGenerateClick = () => {
    setCodeFormError('');
    const targetClass = codeClassRoom.trim();
    if (!targetClass) {
      setCodeFormError('일괄 생성할 학급(반)을 먼저 선택하거나 입력해 주세요.');
      return;
    }

    const hasExistingForClass = groupCodes.some(
      (c) => c.classRoom.trim() === targetClass
    );
    if (hasExistingForClass && confirmBulkOverwriteClass !== targetClass) {
      setConfirmBulkOverwriteClass(targetClass);
      return;
    }

    void executeBulkGenerateCodes(targetClass);
  };

  const filteredGroupCodes = useMemo(() => {
    if (codeListClassFilter === 'all') return groupCodes;
    return groupCodes.filter(
      (entry) => entry.classRoom.trim() === codeListClassFilter
    );
  }, [groupCodes, codeListClassFilter]);

  const handleCopyGroupCodes = async () => {
    if (filteredGroupCodes.length === 0) return;
    const header =
      codeListClassFilter === 'all'
        ? '[모둠별 인증코드 전체 목록]'
        : `[${codeListClassFilter} 모둠별 인증코드]`;
    const lines = filteredGroupCodes.map(
      (c) => `${c.classRoom} · ${c.groupName}: ${c.code}`
    );
    const text = `${header}\n${lines.join('\n')}`;

    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(text);
        setCopiedCodesNotice(
          `${
            codeListClassFilter === 'all'
              ? '전체'
              : codeListClassFilter
          } 인증코드 ${filteredGroupCodes.length}건을 클립보드에 복사했습니다.`
        );
      } else {
        setCopiedCodesNotice(
          '이 브라우저에서는 자동 복사가 지원되지 않습니다. 화면 목록에서 직접 확인해 주세요.'
        );
      }
    } catch {
      setCopiedCodesNotice(
        '클립보드 복사에 실패했습니다. 브라우저 권한을 확인하거나 화면 목록을 참고해 주세요.'
      );
    }
  };

  const handleLoadPhoto = async (obsId: string) => {
    if (!onLoadObservationPhoto) return;
    setLoadingPhotoId(obsId);
    try {
      await onLoadObservationPhoto(obsId);
    } finally {
      setLoadingPhotoId((prev) => (prev === obsId ? null : prev));
    }
  };

  const handleTeacherLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    if (!teacherPassword.trim()) {
      setLoginError('교사용 비밀번호를 입력해 주세요.');
      return;
    }

    setIsLoggingIn(true);
    try {
      const res = await onTeacherLogin(teacherPassword);
      if (res.ok && res.authenticated) {
        setTeacherPassword('');
        setLoginError('');
      } else {
        setLoginError(res.message);
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const renderObsDeleteControl = (obsId: string) => {
    if (confirmDeleteObsId === obsId) {
      return (
        <div className="inline-flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              onDeleteObservation(obsId);
              setConfirmDeleteObsId(null);
            }}
            className="min-h-[34px] rounded-md bg-rose-700 px-2.5 py-1 text-xs font-semibold text-white hover:bg-rose-800 whitespace-nowrap"
          >
            삭제 확인
          </button>
          <button
            type="button"
            onClick={() => setConfirmDeleteObsId(null)}
            className="min-h-[34px] rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            취소
          </button>
        </div>
      );
    }

    return (
      <button
        type="button"
        onClick={() => setConfirmDeleteObsId(obsId)}
        aria-label="이 관찰 일지 삭제"
        className="inline-flex min-h-[34px] items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-500 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 whitespace-nowrap"
      >
        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
        <span>삭제</span>
      </button>
    );
  };

  const renderTopicDeleteControl = (topicId: string) => {
    if (confirmDeleteTopicId === topicId) {
      return (
        <div className="inline-flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              onDeleteTopic(topicId);
              setConfirmDeleteTopicId(null);
            }}
            className="min-h-[34px] rounded-md bg-rose-700 px-2.5 py-1 text-xs font-semibold text-white hover:bg-rose-800 whitespace-nowrap"
          >
            삭제 확인
          </button>
          <button
            type="button"
            onClick={() => setConfirmDeleteTopicId(null)}
            className="min-h-[34px] rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            취소
          </button>
        </div>
      );
    }

    return (
      <button
        type="button"
        onClick={() => setConfirmDeleteTopicId(topicId)}
        aria-label="이 모둠 주제 삭제"
        className="inline-flex min-h-[34px] items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-500 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 whitespace-nowrap"
      >
        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
        <span>삭제</span>
      </button>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500">
            교사 확인 화면 · 1차시 결과, 2차시 주제, 모둠 인증코드 관리
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            수업 활동 결과 모아보기
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => void onRefreshData()}
            disabled={isRefreshingData || isCheckingStorage}
            className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 whitespace-nowrap shrink-0"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isRefreshingData ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            <span>{isRefreshingData ? '새로고침 중...' : '응답 새로고침'}</span>
          </button>

          {storageStatus === 'connected' && isTeacherAuthenticated && (
            <button
              type="button"
              onClick={() => void onTeacherLogout()}
              className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
              <span>로그아웃</span>
            </button>
          )}

          {hasPreviewOnlyRecords && (
            <button
              type="button"
              onClick={onClearPreviewRecords}
              className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>임시 미리보기 비우기</span>
            </button>
          )}
        </div>
      </div>

      <StorageStatusNotice
        status={storageStatus}
        statusDetail={statusDetail}
        onRetryCheck={onRetryConnection}
        isChecking={isCheckingStorage}
        context="teacher"
      />

      {storageStatus === 'not-connected' && (
        <section
          aria-labelledby="teacher-preview-login-title"
          className="rounded-xl border border-slate-200 bg-white p-5 space-y-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2
                id="teacher-preview-login-title"
                className="text-sm font-bold text-slate-900"
              >
                교사 서버 로그인 (Cloudflare 배포 후 활성화)
              </h2>
              <p className="mt-0.5 text-xs text-slate-600">
                Cloudflare Workers 배포 후에는 <code className="font-mono">TEACHER_PASSWORD</code> Secret으로 로그인해야 학생 응답과 모둠 코드를 조회할 수 있습니다.
              </p>
            </div>
            <span className="text-xs font-medium text-amber-800">
              현재 화면은 서버 미연결 임시 미리보기
            </span>
          </div>

          <form
            onSubmit={handleTeacherLoginSubmit}
            className="flex flex-col gap-2 sm:flex-row sm:items-center"
          >
            <label htmlFor="teacher-password-preview" className="sr-only">
              교사 비밀번호
            </label>
            <input
              id="teacher-password-preview"
              type="password"
              value={teacherPassword}
              onChange={(e) => {
                setTeacherPassword(e.target.value);
                setLoginError('');
              }}
              placeholder="교사 비밀번호 입력"
              autoComplete="current-password"
              className="min-h-[42px] flex-1 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20"
            />
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={isLoggingIn}
                className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-60 whitespace-nowrap"
              >
                <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{isLoggingIn ? '확인 중...' : '로그인'}</span>
              </button>
              <button
                type="button"
                disabled
                title="로그인 후 사용할 수 있습니다"
                className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-400 whitespace-nowrap cursor-not-allowed"
              >
                <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                <span>로그아웃</span>
              </button>
            </div>
          </form>

          {loginError && (
            <p role="alert" className="text-xs font-medium text-rose-700">
              {loginError}
            </p>
          )}
        </section>
      )}

      {storageStatus === 'connected' && !isTeacherAuthenticated ? (
        <section
          aria-labelledby="teacher-login-title"
          className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 space-y-5"
        >
          <div className="space-y-2 text-center">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700">
              <Lock className="h-5 w-5" aria-hidden="true" />
            </div>
            <h2
              id="teacher-login-title"
              className="text-lg font-bold text-slate-900"
            >
              교사 인증 후 응답 확인하기
            </h2>
            <p className="text-sm leading-relaxed text-slate-600">
              학생들의 개인 관찰 일지와 사진, 모둠 인증코드는 보호된 교사
              세션에서만 조회할 수 있습니다.
            </p>
          </div>

          {!isTeacherAuthConfigured && (
            <div
              role="alert"
              className="rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-xs leading-relaxed text-amber-950"
            >
              서버에 <code className="font-mono font-semibold">TEACHER_PASSWORD</code>{' '}
              Secret이 아직 등록되지 않아 로그인할 수 없습니다. Cloudflare Worker
              Secret을 설정한 뒤 다시 시도해 주세요.
            </div>
          )}

          <form onSubmit={handleTeacherLoginSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="teacher-password-input"
                className="block text-sm font-semibold text-slate-900"
              >
                교사 비밀번호
              </label>
              <input
                id="teacher-password-input"
                type="password"
                value={teacherPassword}
                onChange={(e) => {
                  setTeacherPassword(e.target.value);
                  setLoginError('');
                }}
                placeholder="TEACHER_PASSWORD에 설정한 비밀번호"
                autoComplete="current-password"
                className="min-h-[46px] w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-base text-slate-900 placeholder:text-slate-400 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20"
              />
            </div>

            {loginError && (
              <p role="alert" className="text-xs font-medium text-rose-700">
                {loginError}
              </p>
            )}

            <button
              type="submit"
              disabled={isLoggingIn || !isTeacherAuthConfigured}
              className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
            >
              <Lock className="h-4 w-4" aria-hidden="true" />
              <span>{isLoggingIn ? '비밀번호 확인 중...' : '로그인'}</span>
            </button>
          </form>
        </section>
      ) : (
        <>

      {/* 요약 지표 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">1차시 개인 기록</p>
          <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">
            {stats.observations}건
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">참여 모둠 수</p>
          <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">
            {stats.groupsWithObs}모둠
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">제출된 현장 사진</p>
          <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">
            {stats.photos}장
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">
            인증코드 / 확정 주제
          </p>
          <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">
            {groupCodes.length} / {stats.topics}
          </p>
        </div>
      </div>

      {/* 차시 & 관리 탭 */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setStageTab('lesson1')}
              className={`min-h-[40px] rounded-md px-3.5 py-1.5 text-sm font-semibold transition-colors whitespace-nowrap shrink-0 tabular-nums ${
                stageTab === 'lesson1'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              1차시 · 개인 관찰 결과 ({stats.observations})
            </button>
            <button
              type="button"
              onClick={() => setStageTab('lesson2')}
              className={`min-h-[40px] rounded-md px-3.5 py-1.5 text-sm font-semibold transition-colors whitespace-nowrap shrink-0 tabular-nums ${
                stageTab === 'lesson2'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              2차시 · 모둠별 주제 선정 ({topics.length})
            </button>
            <button
              type="button"
              onClick={() => setStageTab('codes')}
              className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-md px-3.5 py-1.5 text-sm font-semibold transition-colors whitespace-nowrap shrink-0 tabular-nums ${
                stageTab === 'codes'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
              <span>모둠 인증코드 관리 ({groupCodes.length})</span>
            </button>
          </div>

          {stageTab === 'lesson1' && (
            <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
              <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => setDisplayMode('by-group')}
                  className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    displayMode === 'by-group'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Users className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>모둠별로 결과 보기</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDisplayMode('by-individual')}
                  className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    displayMode === 'by-individual'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <User className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>개인별 목록 보기</span>
                </button>
              </div>

              {displayMode === 'by-group' && (
                <button
                  type="button"
                  onClick={() => setShowGroupCodesInLesson1((prev) => !prev)}
                  aria-pressed={showGroupCodesInLesson1}
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
                >
                  {showGroupCodesInLesson1 ? (
                    <>
                      <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>모둠 인증코드 숨기기</span>
                    </>
                  ) : (
                    <>
                      <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>모둠 인증코드 보기</span>
                    </>
                  )}
                </button>
              )}
            </div>
          )}
        </div>

        {/* 학급/모둠/공간/검색 필터 (1·2차시 결과 조회 탭일 때 표시) */}
        {stageTab !== 'codes' && (
          <div className="flex flex-col gap-3 border-t border-slate-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <label className="sr-only" htmlFor="teacher-class-filter">
                학급 필터
              </label>
              <select
                id="teacher-class-filter"
                value={selectedClassFilter}
                onChange={(e) => {
                  const nextClass = e.target.value;
                  setSelectedClassFilter(nextClass);
                  setSelectedGroupFilter('all');
                  if (
                    storageStatus === 'connected' &&
                    isTeacherAuthenticated &&
                    onClassFilterServerChange
                  ) {
                    void onClassFilterServerChange(nextClass);
                  }
                }}
                className="min-h-[38px] rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 focus:border-emerald-700 focus:outline-none"
              >
                <option value="all">전체 학급</option>
                {availableClasses.map((cls) => (
                  <option key={cls} value={cls}>
                    {cls}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => setSelectedGroupFilter('all')}
                className={`min-h-[38px] rounded-lg border px-3 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 ${
                  selectedGroupFilter === 'all'
                    ? 'border-emerald-700 bg-emerald-700 text-white'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                전체 모둠
              </button>
              {availableGroupNames.map(([groupName, count]) => (
                <button
                  key={groupName}
                  type="button"
                  onClick={() => setSelectedGroupFilter(groupName)}
                  className={`min-h-[38px] rounded-lg border px-3 py-1.5 text-xs font-semibold tabular-nums whitespace-nowrap shrink-0 ${
                    selectedGroupFilter === groupName
                      ? 'border-emerald-700 bg-emerald-700 text-white'
                      : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {groupName}
                  {stageTab === 'lesson1' ? ` (${count})` : ''}
                </button>
              ))}

              {stageTab === 'lesson1' && availableLocations.length > 0 && (
                <>
                  <label className="sr-only" htmlFor="teacher-location-filter">
                    공간 필터
                  </label>
                  <select
                    id="teacher-location-filter"
                    value={locationFilter}
                    onChange={(e) => setLocationFilter(e.target.value)}
                    className="min-h-[38px] rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 focus:border-emerald-700 focus:outline-none"
                  >
                    <option value="all">모든 공간</option>
                    {availableLocations.map((loc) => (
                      <option key={loc} value={loc}>
                        {loc}
                      </option>
                    ))}
                  </select>
                </>
              )}
            </div>

            <div className="relative w-full sm:max-w-xs">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="학급, 모둠, 이름, 장소 검색"
                aria-label="결과 검색"
                className="min-h-[40px] w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20"
              />
            </div>
          </div>
        )}
      </div>

      {/* 탭 1: 1차시 개인/모둠 관찰 결과 */}
      {stageTab === 'lesson1' && photosDeferred && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5 text-xs leading-relaxed text-emerald-950">
          전체 학급 응답({stats.observations}건)이 많아 속도를 위해 텍스트
          먼저 불러왔습니다. 위{' '}
          <span className="font-semibold">학급 필터</span>에서 특정 반을
          선택하면 해당 반의 모든 사진을 한꺼번에 불러오고, 개별 카드의{' '}
          <span className="font-semibold">[사진 불러오기]</span>로도 바로
          확인할 수 있습니다.
        </div>
      )}

      {stageTab === 'lesson1' &&
        (filteredObservations.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center">
            <FileText
              className="mx-auto h-8 w-8 text-slate-400"
              aria-hidden="true"
            />
            <h2 className="mt-3 text-base font-semibold text-slate-900">
              {observations.length === 0
                ? '아직 제출된 1차시 개인 관찰 일지가 없습니다'
                : '조건에 맞는 관찰 일지가 없습니다'}
            </h2>
            <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-slate-600">
              {observations.length === 0
                ? '학생들이 개인 관찰 일지와 현장 사진을 제출하면 이곳에서 학급·모둠별로 묶어 한눈에 보여줄 수 있습니다.'
                : '학급·모둠 필터나 검색어를 바꾸어 다시 확인해 보세요.'}
            </p>
            {observations.length === 0 && (
              <button
                type="button"
                onClick={onGoToLesson1}
                className="mt-5 inline-flex min-h-[44px] items-center justify-center rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
              >
                1차시 개인 관찰 일지 화면으로 이동
              </button>
            )}
          </div>
        ) : displayMode === 'by-group' ? (
          <div className="space-y-6">
            {filteredGroupBuckets.map((bucket) => {
              const codeObj = groupCodes.find(
                (c) =>
                  c.classRoom.trim() === bucket.classRoom &&
                  c.groupName.trim() === bucket.groupName
              );

              return (
                <section
                  key={bucket.key}
                  aria-label={`${bucket.classRoom} ${bucket.groupName} 관찰 결과`}
                  className="rounded-xl border border-slate-200 bg-white p-5 space-y-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Users
                        className="h-4 w-4 text-emerald-700"
                        aria-hidden="true"
                      />
                      <h2 className="text-lg font-bold text-slate-900">
                        {bucket.classRoom} · {bucket.groupName}
                      </h2>
                      <span className="text-xs font-medium text-slate-500 tabular-nums">
                        · 개인 관찰 {bucket.items.length}건 · 사진{' '}
                        {
                          bucket.items.filter((i) =>
                            Boolean(i.photoDataUrl || i.hasPhoto)
                          ).length
                        }
                        장
                      </span>
                      {codeObj &&
                        (showGroupCodesInLesson1 ? (
                          <span className="font-mono text-xs font-semibold text-emerald-800">
                            · 인증코드: {codeObj.code}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-500">
                            · 인증코드 등록됨 (화면 공유 보호 중)
                          </span>
                        ))}
                    </div>
                    <div className="flex items-center gap-2">
                      {!codeObj && (
                        <button
                          type="button"
                          onClick={() => {
                            if (
                              (
                                CLASS_ROOM_PRESETS as readonly string[]
                              ).includes(bucket.classRoom) &&
                              bucket.classRoom !== '직접 입력'
                            ) {
                              setCodeClassPreset(bucket.classRoom);
                            } else {
                              setCodeClassPreset('직접 입력');
                            }
                            setCodeClassRoom(bucket.classRoom);

                            if (
                              (
                                GROUP_NAME_PRESETS as readonly string[]
                              ).includes(bucket.groupName) &&
                              bucket.groupName !== '직접 입력'
                            ) {
                              setCodeGroupPreset(bucket.groupName);
                            } else {
                              setCodeGroupPreset('직접 입력');
                            }
                            setCodeGroupName(bucket.groupName);
                            setStageTab('codes');
                          }}
                          className="min-h-[38px] rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100"
                        >
                          인증코드 만들기
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={onGoToLesson2}
                        className="min-h-[38px] rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        2차시 주제 선정으로 이동
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    {bucket.items.map((item) => {
                      const displayLocation = item.locationDetail
                        ? `${item.locationCategory === '직접 입력' ? '' : item.locationCategory + ' · '}${item.locationDetail}`
                        : item.locationCategory;

                      return (
                        <article
                          key={item.id}
                          className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 space-y-3"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                            <div className="flex flex-wrap items-center gap-x-2">
                              <span className="font-semibold text-slate-900">
                                {item.classInfo} {item.authorName}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span className="font-medium text-emerald-800">
                                {displayLocation}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center gap-1 tabular-nums">
                                <Clock className="h-3 w-3" aria-hidden="true" />
                                {formatDateTime(item.createdAt)}
                              </span>
                              {renderObsDeleteControl(item.id)}
                            </div>
                          </div>

                          {item.photoDataUrl ? (
                            <div className="space-y-1.5">
                              <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-white">
                                <img
                                  src={item.photoDataUrl}
                                  alt={
                                    item.photoCaption ||
                                    `${displayLocation} 관찰 사진`
                                  }
                                  referrerPolicy="no-referrer"
                                  className="max-h-52 w-full object-contain"
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    setEnlargedPhoto({
                                      src: item.photoDataUrl,
                                      title: `${bucket.classRoom} · ${bucket.groupName} · ${item.authorName} (${displayLocation})`,
                                    })
                                  }
                                  className="absolute right-2 bottom-2 inline-flex min-h-[36px] items-center gap-1 rounded-md bg-slate-900/80 px-2.5 py-1 text-xs font-medium text-white hover:bg-slate-900"
                                >
                                  <Maximize2
                                    className="h-3.5 w-3.5"
                                    aria-hidden="true"
                                  />
                                  <span>크게 보기</span>
                                </button>
                              </div>
                              {item.photoCaption && (
                                <p className="text-xs text-slate-500">
                                  {item.photoCaption}
                                </p>
                              )}
                            </div>
                          ) : item.hasPhoto && onLoadObservationPhoto ? (
                            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed border-slate-300 bg-white px-3 py-2.5">
                              <span className="inline-flex items-center gap-1.5 text-xs text-slate-600">
                                <ImageIcon
                                  className="h-3.5 w-3.5 text-slate-400"
                                  aria-hidden="true"
                                />
                                <span>
                                  {item.photoCaption
                                    ? `사진 첨부됨 (${item.photoCaption})`
                                    : '현장 사진이 첨부되어 있습니다'}
                                </span>
                              </span>
                              <button
                                type="button"
                                disabled={loadingPhotoId === item.id}
                                onClick={() => void handleLoadPhoto(item.id)}
                                className="inline-flex min-h-[34px] items-center gap-1.5 rounded-md border border-emerald-700/40 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-900 hover:bg-emerald-100 disabled:opacity-60 whitespace-nowrap"
                              >
                                <ImageIcon
                                  className="h-3.5 w-3.5"
                                  aria-hidden="true"
                                />
                                <span>
                                  {loadingPhotoId === item.id
                                    ? '불러오는 중...'
                                    : '사진 불러오기'}
                                </span>
                              </button>
                            </div>
                          ) : null}

                          <div className="space-y-2 text-sm">
                            <div>
                              <p className="text-xs font-semibold text-slate-500">
                                에너지 낭비 장면
                              </p>
                              <p className="mt-0.5 leading-relaxed text-slate-900">
                                {item.wasteScene}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-slate-500">
                                원인과 불편한 점
                              </p>
                              <p className="mt-0.5 leading-relaxed text-slate-700">
                                {item.wasteCause}
                              </p>
                            </div>
                            {item.sensorIdea && (
                              <div>
                                <p className="text-xs font-semibold text-slate-500">
                                  센서 아이디어
                                </p>
                                <p className="mt-0.5 text-slate-800">
                                  {item.sensorIdea}
                                </p>
                              </div>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredObservations.map((item) => {
              const displayLocation = item.locationDetail
                ? `${item.locationCategory === '직접 입력' ? '' : item.locationCategory + ' · '}${item.locationDetail}`
                : item.locationCategory;

              return (
                <article
                  key={item.id}
                  className="rounded-xl border border-slate-200 bg-white p-5 space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600">
                      <span className="font-semibold text-emerald-800">
                        {item.classRoom} · {item.groupName || '모둠 미지정'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-semibold text-slate-900">
                        {item.classInfo} {item.authorName}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{displayLocation}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 tabular-nums">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                        {formatDateTime(item.createdAt)}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span
                        className={
                          item.syncState === 'saved-to-api'
                            ? 'font-medium text-emerald-700'
                            : 'font-medium text-amber-800'
                        }
                      >
                        {item.syncState === 'saved-to-api'
                          ? '서버 저장됨'
                          : '임시 미리보기 (저장 준비 중)'}
                      </span>
                      {renderObsDeleteControl(item.id)}
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-12">
                    {item.photoDataUrl ? (
                      <div className="md:col-span-4 space-y-1.5">
                        <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                          <img
                            src={item.photoDataUrl}
                            alt={
                              item.photoCaption ||
                              `${displayLocation} 관찰 사진`
                            }
                            referrerPolicy="no-referrer"
                            className="max-h-48 w-full object-contain"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setEnlargedPhoto({
                                src: item.photoDataUrl,
                                title: `${item.classRoom} · ${item.groupName} · ${item.authorName} (${displayLocation})`,
                              })
                            }
                            className="absolute right-2 bottom-2 inline-flex min-h-[34px] items-center gap-1 rounded-md bg-slate-900/80 px-2 py-1 text-xs font-medium text-white hover:bg-slate-900"
                          >
                            <Maximize2 className="h-3 w-3" aria-hidden="true" />
                            <span>크게</span>
                          </button>
                        </div>
                      </div>
                    ) : item.hasPhoto && onLoadObservationPhoto ? (
                      <div className="md:col-span-4 flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-center">
                        <p className="text-xs text-slate-600">
                          {item.photoCaption || '현장 사진이 첨부되어 있습니다'}
                        </p>
                        <button
                          type="button"
                          disabled={loadingPhotoId === item.id}
                          onClick={() => void handleLoadPhoto(item.id)}
                          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-md border border-emerald-700/40 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-900 hover:bg-emerald-50 disabled:opacity-60"
                        >
                          <ImageIcon
                            className="h-3.5 w-3.5"
                            aria-hidden="true"
                          />
                          <span>
                            {loadingPhotoId === item.id
                              ? '불러오는 중...'
                              : '사진 불러오기'}
                          </span>
                        </button>
                      </div>
                    ) : null}

                    <div
                      className={`grid gap-4 sm:grid-cols-2 ${
                        item.photoDataUrl ||
                        (item.hasPhoto && onLoadObservationPhoto)
                          ? 'md:col-span-8'
                          : 'md:col-span-12'
                      }`}
                    >
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-slate-500">
                          발견한 에너지 낭비 장면
                        </p>
                        <p className="text-sm leading-relaxed text-slate-900">
                          {item.wasteScene}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-slate-500">
                          원인과 불편한 점
                        </p>
                        <p className="text-sm leading-relaxed text-slate-700">
                          {item.wasteCause}
                        </p>
                      </div>
                      {item.sensorIdea && (
                        <div className="sm:col-span-2 border-t border-slate-100 pt-2 text-sm">
                          <span className="text-xs font-semibold text-slate-500">
                            센서·코딩 아이디어:{' '}
                          </span>
                          <span className="text-slate-800">
                            {item.sensorIdea}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ))}

      {/* 탭 2: 2차시 모둠별 주제 선정 결과 */}
      {stageTab === 'lesson2' &&
        (filteredTopics.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center">
            <Users
              className="mx-auto h-8 w-8 text-slate-400"
              aria-hidden="true"
            />
            <h2 className="mt-3 text-base font-semibold text-slate-900">
              {topics.length === 0
                ? '아직 제출된 2차시 모둠별 프로젝트 주제가 없습니다'
                : '조건에 맞는 모둠 주제가 없습니다'}
            </h2>
            <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-slate-600">
              2차시 「모둠별 프로젝트 주제 선정」 페이지에서 모둠 인증 후 최종
              주제와 핵심 질문을 작성하면 이곳에 모여 보입니다.
            </p>
            {topics.length === 0 && (
              <button
                type="button"
                onClick={onGoToLesson2}
                className="mt-5 inline-flex min-h-[44px] items-center justify-center rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
              >
                2차시 모둠별 주제 선정 화면으로 이동
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredTopics.map((topic) => (
              <article
                key={topic.id}
                className="rounded-xl border border-slate-200 bg-white p-5 space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="flex flex-wrap items-center gap-x-2 text-xs text-slate-600">
                    <span className="text-sm font-bold text-emerald-800">
                      {topic.classRoom} · {topic.groupName}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>모둠원: {topic.groupMembers}</span>
                    <span aria-hidden="true">·</span>
                    <span>선정 공간: {topic.selectedLocation}</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 tabular-nums">
                    <span>{formatDateTime(topic.createdAt)}</span>
                    <span aria-hidden="true">·</span>
                    <span
                      className={
                        topic.syncState === 'saved-to-api'
                          ? 'font-medium text-emerald-700'
                          : 'font-medium text-amber-800'
                      }
                    >
                      {topic.syncState === 'saved-to-api'
                        ? '서버 저장됨'
                        : '임시 미리보기 (저장 준비 중)'}
                    </span>
                    {renderTopicDeleteControl(topic.id)}
                  </div>
                </div>

                <div className="grid gap-5 md:grid-cols-12">
                  {topic.referencePhotoDataUrl && (
                    <div className="md:col-span-4">
                      <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                        <img
                          src={topic.referencePhotoDataUrl}
                          alt={`${topic.groupName} 기준 현장 사진`}
                          referrerPolicy="no-referrer"
                          className="max-h-52 w-full object-contain"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setEnlargedPhoto({
                              src: topic.referencePhotoDataUrl,
                              title: `${topic.classRoom} · ${topic.groupName} · ${topic.projectTitle}`,
                            })
                          }
                          className="absolute right-2 bottom-2 inline-flex min-h-[34px] items-center gap-1 rounded-md bg-slate-900/80 px-2.5 py-1 text-xs font-medium text-white hover:bg-slate-900"
                        >
                          <Maximize2 className="h-3 w-3" aria-hidden="true" />
                          <span>크게</span>
                        </button>
                      </div>
                    </div>
                  )}

                  <div
                    className={`space-y-3 ${
                      topic.referencePhotoDataUrl
                        ? 'md:col-span-8'
                        : 'md:col-span-12'
                    }`}
                  >
                    <div>
                      <p className="text-xs font-semibold text-slate-500">
                        최종 모둠 프로젝트 주제
                      </p>
                      <h2 className="mt-0.5 text-lg font-bold text-slate-900">
                        {topic.projectTitle}
                      </h2>
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-slate-500">
                        모둠 핵심 질문
                      </p>
                      <p className="mt-0.5 text-sm leading-relaxed text-slate-900">
                        {topic.coreQuestion}
                      </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="text-xs font-semibold text-slate-500">
                          선정 이유 (원인·자동화 필요성)
                        </p>
                        <p className="mt-0.5 text-sm leading-relaxed text-slate-700">
                          {topic.selectionReason}
                        </p>
                      </div>
                      {(topic.controlConditionWhen ||
                        topic.controlConditionThen ||
                        topic.controlConditionDraft) && (
                        <div>
                          <p className="text-xs font-semibold text-slate-500">
                            제어 조건 초안 (자연어)
                          </p>
                          {topic.controlConditionWhen ||
                          topic.controlConditionThen ? (
                            <div className="mt-0.5 space-y-1 text-sm text-slate-800">
                              {topic.controlConditionWhen && (
                                <p>
                                  <span className="font-semibold text-slate-700">
                                    만약:{' '}
                                  </span>
                                  {topic.controlConditionWhen}
                                </p>
                              )}
                              {topic.controlConditionThen && (
                                <p>
                                  <span className="font-semibold text-slate-700">
                                    작동:{' '}
                                  </span>
                                  {topic.controlConditionThen}
                                </p>
                              )}
                            </div>
                          ) : (
                            <p className="mt-0.5 text-sm leading-relaxed text-slate-800">
                              {topic.controlConditionDraft}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ))}

      {/* 탭 3: 모둠별 인증코드 직접 만들기 / 관리 */}
      {stageTab === 'codes' && (
        <div className="grid gap-6 lg:grid-cols-12 lg:items-start">
          <section
            aria-labelledby="code-creator-title"
            className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 space-y-5 lg:col-span-5"
          >
            <div className="border-b border-slate-100 pb-4">
              <p className="text-xs font-semibold text-emerald-800">
                2차시 모둠 활동 준비
              </p>
              <h2
                id="code-creator-title"
                className="mt-1 text-lg font-bold text-slate-900"
              >
                모둠별 인증코드 만들기
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                교사가 직접 학급과 모둠을 지정해 인증코드를 만들면, 학생들이
                2차시 페이지에서 자기 반·자기 모둠의 1차시 관찰 일지와 사진을
                열어볼 수 있습니다.
              </p>
            </div>

            <form
              onSubmit={handleSaveGroupCode}
              noValidate
              className="space-y-4"
            >
              <div className="space-y-1.5">
                <label
                  htmlFor="code-class-room"
                  className="block text-sm font-semibold text-slate-900"
                >
                  1. 학급 (반) 선택
                </label>
                <select
                  id="code-class-room"
                  value={codeClassPreset}
                  onChange={(e) => handleCodeClassChange(e.target.value)}
                  className="min-h-[46px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20"
                >
                  {CLASS_ROOM_PRESETS.map((room) => (
                    <option key={room} value={room}>
                      {room}
                    </option>
                  ))}
                </select>
                {codeClassPreset === '직접 입력' && (
                  <input
                    type="text"
                    value={codeClassRoom}
                    onChange={(e) => {
                      setCodeClassRoom(e.target.value);
                      setCodeFormError('');
                    }}
                    placeholder="예: 1학년 13반"
                    aria-label="인증코드를 만들 학급 직접 입력"
                    maxLength={20}
                    className="mt-1.5 min-h-[42px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-700 focus:outline-none"
                  />
                )}
              </div>

              <fieldset className="space-y-2">
                <legend className="text-sm font-semibold text-slate-900">
                  2. 모둠 선택
                </legend>
                <div className="flex flex-wrap gap-2">
                  {GROUP_NAME_PRESETS.map((preset) => {
                    const selected = codeGroupPreset === preset;
                    return (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => handleCodePresetSelect(preset)}
                        aria-pressed={selected}
                        className={`min-h-[42px] rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
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
                {codeGroupPreset === '직접 입력' && (
                  <input
                    type="text"
                    value={codeGroupName}
                    onChange={(e) => {
                      setCodeGroupName(e.target.value);
                      setCodeFormError('');
                    }}
                    placeholder="예: 10모둠"
                    aria-label="인증코드를 만들 모둠 이름"
                    maxLength={30}
                    className="min-h-[46px] w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-base text-slate-900 placeholder:text-slate-400 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20"
                  />
                )}
              </fieldset>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="teacher-code-input"
                    className="text-sm font-semibold text-slate-900"
                  >
                    3. 인증코드 입력
                  </label>
                  <button
                    type="button"
                    onClick={handleGenerateSampleCode}
                    className="inline-flex min-h-[34px] items-center gap-1 rounded-md border border-slate-300 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                  >
                    <Sparkles className="h-3 w-3" aria-hidden="true" />
                    <span>4자리 숫자 채우기</span>
                  </button>
                </div>
                <input
                  id="teacher-code-input"
                  type="text"
                  value={codeValue}
                  onChange={(e) => {
                    setCodeValue(e.target.value);
                    setCodeFormError('');
                  }}
                  placeholder="예: 1204 또는 eco1"
                  maxLength={24}
                  className="min-h-[46px] w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 font-mono text-base text-slate-900 placeholder:font-sans placeholder:text-slate-400 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20"
                />
              </div>

              {codeFormError && (
                <p role="alert" className="text-xs font-medium text-rose-700">
                  {codeFormError}
                </p>
              )}

              <button
                type="submit"
                disabled={isSavingCode || isBulkGenerating}
                className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
              >
                <KeyRound className="h-4 w-4" aria-hidden="true" />
                <span>
                  {isSavingCode ? '저장 중...' : '이 모둠 인증코드 등록하기'}
                </span>
              </button>

              <div className="border-t border-slate-100 pt-4 space-y-2.5">
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-slate-800">
                    반 전체(1~9모둠) 한 번에 만들기
                  </p>
                  <p className="text-xs leading-relaxed text-slate-500">
                    위 「1. 학급 (반) 선택」에 고른 학급의 1모둠~9모둠 인증코드를
                    무작위 4자리 숫자로 한 번에 생성·저장합니다.
                  </p>
                </div>

                {confirmBulkOverwriteClass &&
                confirmBulkOverwriteClass === codeClassRoom.trim() ? (
                  <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 space-y-2">
                    <p className="text-xs font-medium text-amber-950">
                      {confirmBulkOverwriteClass}에 이미 등록된 코드가 있습니다.
                      1~9모둠 코드를 모두 새로 생성해 덮어쓸까요?
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={isBulkGenerating}
                        onClick={() =>
                          void executeBulkGenerateCodes(confirmBulkOverwriteClass)
                        }
                        className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-amber-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-800 disabled:opacity-60"
                      >
                        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>
                          {isBulkGenerating
                            ? '일괄 생성 중...'
                            : '기존 코드 덮어쓰고 일괄 생성'}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmBulkOverwriteClass(null)}
                        className="inline-flex min-h-[38px] items-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        취소
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={isSavingCode || isBulkGenerating}
                    onClick={handleBulkGenerateClick}
                    className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-emerald-700/40 bg-emerald-50/70 px-4 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-100 disabled:opacity-60"
                  >
                    <Sparkles className="h-4 w-4" aria-hidden="true" />
                    <span>
                      {isBulkGenerating
                        ? '일괄 생성 중...'
                        : '선택 학급 1~9모둠 일괄 생성'}
                    </span>
                  </button>
                )}
              </div>
            </form>

            {codeSaveFeedback && (
              <div
                role={codeSaveFeedback.failed ? 'alert' : 'status'}
                className={`rounded-xl border p-3.5 text-xs leading-relaxed ${
                  codeSaveFeedback.failed
                    ? 'border-rose-300 bg-rose-50 text-rose-950'
                    : codeSaveFeedback.savedToServer
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-950'
                      : 'border-amber-300 bg-amber-50 text-amber-950'
                }`}
              >
                <div className="flex items-start gap-2">
                  {codeSaveFeedback.savedToServer ? (
                    <Check
                      className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700"
                      aria-hidden="true"
                    />
                  ) : (
                    <AlertTriangle
                      className={`mt-0.5 h-4 w-4 shrink-0 ${
                        codeSaveFeedback.failed
                          ? 'text-rose-700'
                          : 'text-amber-700'
                      }`}
                      aria-hidden="true"
                    />
                  )}
                  <p>{codeSaveFeedback.message}</p>
                </div>
              </div>
            )}
          </section>

          <section
            aria-labelledby="code-list-title"
            className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 space-y-4 lg:col-span-7"
          >
            <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2
                  id="code-list-title"
                  className="text-lg font-bold text-slate-900"
                >
                  등록된 모둠별 인증코드 목록
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  학생이 2차시 페이지에서 아래 학급·모둠과 인증코드를 입력하면
                  1차시 기록을 볼 수 있습니다.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                <label className="sr-only" htmlFor="code-list-class-filter">
                  인증코드 목록 학급 필터
                </label>
                <select
                  id="code-list-class-filter"
                  value={codeListClassFilter}
                  onChange={(e) => {
                    setCodeListClassFilter(e.target.value);
                    setCopiedCodesNotice('');
                  }}
                  className="min-h-[38px] rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:border-emerald-700 focus:outline-none"
                >
                  <option value="all">전체 학급 ({groupCodes.length})</option>
                  {availableClasses.map((cls) => (
                    <option key={cls} value={cls}>
                      {cls}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={filteredGroupCodes.length === 0}
                  onClick={() => void handleCopyGroupCodes()}
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap shrink-0"
                >
                  <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>코드 목록 복사</span>
                </button>
                <button
                  type="button"
                  onClick={onGoToLesson2}
                  className="min-h-[38px] rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
                >
                  2차시 화면에서 테스트
                </button>
              </div>
            </div>

            {copiedCodesNotice && (
              <div
                role="status"
                className="flex items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-medium text-emerald-950"
              >
                <span>{copiedCodesNotice}</span>
                <button
                  type="button"
                  onClick={() => setCopiedCodesNotice('')}
                  aria-label="복사 알림 닫기"
                  className="rounded p-0.5 text-emerald-800 hover:bg-emerald-100"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            )}

            {filteredGroupCodes.length === 0 ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-5 py-10 text-center text-sm text-slate-600">
                <p className="font-semibold text-slate-900">
                  {groupCodes.length === 0
                    ? '아직 등록된 모둠 인증코드가 없습니다'
                    : `${codeListClassFilter}에 등록된 모둠 인증코드가 없습니다`}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  왼쪽에서 학급과 모둠을 고르고 인증코드를 입력하거나 「선택 학급
                  1~9모둠 일괄 생성」을 눌러 주세요.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {filteredGroupCodes.map((entry) => {
                  const obsCount = observations.filter(
                    (o) =>
                      o.classRoom.trim() === entry.classRoom.trim() &&
                      o.groupName.trim() === entry.groupName.trim()
                  ).length;

                  return (
                    <li
                      key={`${entry.classRoom}::${entry.groupName}`}
                      className="flex flex-wrap items-center justify-between gap-3 py-3.5"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-x-2.5 text-sm">
                          <span className="font-bold text-slate-900">
                            {entry.classRoom} · {entry.groupName}
                          </span>
                          <span aria-hidden="true" className="text-slate-300">
                            ·
                          </span>
                          <span className="font-mono text-base font-semibold text-emerald-800 tabular-nums">
                            {entry.code}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2 text-xs text-slate-500 tabular-nums">
                          <span>1차시 기록 {obsCount}건</span>
                          <span aria-hidden="true">·</span>
                          <span>
                            {entry.syncState === 'saved-to-api'
                              ? '서버 저장됨'
                              : '임시 미리보기 (저장 준비 중)'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (
                              (
                                CLASS_ROOM_PRESETS as readonly string[]
                              ).includes(entry.classRoom) &&
                              entry.classRoom !== '직접 입력'
                            ) {
                              setCodeClassPreset(entry.classRoom);
                            } else {
                              setCodeClassPreset('직접 입력');
                            }
                            setCodeClassRoom(entry.classRoom);

                            if (
                              (
                                GROUP_NAME_PRESETS as readonly string[]
                              ).includes(entry.groupName) &&
                              entry.groupName !== '직접 입력'
                            ) {
                              setCodeGroupPreset(entry.groupName);
                            } else {
                              setCodeGroupPreset('직접 입력');
                            }
                            setCodeGroupName(entry.groupName);
                            setCodeValue(entry.code);
                            setCodeFormError('');
                          }}
                          className="min-h-[38px] rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          수정
                        </button>
                        {(isTeacherAuthenticated ||
                          entry.syncState === 'preview-only') &&
                          (() => {
                            const codeKey = `${entry.classRoom}::${entry.groupName}`;
                            if (confirmDeleteCodeKey === codeKey) {
                              return (
                                <div className="inline-flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      onDeleteGroupCode(
                                        entry.classRoom,
                                        entry.groupName
                                      );
                                      setConfirmDeleteCodeKey(null);
                                    }}
                                    className="min-h-[34px] rounded-md bg-rose-700 px-2.5 py-1 text-xs font-semibold text-white hover:bg-rose-800 whitespace-nowrap"
                                  >
                                    삭제 확인
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteCodeKey(null)}
                                    className="min-h-[34px] rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                                  >
                                    취소
                                  </button>
                                </div>
                              );
                            }
                            return (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteCodeKey(codeKey)}
                                aria-label={`${entry.classRoom} ${entry.groupName} 인증코드 삭제`}
                                className="flex min-h-[38px] min-w-[38px] items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-500 hover:bg-rose-50 hover:text-rose-700"
                              >
                                <Trash2 className="h-4 w-4" aria-hidden="true" />
                              </button>
                            );
                          })()}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      )}
        </>
      )}

      {/* 현장 사진 크게 보기 모달 */}
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
