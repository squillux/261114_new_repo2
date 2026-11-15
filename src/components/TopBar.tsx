import React from 'react';

export type AppView =
  | 'lesson0'
  | 'lesson1'
  | 'lesson2'
  | 'lesson5'
  | 'lesson6'
  | 'teacher';

interface TopBarProps {
  activeView: AppView;
  onSelectView: (view: AppView) => void;
  observationCount: number;
  topicCount: number;
  showCounts?: boolean;
}

const LESSON_NAV: { view: AppView; label: string; short: string }[] = [
  { view: 'lesson1', label: '2차시 · 개인 관찰 일지', short: '2차시 관찰' },
  { view: 'lesson2', label: '3~4차시 · 모둠별 프로젝트 주제 선정', short: '3~4차시 주제' },
  { view: 'lesson5', label: '7차시 · 조감도 프롬프트', short: '7차시 프롬프트' },
  { view: 'lesson6', label: '8차시 · 조감도 판단', short: '8차시 조감도' },
];

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
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-5 gap-y-2 px-4 py-3.5 sm:px-6">
        <button
          type="button"
          onClick={() => onSelectView('lesson0')}
          className="text-left text-lg font-bold tracking-tight text-slate-900 shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
        >
          우리 학교 에너지 지킴이
        </button>

        <nav
          aria-label="수업 단계 이동"
          className="hidden md:flex flex-wrap items-center gap-x-5 gap-y-1 text-sm font-medium text-slate-600"
        >
          {LESSON_NAV.map((item) => (
            <button
              key={item.view}
              type="button"
              onClick={() => onSelectView(item.view)}
              className={`py-1.5 border-b-2 transition-colors tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 ${
                activeView === item.view
                  ? 'border-emerald-700 text-emerald-800 font-semibold'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              {item.label}
              {item.view === 'lesson2' && showCounts ? ` (${topicCount})` : ''}
            </button>
          ))}
          {isTeacherMode && (
            <span className="py-1.5 border-b-2 border-emerald-700 text-emerald-800 font-semibold tabular-nums">
              교사 확인{showCounts ? ` (${observationCount + topicCount})` : ''}
            </span>
          )}
        </nav>

        <div className="flex items-center shrink-0">
          {isTeacherMode ? (
            <button
              type="button"
              onClick={() => onSelectView('lesson1')}
              className="min-h-[40px] rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
            >
              학생 활동 화면
            </button>
          ) : (
            <span className="hidden xl:inline-block text-xs font-medium text-slate-500">
              중학교 1학년 · 읽걷쓰AI 프로젝트
            </span>
          )}
        </div>
      </div>

      {/* Mobile navigation strip with >=44px touch targets */}
      <div className="border-t border-slate-100 bg-slate-50/70 px-3 py-2 md:hidden">
        <div className={`grid gap-1.5 ${isTeacherMode ? 'grid-cols-3' : 'grid-cols-2'}`}>
          {LESSON_NAV.map((item) => (
            <button
              key={item.view}
              type="button"
              onClick={() => onSelectView(item.view)}
              className={`min-h-[44px] rounded-lg px-2 py-1.5 text-center text-xs font-semibold leading-snug ${
                activeView === item.view
                  ? 'bg-white text-emerald-800 shadow-xs ring-1 ring-slate-200'
                  : 'text-slate-700 hover:bg-white'
              }`}
            >
              {item.short}
            </button>
          ))}
          {isTeacherMode && (
            <button
              type="button"
              onClick={() => onSelectView('teacher')}
              className="min-h-[44px] rounded-lg px-2 py-1.5 text-center text-xs font-semibold leading-snug tabular-nums bg-white text-emerald-800 shadow-xs ring-1 ring-slate-200"
            >
              교사 확인{showCounts ? ` (${observationCount + topicCount})` : ''}
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
