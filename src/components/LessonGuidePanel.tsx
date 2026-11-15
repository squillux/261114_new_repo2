import React from 'react';
import { ShieldCheck, Footprints, Eye, Users } from 'lucide-react';

export const Lesson1PageHeader: React.FC = () => {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-slate-500">
        중학교 1학년 정보(기술 융합) · 1단계(1차시) · 읽걷쓰AI 프로젝트
      </p>
      <h1
        id="lesson-guide-title"
        className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl"
      >
        학교 공간 에너지 낭비 관찰 일지
      </h1>
      <p className="max-w-3xl text-sm leading-relaxed text-slate-600 sm:text-base">
        먼저 개인별로 학교를 걸어 다니며 에너지가 낭비되는 공간의 사진과 관찰
        내용을 기록합니다. 개인 작성이 모두 끝나면 선생님이 모둠별로 결과를 모아
        보여줍니다.
      </p>
    </div>
  );
};

export const Lesson1FlowSection: React.FC = () => {
  return (
    <section
      aria-labelledby="lesson1-flow-title"
      className="rounded-xl border border-slate-200 bg-white p-5 space-y-4"
    >
      <h2
        id="lesson1-flow-title"
        className="text-base font-semibold text-slate-900"
      >
        1차시 진행 순서
      </h2>
      <ol className="space-y-4 text-sm text-slate-700">
        <li className="flex items-start gap-3">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-100 text-xs font-semibold text-slate-700 tabular-nums">
            1
          </span>
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-slate-900">
              <Eye
                className="h-4 w-4 shrink-0 text-slate-500"
                aria-hidden="true"
              />
              <span>들어가기 · 스마트 시티 및 IoT 사례 살펴보기</span>
            </div>
            <p className="leading-relaxed text-slate-600">
              수업 중 선생님이 안내하는 스마트 시티·IoT 센서 적용 사례 영상과
              기사를 보며 자동화 아이디어를 떠올립니다.
            </p>
          </div>
        </li>

        <li className="flex items-start gap-3">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-emerald-100 text-xs font-semibold text-emerald-800 tabular-nums">
            2
          </span>
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-slate-900">
              <Footprints
                className="h-4 w-4 shrink-0 text-emerald-700"
                aria-hidden="true"
              />
              <span>걷기 활동 · 개인별 현장 사진 촬영 및 관찰 일지 작성</span>
            </div>
            <p className="leading-relaxed text-slate-600">
              복도, 빈 교실, 화장실 등을 살펴보며 에너지가 낭비되는 현장을
              사진으로 찍고 관찰 일지에 기록합니다. 찍은 사진은 이후 프로그램으로
              해결한 모습을 구현할 때 그대로 활용합니다.
            </p>
          </div>
        </li>

        <li className="flex items-start gap-3">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-100 text-xs font-semibold text-slate-700 tabular-nums">
            3
          </span>
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-slate-900">
              <Users
                className="h-4 w-4 shrink-0 text-slate-500"
                aria-hidden="true"
              />
              <span>모둠 확인 · 개인 기록 모아보고 2차시 주제 준비하기</span>
            </div>
            <p className="leading-relaxed text-slate-600">
              개인 작성이 끝나면 선생님이 모둠별로 관찰 결과와 사진을 함께
              보여주며, 2차시 「모둠별 프로젝트 주제 선정」으로 이어집니다.
            </p>
          </div>
        </li>
      </ol>
    </section>
  );
};

export const LessonGuidePanel: React.FC = () => {
  return (
    <section
      id="lesson-guide"
      aria-labelledby="lesson-guide-title"
      className="space-y-6"
    >
      {/* 관통 질문 */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <p className="text-xs font-semibold text-emerald-800">
          프로젝트 관통 질문
        </p>
        <p className="mt-1.5 text-base font-semibold leading-snug text-slate-900">
          “무심코 낭비되는 우리 학교의 에너지를, 센서와 코딩을 활용해 어떻게
          똑똑하게 스스로 아끼는 공간으로 바꿀 수 있을까?”
        </p>
      </div>

      {/* 디지털 안전 약속 */}
      <div className="rounded-xl border border-slate-200 bg-slate-100/70 p-4 text-sm text-slate-700">
        <div className="flex items-start gap-2.5">
          <ShieldCheck
            className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700"
            aria-hidden="true"
          />
          <div className="space-y-1">
            <p className="font-semibold text-slate-900">
              사진 촬영 및 디지털 안전 약속
            </p>
            <p className="text-xs leading-relaxed text-slate-600 sm:text-sm">
              학교 공간 사진을 찍을 때 친구의 얼굴이나 개인정보·초상권이 담기지
              않도록 주의하고, 조명·냉난방기 등 공간과 설비 상태만 촬영해
              주세요.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

