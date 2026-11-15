import React from 'react';

export type AppView = 'lesson0' | 'lesson1' | 'lesson2' | 'teacher';

interface TopBarProps {
  activeView: AppView;
  onSelectView: (view: AppView) => void;
  observationCount: number;
  topicCount: number;
  showCounts?: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeView,
  onSelectView,
  observationCount,
  topicCount,
  showCounts = false,
}) => {
  const isTeacherMode = activeView === 'teacher';

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-4 py-3.5 sm:px-6">
        <button
          type="button"
          onClick={() => onSelectView('lesson0')}
          className="text-left text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
        >
          스마트 에코 스쿨
        </button>

        <nav
          aria-label="수업 단계 이동"
          className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600"
        >
          <button
            type="button"
            onClick={() => onSelectView('lesson1')}
            className={`py-1.5 border-b-2 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 ${
              activeView === 'lesson1'
                ? 'border-emerald-700 text-emerald-800 font-semibold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            1차시 · 개인 관찰 일지
          </button>
          <button
            type="button"
            onClick={() => onSelectView('lesson2')}
            className={`py-1.5 border-b-2 transition-colors whitespace-nowrap shrink-0 tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 ${
              activeView === 'lesson2'
                ? 'border-emerald-700 text-emerald-800 font-semibold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            2차시 · 모둠별 프로젝트 주제 선정
            {showCounts ? ` (${topicCount})` : ''}
          </button>
          {isTeacherMode && (
            <span className="py-1.5 border-b-2 border-emerald-700 text-emerald-800 font-semibold whitespace-nowrap shrink-0 tabular-nums">
              교사 확인{showCounts ? ` (${observationCount + topicCount})` : ''}
            </span>
          )}
        </nav>

        <div className="flex items-center shrink-0">
          {isTeacherMode ? (
            <button
              type="button"
              onClick={() => onSelectView('lesson1')}
              className="min-h-[40px] rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-800 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
            >
              학생 활동 화면
            </button>
          ) : (
            <span className="hidden sm:inline-block text-xs font-medium text-slate-500 whitespace-nowrap">
              중학교 1학년 · 읽걷쓰AI 프로젝트
            </span>
          )}
        </div>
      </div>

      {/* Mobile navigation strip with >=44px touch targets */}
      <div className="border-t border-slate-100 bg-slate-50/70 px-3 py-2 md:hidden">
        <div
          className={`grid gap-1.5 ${
            isTeacherMode ? 'grid-cols-3' : 'grid-cols-2'
          }`}
        >
          <button
            type="button"
            onClick={() => onSelectView('lesson1')}
            className={`min-h-[44px] rounded-lg px-2 text-xs font-semibold whitespace-nowrap shrink-0 ${
              activeView === 'lesson1'
                ? 'bg-white text-emerald-800 shadow-xs ring-1 ring-slate-200'
                : 'text-slate-700 hover:bg-white'
            }`}
          >
            1차시 관찰
          </button>
          <button
            type="button"
            onClick={() => onSelectView('lesson2')}
            className={`min-h-[44px] rounded-lg px-2 text-xs font-semibold whitespace-nowrap shrink-0 ${
              activeView === 'lesson2'
                ? 'bg-white text-emerald-800 shadow-xs ring-1 ring-slate-200'
                : 'text-slate-700 hover:bg-white'
            }`}
          >
            2차시 주제 선정
          </button>
          {isTeacherMode && (
            <button
              type="button"
              onClick={() => onSelectView('teacher')}
              className="min-h-[44px] rounded-lg px-2 text-xs font-semibold tabular-nums whitespace-nowrap shrink-0 bg-white text-emerald-800 shadow-xs ring-1 ring-slate-200"
            >
              교사 확인{showCounts ? ` (${observationCount + topicCount})` : ''}
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

