import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { TopBar, type AppView } from './components/TopBar';
import { StorageStatusNotice } from './components/StorageStatusNotice';
import {
  Lesson1FlowSection,
  Lesson1PageHeader,
  LessonGuidePanel,
} from './components/LessonGuidePanel';
import { StudentObservationForm } from './components/StudentObservationForm';
import { GroupTopicSelectionView } from './components/GroupTopicSelectionView';
import {
  TeacherReviewView,
  type TeacherStageTab,
} from './components/TeacherReviewView';
import {
  checkApiHealth,
  clearPreviewCodes,
  clearPreviewRecords,
  clearPreviewTopics,
  deleteGroupCodeFromApi,
  deleteGroupTopicFromApi,
  deleteObservationFromApi,
  fetchGroupCodesFromApi,
  fetchGroupTopicsFromApi,
  fetchObservationsFromApi,
  fetchTeacherSession,
  loadPreviewCodes,
  loadPreviewRecords,
  loadPreviewTopics,
  loginTeacher,
  logoutTeacher,
  savePreviewCodes,
  savePreviewRecords,
  savePreviewTopics,
  type ApiSaveCodeResult,
  type ApiSubmitObservationResult,
  type ApiSubmitTopicResult,
  type ApiTeacherLoginResult,
} from './lib/observationApi';
import type {
  GroupAuthCode,
  GroupTopicRecord,
  ObservationRecord,
  StorageConnectionStatus,
} from './types/observation';

export default function App() {
  const [activeView, setActiveView] = useState<AppView>('lesson0');
  const [teacherInitialTab, setTeacherInitialTab] =
    useState<TeacherStageTab>('lesson1');
  const [storageStatus, setStorageStatus] =
    useState<StorageConnectionStatus>('checking');
  const [apiStatusDetail, setApiStatusDetail] = useState<string | undefined>(
    undefined
  );
  const [isCheckingStorage, setIsCheckingStorage] = useState(false);
  const [isTeacherAuthenticated, setIsTeacherAuthenticated] = useState(false);
  const [isTeacherAuthConfigured, setIsTeacherAuthConfigured] = useState(false);
  const [isRefreshingData, setIsRefreshingData] = useState(false);
  const [lesson1Dirty, setLesson1Dirty] = useState(false);
  const [lesson2Dirty, setLesson2Dirty] = useState(false);
  const [pendingNav, setPendingNav] = useState<{
    targetView: AppView;
    teacherTab: TeacherStageTab;
    title: string;
    description: string;
  } | null>(null);

  // 학생 개인 브라우저 세션에서 방금 제출한 기록만 보관 (타 학생 비공개 응답 차단)
  const [sessionObservations, setSessionObservations] = useState<
    ObservationRecord[]
  >([]);
  const [sessionTopics, setSessionTopics] = useState<GroupTopicRecord[]>([]);

  // 교사 로그인 인증 후에만 채워지는 서버 D1 전체 기록
  const [serverObservations, setServerObservations] = useState<
    ObservationRecord[]
  >([]);
  const [serverTopics, setServerTopics] = useState<GroupTopicRecord[]>([]);
  const [serverCodes, setServerCodes] = useState<GroupAuthCode[]>([]);

  // 서버 미연결 시(로컬 개발 미리보기 등) 사용하는 현재 브라우저 임시 저장 기록
  const [previewObservations, setPreviewObservations] = useState<
    ObservationRecord[]
  >(() => loadPreviewRecords());
  const [previewTopics, setPreviewTopics] = useState<GroupTopicRecord[]>(() =>
    loadPreviewTopics()
  );
  const [previewCodes, setPreviewCodes] = useState<GroupAuthCode[]>(() =>
    loadPreviewCodes()
  );

  const loadTeacherData = useCallback(async () => {
    setIsRefreshingData(true);
    try {
      const [obsRes, topicRes, codeRes] = await Promise.all([
        fetchObservationsFromApi(),
        fetchGroupTopicsFromApi(),
        fetchGroupCodesFromApi(),
      ]);

      if (!obsRes.authorized || !topicRes.authorized || !codeRes.authorized) {
        setIsTeacherAuthenticated(false);
        setServerObservations([]);
        setServerTopics([]);
        setServerCodes([]);
        return;
      }

      if (obsRes.status === 'connected') {
        setServerObservations(obsRes.records);
      }
      if (topicRes.status === 'connected') {
        setServerTopics(topicRes.records);
      }
      if (codeRes.status === 'connected') {
        setServerCodes(codeRes.codes);
      }
    } finally {
      setIsRefreshingData(false);
    }
  }, []);

  const checkStorageAndLoad = useCallback(async () => {
    setIsCheckingStorage(true);
    try {
      const [health, session] = await Promise.all([
        checkApiHealth(),
        fetchTeacherSession(),
      ]);

      const connected = health.status === 'connected';
      setStorageStatus(connected ? 'connected' : 'not-connected');
      setApiStatusDetail(health.message);
      setIsTeacherAuthConfigured(
        health.hasTeacherPassword || session.configured
      );

      if (connected && session.authenticated) {
        setIsTeacherAuthenticated(true);
        await loadTeacherData();
      } else {
        setIsTeacherAuthenticated(false);
        setServerObservations([]);
        setServerTopics([]);
        setServerCodes([]);
      }
    } finally {
      setIsCheckingStorage(false);
    }
  }, [loadTeacherData]);

  useEffect(() => {
    void checkStorageAndLoad();
  }, [checkStorageAndLoad]);

  const handleTeacherLogin = async (
    password: string
  ): Promise<ApiTeacherLoginResult> => {
    const res = await loginTeacher(password);
    if (res.status === 'connected') {
      setStorageStatus('connected');
    }
    if (res.ok && res.authenticated) {
      setIsTeacherAuthenticated(true);
      await loadTeacherData();
    }
    return res;
  };

  const handleTeacherLogout = async () => {
    await logoutTeacher();
    setIsTeacherAuthenticated(false);
    setServerObservations([]);
    setServerTopics([]);
    setServerCodes([]);
  };

  const handleRefreshTeacherData = async () => {
    await checkStorageAndLoad();
  };

  const studentObservations =
    storageStatus === 'connected' ? sessionObservations : previewObservations;
  const studentTopics =
    storageStatus === 'connected' ? sessionTopics : previewTopics;

  const teacherObservations =
    storageStatus === 'connected'
      ? isTeacherAuthenticated
        ? serverObservations
        : []
      : previewObservations;
  const teacherTopics =
    storageStatus === 'connected'
      ? isTeacherAuthenticated
        ? serverTopics
        : []
      : previewTopics;
  const teacherCodes =
    storageStatus === 'connected'
      ? isTeacherAuthenticated
        ? serverCodes
        : []
      : previewCodes;

  const handleObservationSubmitted = (result: ApiSubmitObservationResult) => {
    if (result.failed || !result.record) {
      if (result.status === 'not-connected') {
        setStorageStatus('not-connected');
      }
      return;
    }

    setStorageStatus(result.status);
    if (result.savedToServer) {
      const savedRecord = result.record;
      setSessionObservations((prev) => [savedRecord, ...prev]);
      if (isTeacherAuthenticated) {
        setServerObservations((prev) => [savedRecord, ...prev]);
      }
    } else {
      const previewRecord = result.record;
      setPreviewObservations((prev) => {
        const next = [previewRecord, ...prev];
        savePreviewRecords(next);
        return next;
      });
    }
  };

  const handleTopicSubmitted = (result: ApiSubmitTopicResult) => {
    if (result.failed || !result.record) {
      if (result.status === 'not-connected') {
        setStorageStatus('not-connected');
      }
      return;
    }

    setStorageStatus(result.status);
    const isSameGroup = (a: GroupTopicRecord, b: GroupTopicRecord) =>
      a.classRoom.trim() === b.classRoom.trim() &&
      a.groupName.trim() === b.groupName.trim();

    if (result.savedToServer) {
      const savedRecord = result.record;
      setSessionTopics((prev) => [
        savedRecord,
        ...prev.filter((item) => !isSameGroup(item, savedRecord)),
      ]);
      if (isTeacherAuthenticated) {
        setServerTopics((prev) => [
          savedRecord,
          ...prev.filter((item) => !isSameGroup(item, savedRecord)),
        ]);
      }
    } else {
      const previewRecord = result.record;
      setPreviewTopics((prev) => {
        const next = [
          previewRecord,
          ...prev.filter((item) => !isSameGroup(item, previewRecord)),
        ];
        savePreviewTopics(next);
        return next;
      });
    }
  };

  const handleGroupCodeSaved = (result: ApiSaveCodeResult) => {
    if (result.failed || !result.entry) {
      return;
    }

    setStorageStatus(result.status);
    const sortCodes = (list: GroupAuthCode[]) =>
      list.sort((a, b) => {
        const clsCmp = a.classRoom.localeCompare(b.classRoom, 'ko');
        if (clsCmp !== 0) return clsCmp;
        return a.groupName.localeCompare(b.groupName, 'ko');
      });

    const isSameCodeTarget = (item: GroupAuthCode, entry: GroupAuthCode) =>
      item.classRoom.trim() === entry.classRoom.trim() &&
      item.groupName.trim() === entry.groupName.trim();

    if (result.savedToServer) {
      const savedEntry = result.entry;
      setServerCodes((prev) => {
        const filtered = prev.filter(
          (item) => !isSameCodeTarget(item, savedEntry)
        );
        return sortCodes([...filtered, savedEntry]);
      });
    } else {
      const previewEntry = result.entry;
      setPreviewCodes((prev) => {
        const filtered = prev.filter(
          (item) => !isSameCodeTarget(item, previewEntry)
        );
        const next = sortCodes([...filtered, previewEntry]);
        savePreviewCodes(next);
        return next;
      });
    }
  };

  const handleDeletePreviewObservation = (id: string) => {
    setPreviewObservations((prev) => {
      const next = prev.filter((item) => item.id !== id);
      savePreviewRecords(next);
      return next;
    });
  };

  const handleDeleteObservation = async (id: string) => {
    const res = await deleteObservationFromApi(id);
    if (res.failed) return;

    setServerObservations((prev) => prev.filter((item) => item.id !== id));
    setSessionObservations((prev) => prev.filter((item) => item.id !== id));
    setPreviewObservations((prev) => {
      const next = prev.filter((item) => item.id !== id);
      savePreviewRecords(next);
      return next;
    });
  };

  const handleDeletePreviewTopic = (id: string) => {
    setPreviewTopics((prev) => {
      const next = prev.filter((item) => item.id !== id);
      savePreviewTopics(next);
      return next;
    });
  };

  const handleDeleteTopic = async (id: string) => {
    const res = await deleteGroupTopicFromApi(id);
    if (res.failed) return;

    setServerTopics((prev) => prev.filter((item) => item.id !== id));
    setSessionTopics((prev) => prev.filter((item) => item.id !== id));
    setPreviewTopics((prev) => {
      const next = prev.filter((item) => item.id !== id);
      savePreviewTopics(next);
      return next;
    });
  };

  const handleDeleteGroupCode = async (
    classRoom: string,
    groupName: string
  ) => {
    const res = await deleteGroupCodeFromApi(classRoom, groupName);
    if (res.failed) return;

    const isTarget = (item: GroupAuthCode) =>
      item.classRoom.trim() === classRoom.trim() &&
      item.groupName.trim() === groupName.trim();

    setServerCodes((prev) => prev.filter((item) => !isTarget(item)));
    setPreviewCodes((prev) => {
      const next = prev.filter((item) => !isTarget(item));
      savePreviewCodes(next);
      return next;
    });
  };

  const handleClearAllPreview = () => {
    clearPreviewRecords();
    clearPreviewTopics();
    clearPreviewCodes();
    setPreviewObservations([]);
    setPreviewTopics([]);
    setPreviewCodes([]);
  };

  const performNavigate = useCallback(
    (view: AppView, teacherTab: TeacherStageTab = 'lesson1') => {
      if (view === 'teacher') {
        setTeacherInitialTab(teacherTab);
      }
      setPendingNav(null);
      setLesson1Dirty(false);
      setLesson2Dirty(false);
      setActiveView(view);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    []
  );

  const requestNavigate = (
    targetView: AppView,
    teacherTab: TeacherStageTab = 'lesson1'
  ) => {
    if (targetView === activeView) return;

    if (
      activeView === 'lesson1' &&
      (lesson1Dirty || studentObservations.length === 0)
    ) {
      setPendingNav({
        targetView,
        teacherTab,
        title: lesson1Dirty
          ? '작성 중인 1차시 관찰 일지를 아직 제출하지 않았습니다'
          : '아직 1차시 개인 관찰 일지를 제출하지 않았습니다',
        description: lesson1Dirty
          ? '제출하기 전에 다른 화면으로 이동하면 입력 중인 내용이 저장되지 않고 사라집니다. 그래도 이동할까요?'
          : '개인 관찰 일지를 제출한 뒤 다음 활동으로 넘어가는 것을 권장합니다. 제출 없이 다른 화면으로 이동할까요?',
      });
      return;
    }

    if (
      activeView === 'lesson2' &&
      (lesson2Dirty || studentTopics.length === 0)
    ) {
      setPendingNav({
        targetView,
        teacherTab,
        title: lesson2Dirty
          ? '작성 중인 2차시 모둠 주제를 아직 제출하지 않았습니다'
          : '아직 2차시 모둠별 프로젝트 주제를 제출하지 않았습니다',
        description: lesson2Dirty
          ? '제출하기 전에 다른 화면으로 이동하면 입력 중인 내용이 저장되지 않고 사라집니다. 그래도 이동할까요?'
          : '모둠별 최종 프로젝트 주제를 제출한 뒤 이동하는 것을 권장합니다. 제출 없이 다른 화면으로 이동할까요?',
      });
      return;
    }

    performNavigate(targetView, teacherTab);
  };

  useEffect(() => {
    if (!lesson1Dirty && !lesson2Dirty) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [lesson1Dirty, lesson2Dirty]);

  useEffect(() => {
    if (!pendingNav) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPendingNav(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pendingNav]);

  const showTopBarCounts =
    storageStatus === 'not-connected' || isTeacherAuthenticated;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <TopBar
        activeView={activeView}
        onSelectView={(view) => requestNavigate(view, 'lesson1')}
        observationCount={teacherObservations.length}
        topicCount={teacherTopics.length}
        showCounts={showTopBarCounts}
      />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {activeView === 'lesson0' && (
          <div className="space-y-6">
            <StorageStatusNotice
              status={storageStatus}
              statusDetail={apiStatusDetail}
              onRetryCheck={checkStorageAndLoad}
              isChecking={isCheckingStorage}
              context="student"
            />

            {/* 0차시 페이지: 활동 시작 안내 */}
            <section
              aria-labelledby="cover-hero-title"
              className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-10"
            >
              <div className="grid gap-8 lg:grid-cols-12 lg:items-center">
                <div className="space-y-5 lg:col-span-7">
                  <p className="text-xs font-medium text-emerald-800">
                    중학교 1학년 정보(기술 융합) · 읽걷쓰AI 프로젝트
                  </p>
                  <h1
                    id="cover-hero-title"
                    className="text-2xl font-bold tracking-tight text-slate-900 sm:text-4xl"
                  >
                    피지컬 컴퓨팅으로 만드는 스마트 에코 스쿨
                  </h1>
                  <p className="max-w-2xl text-base leading-relaxed text-slate-700 sm:text-lg">
                    학교 공간을 둘러보며 에너지가 낭비되는 곳을 찾고, 사진과
                    짧은 관찰 기록으로 남기며 오늘의 활동을 시작해 보세요.
                  </p>
                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => requestNavigate('lesson1')}
                      className="inline-flex min-h-[50px] items-center justify-center rounded-xl bg-emerald-700 px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-emerald-800 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
                    >
                      활동 시작하기
                    </button>
                  </div>
                </div>

                <div className="space-y-4 lg:col-span-5">
                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-5 space-y-3">
                    <p className="text-xs font-semibold text-slate-500">
                      앞으로 진행할 활동 한눈에 보기
                    </p>
                    <ol className="space-y-2.5 text-sm text-slate-700">
                      <li className="flex items-start gap-2.5">
                        <span className="font-semibold text-emerald-800 tabular-nums">
                          1차시.
                        </span>
                        <span>
                          학교 공간에서 에너지 낭비 장면 찾고 사진·관찰 일지
                          작성하기
                        </span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <span className="font-semibold text-emerald-800 tabular-nums">
                          2차시.
                        </span>
                        <span>
                          모둠별 결과 모아보고 우리 모둠 최종 프로젝트 주제
                          선정하기
                        </span>
                      </li>
                    </ol>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-1.5">
                    <p className="text-xs font-semibold text-emerald-800">
                      프로젝트 관통 질문
                    </p>
                    <p className="text-sm font-semibold leading-relaxed text-slate-900">
                      “무심코 낭비되는 우리 학교의 에너지를, 센서와 코딩을
                      활용해 어떻게 똑똑하게 스스로 아끼는 공간으로 바꿀 수
                      있을까?”
                    </p>
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}

        {activeView === 'lesson1' && (
          <div className="space-y-6">
            <Lesson1PageHeader />

            <StorageStatusNotice
              status={storageStatus}
              statusDetail={apiStatusDetail}
              onRetryCheck={checkStorageAndLoad}
              isChecking={isCheckingStorage}
              context="student"
            />

            <Lesson1FlowSection />

            <div className="grid gap-8 lg:grid-cols-12 lg:items-start">
              <div className="lg:col-span-5">
                <LessonGuidePanel />
              </div>
              <div className="lg:col-span-7">
                <StudentObservationForm
                  onObservationSubmitted={handleObservationSubmitted}
                  sessionRecords={studentObservations}
                  onDeletePreviewRecord={handleDeletePreviewObservation}
                  onGoToLesson2={() => requestNavigate('lesson2')}
                  onDirtyChange={setLesson1Dirty}
                />
              </div>
            </div>
          </div>
        )}

        {activeView === 'lesson2' && (
          <GroupTopicSelectionView
            observations={studentObservations}
            topics={studentTopics}
            groupCodes={storageStatus === 'connected' ? [] : previewCodes}
            storageStatus={storageStatus}
            statusDetail={apiStatusDetail}
            isCheckingStorage={isCheckingStorage}
            onRetryConnection={checkStorageAndLoad}
            onTopicSubmitted={handleTopicSubmitted}
            onDeletePreviewTopic={handleDeletePreviewTopic}
            onDirtyChange={setLesson2Dirty}
          />
        )}

        {activeView === 'teacher' && (
          <TeacherReviewView
            key={teacherInitialTab}
            observations={teacherObservations}
            topics={teacherTopics}
            groupCodes={teacherCodes}
            initialTab={teacherInitialTab}
            storageStatus={storageStatus}
            statusDetail={apiStatusDetail}
            isCheckingStorage={isCheckingStorage}
            isTeacherAuthenticated={isTeacherAuthenticated}
            isTeacherAuthConfigured={isTeacherAuthConfigured}
            isRefreshingData={isRefreshingData}
            onTeacherLogin={handleTeacherLogin}
            onTeacherLogout={handleTeacherLogout}
            onRefreshData={handleRefreshTeacherData}
            onRetryConnection={checkStorageAndLoad}
            onClearPreviewRecords={handleClearAllPreview}
            onDeleteObservation={(id) => void handleDeleteObservation(id)}
            onDeleteTopic={(id) => void handleDeleteTopic(id)}
            onGroupCodeSaved={handleGroupCodeSaved}
            onDeleteGroupCode={(cls, grp) =>
              void handleDeleteGroupCode(cls, grp)
            }
            onGoToLesson1={() => performNavigate('lesson1')}
            onGoToLesson2={() => performNavigate('lesson2')}
          />
        )}
      </main>

      {pendingNav && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="leave-warning-title"
          onClick={() => setPendingNav(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xl space-y-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 text-amber-700">
                  <AlertTriangle className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="space-y-1">
                  <h2
                    id="leave-warning-title"
                    className="text-base font-bold text-slate-900"
                  >
                    {pendingNav.title}
                  </h2>
                  <p className="text-sm leading-relaxed text-slate-600">
                    {pendingNav.description}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPendingNav(null)}
                aria-label="경고 창 닫기"
                className="flex min-h-[36px] min-w-[36px] shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() =>
                  performNavigate(pendingNav.targetView, pendingNav.teacherTab)
                }
                className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
              >
                그래도 이동하기
              </button>
              <button
                type="button"
                onClick={() => setPendingNav(null)}
                className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 whitespace-nowrap"
              >
                현재 화면에 남기
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span>
            피지컬 컴퓨팅으로 만드는 스마트 에코 스쿨 · 1차시·2차시 활동
          </span>
          <span>
            저장 경로 준비: same-origin /api/observations · /api/group-topics ·
            /api/group-codes
          </span>
        </div>
      </footer>
    </div>
  );
}
