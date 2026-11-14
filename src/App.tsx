import { useCallback, useEffect, useState } from 'react';
import { TopBar, type AppView } from './components/TopBar';
import { StorageStatusNotice } from './components/StorageStatusNotice';
import { LessonGuidePanel } from './components/LessonGuidePanel';
import { StudentObservationForm } from './components/StudentObservationForm';
import { GroupTopicSelectionView } from './components/GroupTopicSelectionView';
import { TeacherReviewView } from './components/TeacherReviewView';
import {
  clearPreviewRecords,
  clearPreviewTopics,
  fetchGroupTopicsFromApi,
  fetchObservationsFromApi,
  loadPreviewRecords,
  loadPreviewTopics,
  savePreviewRecords,
  savePreviewTopics,
  type ApiSubmitObservationResult,
  type ApiSubmitTopicResult,
} from './lib/observationApi';
import type {
  GroupTopicRecord,
  ObservationRecord,
  StorageConnectionStatus,
} from './types/observation';

export default function App() {
  const [activeView, setActiveView] = useState<AppView>('lesson1');
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

  const checkStorageAndLoad = useCallback(async () => {
    setIsCheckingStorage(true);
    try {
      const [obsRes, topicRes] = await Promise.all([
        fetchObservationsFromApi(),
        fetchGroupTopicsFromApi(),
      ]);

      const connected =
        obsRes.status === 'connected' || topicRes.status === 'connected';
      setStorageStatus(connected ? 'connected' : 'not-connected');

      if (obsRes.status === 'connected') {
        setServerObservations(obsRes.records);
      }
      if (topicRes.status === 'connected') {
        setServerTopics(topicRes.records);
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

  const handleClearAllPreview = () => {
    clearPreviewRecords();
    clearPreviewTopics();
    setPreviewObservations([]);
    setPreviewTopics([]);
  };

  const navigateTo = (view: AppView) => {
    setActiveView(view);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <TopBar
        activeView={activeView}
        onSelectView={navigateTo}
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

            <div className="grid gap-8 lg:grid-cols-12 lg:items-start">
              <div className="lg:col-span-5">
                <LessonGuidePanel />
              </div>
              <div className="lg:col-span-7">
                <StudentObservationForm
                  onObservationSubmitted={handleObservationSubmitted}
                  sessionRecords={combinedObservations}
                  onDeletePreviewRecord={handleDeletePreviewObservation}
                  onGoToTeacherView={() => navigateTo('teacher')}
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
            storageStatus={storageStatus}
            isCheckingStorage={isCheckingStorage}
            onRetryConnection={checkStorageAndLoad}
            onTopicSubmitted={handleTopicSubmitted}
            onDeletePreviewTopic={handleDeletePreviewTopic}
            onGoToTeacherView={() => navigateTo('teacher')}
          />
        )}

        {activeView === 'teacher' && (
          <TeacherReviewView
            observations={combinedObservations}
            topics={combinedTopics}
            storageStatus={storageStatus}
            isCheckingStorage={isCheckingStorage}
            onRetryConnection={checkStorageAndLoad}
            onClearPreviewRecords={handleClearAllPreview}
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
            저장 경로 준비: same-origin /api/observations · /api/group-topics
          </span>
        </div>
      </footer>
    </div>
  );
}
