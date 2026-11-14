import { useCallback, useEffect, useState } from 'react';
import { TopBar, type AppView } from './components/TopBar';
import { StorageStatusNotice } from './components/StorageStatusNotice';
import { LessonGuidePanel } from './components/LessonGuidePanel';
import { StudentObservationForm } from './components/StudentObservationForm';
import { GroupTopicSelectionView } from './components/GroupTopicSelectionView';
import {
  TeacherReviewView,
  type TeacherStageTab,
} from './components/TeacherReviewView';
import {
  clearPreviewCodes,
  clearPreviewRecords,
  clearPreviewTopics,
  fetchGroupCodesFromApi,
  fetchGroupTopicsFromApi,
  fetchObservationsFromApi,
  loadPreviewCodes,
  loadPreviewRecords,
  loadPreviewTopics,
  savePreviewCodes,
  savePreviewRecords,
  savePreviewTopics,
  type ApiSaveCodeResult,
  type ApiSubmitObservationResult,
  type ApiSubmitTopicResult,
} from './lib/observationApi';
import type {
  GroupAuthCode,
  GroupTopicRecord,
  ObservationRecord,
  StorageConnectionStatus,
} from './types/observation';

export default function App() {
  const [activeView, setActiveView] = useState<AppView>('lesson1');
  const [teacherInitialTab, setTeacherInitialTab] =
    useState<TeacherStageTab>('lesson1');
  const [storageStatus, setStorageStatus] =
    useState<StorageConnectionStatus>('checking');
  const [isCheckingStorage, setIsCheckingStorage] = useState(false);

  const [serverObservations, setServerObservations] = useState<
    ObservationRecord[]
  >([]);
  const [previewObservations, setPreviewObservations] = useState<
    ObservationRecord[]
  >(() => loadPreviewRecords());

  const [serverTopics, setServerTopics] = useState<GroupTopicRecord[]>([]);
  const [previewTopics, setPreviewTopics] = useState<GroupTopicRecord[]>(() =>
    loadPreviewTopics()
  );

  const [serverCodes, setServerCodes] = useState<GroupAuthCode[]>([]);
  const [previewCodes, setPreviewCodes] = useState<GroupAuthCode[]>(() =>
    loadPreviewCodes()
  );

  const checkStorageAndLoad = useCallback(async () => {
    setIsCheckingStorage(true);
    try {
      const [obsRes, topicRes, codeRes] = await Promise.all([
        fetchObservationsFromApi(),
        fetchGroupTopicsFromApi(),
        fetchGroupCodesFromApi(),
      ]);

      const connected =
        obsRes.status === 'connected' ||
        topicRes.status === 'connected' ||
        codeRes.status === 'connected';
      setStorageStatus(connected ? 'connected' : 'not-connected');

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
      setIsCheckingStorage(false);
    }
  }, []);

  useEffect(() => {
    void checkStorageAndLoad();
  }, [checkStorageAndLoad]);

  const combinedObservations =
    storageStatus === 'connected' ? serverObservations : previewObservations;
  const combinedTopics =
    storageStatus === 'connected' ? serverTopics : previewTopics;
  const combinedCodes =
    storageStatus === 'connected' ? serverCodes : previewCodes;

  const handleObservationSubmitted = (result: ApiSubmitObservationResult) => {
    setStorageStatus(result.status);
    if (result.savedToServer) {
      setServerObservations((prev) => [result.record, ...prev]);
    } else {
      setPreviewObservations((prev) => {
        const next = [result.record, ...prev];
        savePreviewRecords(next);
        return next;
      });
    }
  };

  const handleTopicSubmitted = (result: ApiSubmitTopicResult) => {
    setStorageStatus(result.status);
    if (result.savedToServer) {
      setServerTopics((prev) => [result.record, ...prev]);
    } else {
      setPreviewTopics((prev) => {
        const next = [result.record, ...prev];
        savePreviewTopics(next);
        return next;
      });
    }
  };

  const handleGroupCodeSaved = (result: ApiSaveCodeResult) => {
    setStorageStatus(result.status);
    if (result.savedToServer) {
      setServerCodes((prev) => {
        const filtered = prev.filter(
          (item) => item.groupName !== result.entry.groupName
        );
        return [...filtered, result.entry].sort((a, b) =>
          a.groupName.localeCompare(b.groupName, 'ko')
        );
      });
    } else {
      setPreviewCodes((prev) => {
        const filtered = prev.filter(
          (item) => item.groupName !== result.entry.groupName
        );
        const next = [...filtered, result.entry].sort((a, b) =>
          a.groupName.localeCompare(b.groupName, 'ko')
        );
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

  const handleDeletePreviewTopic = (id: string) => {
    setPreviewTopics((prev) => {
      const next = prev.filter((item) => item.id !== id);
      savePreviewTopics(next);
      return next;
    });
  };

  const handleDeletePreviewGroupCode = (groupName: string) => {
    setPreviewCodes((prev) => {
      const next = prev.filter((item) => item.groupName !== groupName);
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

  const navigateTo = (view: AppView, teacherTab: TeacherStageTab = 'lesson1') => {
    if (view === 'teacher') {
      setTeacherInitialTab(teacherTab);
    }
    setActiveView(view);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <TopBar
        activeView={activeView}
        onSelectView={(view) => navigateTo(view, 'lesson1')}
        observationCount={combinedObservations.length}
        topicCount={combinedTopics.length}
      />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {activeView === 'lesson1' && (
          <div className="space-y-6">
            <StorageStatusNotice
              status={storageStatus}
              onRetryCheck={checkStorageAndLoad}
              isChecking={isCheckingStorage}
              context="student"
            />

            {/* 첫 화면 표지: 활동 시작 안내 */}
            <section
              aria-labelledby="cover-hero-title"
              className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8"
            >
              <div className="grid gap-6 lg:grid-cols-12 lg:items-center">
                <div className="space-y-4 lg:col-span-8">
                  <p className="text-xs font-medium text-emerald-800">
                    중학교 1학년 정보(기술 융합) · 읽걷쓰AI 프로젝트 · 1차시
                  </p>
                  <h1
                    id="cover-hero-title"
                    className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl"
                  >
                    피지컬 컴퓨팅으로 만드는 스마트 에코 스쿨
                  </h1>
                  <p className="max-w-2xl text-base leading-relaxed text-slate-700">
                    학교 공간을 둘러보며 에너지가 낭비되는 곳을 찾고, 사진과
                    짧은 관찰 기록으로 남기며 오늘의 활동을 시작해 보세요.
                  </p>
                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        const formEl =
                          document.getElementById('observation-form');
                        formEl?.scrollIntoView({
                          behavior: 'smooth',
                          block: 'start',
                        });
                        window.setTimeout(() => {
                          document.getElementById('class-info')?.focus();
                        }, 350);
                      }}
                      className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-emerald-700 px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-emerald-800 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
                    >
                      활동 시작하기
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        document
                          .getElementById('lesson-guide')
                          ?.scrollIntoView({
                            behavior: 'smooth',
                            block: 'start',
                          });
                      }}
                      className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
                    >
                      수업 안내 먼저 보기
                    </button>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5 lg:col-span-4 space-y-2.5">
                  <p className="text-xs font-semibold text-slate-500">
                    오늘 할 일 한눈에 보기
                  </p>
                  <ol className="space-y-2 text-sm text-slate-700">
                    <li className="flex items-start gap-2">
                      <span className="font-semibold text-emerald-800 tabular-nums">
                        01.
                      </span>
                      <span>학교 공간에서 에너지 낭비 장면 찾기</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-semibold text-emerald-800 tabular-nums">
                        02.
                      </span>
                      <span>현장 사진 찍고 개인 관찰 일지 입력하기</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-semibold text-emerald-800 tabular-nums">
                        03.
                      </span>
                      <span>모둠별 결과 확인 후 2차시 주제 준비하기</span>
                    </li>
                  </ol>
                </div>
              </div>
            </section>

            <div className="grid gap-8 lg:grid-cols-12 lg:items-start">
              <div className="lg:col-span-5">
                <LessonGuidePanel />
              </div>
              <div className="lg:col-span-7">
                <StudentObservationForm
                  onObservationSubmitted={handleObservationSubmitted}
                  sessionRecords={combinedObservations}
                  onDeletePreviewRecord={handleDeletePreviewObservation}
                  onGoToTeacherView={() => navigateTo('teacher', 'lesson1')}
                  onGoToLesson2={() => navigateTo('lesson2')}
                />
              </div>
            </div>
          </div>
        )}

        {activeView === 'lesson2' && (
          <GroupTopicSelectionView
            observations={combinedObservations}
            topics={combinedTopics}
            groupCodes={combinedCodes}
            storageStatus={storageStatus}
            isCheckingStorage={isCheckingStorage}
            onRetryConnection={checkStorageAndLoad}
            onTopicSubmitted={handleTopicSubmitted}
            onDeletePreviewTopic={handleDeletePreviewTopic}
            onGoToTeacherView={() => navigateTo('teacher', 'lesson2')}
            onGoToTeacherCodes={() => navigateTo('teacher', 'codes')}
          />
        )}

        {activeView === 'teacher' && (
          <TeacherReviewView
            key={teacherInitialTab}
            observations={combinedObservations}
            topics={combinedTopics}
            groupCodes={combinedCodes}
            initialTab={teacherInitialTab}
            storageStatus={storageStatus}
            isCheckingStorage={isCheckingStorage}
            onRetryConnection={checkStorageAndLoad}
            onClearPreviewRecords={handleClearAllPreview}
            onGroupCodeSaved={handleGroupCodeSaved}
            onDeletePreviewGroupCode={handleDeletePreviewGroupCode}
            onGoToLesson1={() => navigateTo('lesson1')}
            onGoToLesson2={() => navigateTo('lesson2')}
          />
        )}
      </main>

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
