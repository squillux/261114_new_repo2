import React, { useMemo, useState } from 'react';
import {
  Clock,
  FileText,
  Maximize2,
  Search,
  Trash2,
  User,
  Users,
  X,
} from 'lucide-react';
import type {
  GroupTopicRecord,
  ObservationRecord,
  StorageConnectionStatus,
} from '../types/observation';
import { StorageStatusNotice } from './StorageStatusNotice';

interface TeacherReviewViewProps {
  observations: ObservationRecord[];
  topics: GroupTopicRecord[];
  storageStatus: StorageConnectionStatus;
  isCheckingStorage: boolean;
  onRetryConnection: () => void;
  onClearPreviewRecords: () => void;
  onGoToLesson1: () => void;
  onGoToLesson2: () => void;
}

type TeacherStageTab = 'lesson1' | 'lesson2';
type Lesson1DisplayMode = 'by-group' | 'by-individual';

export const TeacherReviewView: React.FC<TeacherReviewViewProps> = ({
  observations,
  topics,
  storageStatus,
  isCheckingStorage,
  onRetryConnection,
  onClearPreviewRecords,
  onGoToLesson1,
  onGoToLesson2,
}) => {
  const [stageTab, setStageTab] = useState<TeacherStageTab>('lesson1');
  const [displayMode, setDisplayMode] =
    useState<Lesson1DisplayMode>('by-group');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>('all');
  const [locationFilter, setLocationFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [enlargedPhoto, setEnlargedPhoto] = useState<{
    src: string;
    title: string;
  } | null>(null);

  const groupBuckets = useMemo(() => {
    const map = new Map<string, ObservationRecord[]>();
    observations.forEach((obs) => {
      const key = obs.groupName.trim() || '모둠 미지정';
      const existing = map.get(key) || [];
      existing.push(obs);
      map.set(key, existing);
    });
    return Array.from(map.entries()).sort(([a], [b]) =>
      a.localeCompare(b, 'ko')
    );
  }, [observations]);

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
      const groupKey = item.groupName.trim() || '모둠 미지정';
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
  }, [observations, selectedGroupFilter, locationFilter, searchQuery]);

  const filteredGroupBuckets = useMemo(() => {
    const map = new Map<string, ObservationRecord[]>();
    filteredObservations.forEach((obs) => {
      const key = obs.groupName.trim() || '모둠 미지정';
      const existing = map.get(key) || [];
      existing.push(obs);
      map.set(key, existing);
    });
    return Array.from(map.entries()).sort(([a], [b]) =>
      a.localeCompare(b, 'ko')
    );
  }, [filteredObservations]);

  const filteredTopics = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return topics.filter((topic) => {
      if (
        selectedGroupFilter !== 'all' &&
        topic.groupName.trim() !== selectedGroupFilter
      ) {
        return false;
      }
      if (!q) return true;
      return [
        topic.classInfo,
        topic.groupName,
        topic.groupMembers,
        topic.selectedLocation,
        topic.projectTitle,
        topic.coreQuestion,
        topic.selectionReason,
        topic.controlConditionDraft,
      ]
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [topics, selectedGroupFilter, searchQuery]);

  const stats = useMemo(() => {
    const photoCount = observations.filter((r) => Boolean(r.photoDataUrl)).length;
    return {
      observations: observations.length,
      groupsWithObs: groupBuckets.length,
      photos: photoCount,
      topics: topics.length,
    };
  }, [observations, groupBuckets.length, topics.length]);

  const hasPreviewOnlyRecords =
    observations.some((r) => r.syncState === 'preview-only') ||
    topics.some((t) => t.syncState === 'preview-only');

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500">
            교사 확인 화면 · 1차시 개인·모둠별 결과 및 2차시 모둠 주제 확인
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            수업 활동 결과 모아보기
          </h1>
        </div>
        {hasPreviewOnlyRecords && (
          <button
            type="button"
            onClick={onClearPreviewRecords}
            className="inline-flex min-h-[44px] items-center justify-center gap-1.5 self-start rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0 sm:self-auto"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>임시 미리보기 비우기</span>
          </button>
        )}
      </div>

      <StorageStatusNotice
        status={storageStatus}
        onRetryCheck={onRetryConnection}
        isChecking={isCheckingStorage}
        context="teacher"
      />

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
          <p className="text-xs font-medium text-slate-500">2차시 확정 주제</p>
          <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">
            {stats.topics}건
          </p>
        </div>
      </div>

      {/* 차시 탭 & 보기 방식 */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setStageTab('lesson1')}
              className={`min-h-[40px] rounded-md px-3.5 py-1.5 text-sm font-semibold transition-colors whitespace-nowrap shrink-0 tabular-nums ${
                stageTab === 'lesson1'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              1차시 · 개인 관찰 결과 ({observations.length})
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
          </div>

          {stageTab === 'lesson1' && (
            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 self-start sm:self-auto">
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
          )}
        </div>

        {/* 모둠/공간/검색 필터 */}
        <div className="flex flex-col gap-3 border-t border-slate-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
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
            {groupBuckets.map(([groupName, items]) => (
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
                {groupName} ({items.length})
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
              placeholder="모둠, 이름, 장소, 내용 검색"
              aria-label="결과 검색"
              className="min-h-[40px] w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20"
            />
          </div>
        </div>
      </div>

      {/* 본문 영역 */}
      {stageTab === 'lesson1' ? (
        filteredObservations.length === 0 ? (
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
                ? '학생들이 개인 관찰 일지와 현장 사진을 제출하면 이곳에서 모둠별로 묶어 한눈에 보여줄 수 있습니다.'
                : '모둠 필터나 검색어를 바꾸어 다시 확인해 보세요.'}
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
            {filteredGroupBuckets.map(([groupName, items]) => (
              <section
                key={groupName}
                aria-label={`${groupName} 관찰 결과`}
                className="rounded-xl border border-slate-200 bg-white p-5 space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Users
                      className="h-4 w-4 text-emerald-700"
                      aria-hidden="true"
                    />
                    <h2 className="text-lg font-bold text-slate-900">
                      {groupName}
                    </h2>
                    <span className="text-xs font-medium text-slate-500 tabular-nums">
                      · 개인 관찰 {items.length}건 · 사진{' '}
                      {items.filter((i) => Boolean(i.photoDataUrl)).length}장
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={onGoToLesson2}
                    className="min-h-[38px] rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    2차시 주제 선정으로 연결
                  </button>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  {items.map((item) => {
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
                          <span className="inline-flex items-center gap-1 tabular-nums">
                            <Clock className="h-3 w-3" aria-hidden="true" />
                            {formatDateTime(item.createdAt)}
                          </span>
                        </div>

                        {item.photoDataUrl && (
                          <div className="space-y-1.5">
                            <div className="group relative overflow-hidden rounded-lg border border-slate-200 bg-white">
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
                                    title: `${groupName} · ${item.authorName} (${displayLocation})`,
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
                        )}

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
            ))}
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
                        {item.groupName || '모둠 미지정'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-semibold text-slate-900">
                        {item.classInfo} {item.authorName}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{displayLocation}</span>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-500 tabular-nums">
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
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-12">
                    {item.photoDataUrl && (
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
                                title: `${item.groupName} · ${item.authorName} (${displayLocation})`,
                              })
                            }
                            className="absolute right-2 bottom-2 inline-flex min-h-[34px] items-center gap-1 rounded-md bg-slate-900/80 px-2 py-1 text-xs font-medium text-white hover:bg-slate-900"
                          >
                            <Maximize2
                              className="h-3 w-3"
                              aria-hidden="true"
                            />
                            <span>크게</span>
                          </button>
                        </div>
                      </div>
                    )}

                    <div
                      className={`grid gap-4 sm:grid-cols-2 ${
                        item.photoDataUrl ? 'md:col-span-8' : 'md:col-span-12'
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
        )
      ) : filteredTopics.length === 0 ? (
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
            2차시 「모둠별 프로젝트 주제 선정」 페이지에서 모둠별 최종 주제와
            핵심 질문을 작성하면 이곳에 모여 보입니다.
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
                    {topic.groupName}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-medium text-slate-800">
                    {topic.classInfo}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>모둠원: {topic.groupMembers}</span>
                  <span aria-hidden="true">·</span>
                  <span>선정 공간: {topic.selectedLocation}</span>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-500 tabular-nums">
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
                            title: `${topic.groupName} · ${topic.projectTitle}`,
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
                        선정 이유
                      </p>
                      <p className="mt-0.5 text-sm leading-relaxed text-slate-700">
                        {topic.selectionReason}
                      </p>
                    </div>
                    {topic.controlConditionDraft && (
                      <div>
                        <p className="text-xs font-semibold text-slate-500">
                          제어 조건 초안 (자연어)
                        </p>
                        <p className="mt-0.5 text-sm leading-relaxed text-slate-800">
                          {topic.controlConditionDraft}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
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
