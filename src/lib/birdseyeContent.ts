import type { GroupTopicRecord } from '../types/observation';

/** 7·8차시 가상 조감도 활동 내용 (프롬프트 빌더 · 평가표 · AI 윤리) */

export interface PromptField {
  id: string;
  label: string;
  help: string;
  options?: string[];
  placeholder?: string;
  wide?: boolean;
  optional?: boolean;
}

export const OWN_OPTION = '직접 쓰기';
export const OWN_MAX_LENGTH = 60;

export const PROMPT_FIELDS: PromptField[] = [
  {
    id: 'place',
    label: '장소',
    help: '사진 속 공간',
    options: ['복도', '빈 교실', '화장실 앞', '계단', '과학실', '도서관'],
  },
  {
    id: 'problem',
    label: '해결할 문제',
    help: '걷기 활동에서 찾은 낭비',
    options: [
      '사람이 없는데 전등이 켜져 있다',
      '빈 교실에 냉난방기가 켜져 있다',
      '창문이 열린 채 냉방기를 켠다',
      '아무도 없는 화장실 환풍기가 계속 돈다',
      '낮에 밝은데도 복도 전등이 켜져 있다',
    ],
  },
  {
    id: 'name',
    label: '기기 이름',
    help: '우리 모둠이 붙인 이름',
    placeholder: '예: 스마트 자동 소등기',
  },
  {
    id: 'sensor',
    label: '입력 (센서)',
    help: '무엇을 감지하나요?',
    options: [
      '인체 감지 센서(사람의 움직임)',
      '빛 센서(밝기)',
      '온도 센서',
      '소리 센서',
      '거리 센서',
      '문·창문 열림 센서',
    ],
  },
  {
    id: 'output',
    label: '출력 (액추에이터)',
    help: '무엇을 움직이나요?',
    options: [
      '서보 모터가 전등 스위치를 눌러 끈다',
      'LED 표시등이 색으로 상태를 알려 준다',
      '스피커로 안내 음성을 낸다',
      '작은 화면에 안내 문구를 보여 준다',
      'DC 모터로 환풍기를 켜고 끈다',
    ],
  },
  {
    id: 'where',
    label: '설치 위치',
    help: '사진 속 어디에?',
    options: [
      '전등 스위치 바로 위 벽',
      '출입문 옆 벽',
      '천장 가운데',
      '창문 틀 위',
      '칠판 옆 벽',
      '냉난방기 아래 벽',
    ],
  },
  {
    id: 'look',
    label: '모양·크기·색',
    help: '눈에 보이는 모습',
    options: [
      '손바닥만 한 흰색 네모 상자',
      '둥근 모양의 작은 하늘색 기기',
      '투명 케이스 안에 마이크로비트 보드가 보이는 모습',
      '친환경 느낌의 연두색 상자에 나뭇잎 그림',
    ],
  },
  {
    id: 'scene',
    label: '작동 장면',
    help: '그림 속 순간',
    options: [
      '사람이 없어 전등이 꺼지고 초록 LED가 켜진 장면',
      '센서가 감지해 기기가 막 작동하는 순간',
      '기기 화면에 "에너지 절약 중"이 표시된 장면',
    ],
  },
  {
    id: 'style',
    label: '그림 느낌',
    help: '결과 이미지 스타일',
    options: ['실제 사진처럼 자연스럽게', '설계도처럼 부품 이름표를 붙여서', '밝은 일러스트로'],
  },
  {
    id: 'extra',
    label: '더 넣고 싶은 것',
    help: '선택 · 40자까지',
    placeholder: '예: 기기 옆에 작은 안내 스티커',
    wide: true,
    optional: true,
  },
];

export type PromptValues = Record<string, string>;

const clip = (text: string, max = OWN_MAX_LENGTH) =>
  text.replace(/\s+/g, ' ').trim().slice(0, max);

/** 3~4차시에 확정한 모둠 주제로 프롬프트 칸을 미리 채운다 */
export function prefillFromTopic(topic: GroupTopicRecord | null): PromptValues {
  if (!topic) return {};
  const values: PromptValues = {};
  if (topic.selectedLocation) values.place = clip(topic.selectedLocation);
  if (topic.projectTitle) values.problem = clip(topic.projectTitle);
  if (topic.controlConditionWhen) values.sensor = clip(topic.controlConditionWhen);
  if (topic.controlConditionThen) values.output = clip(topic.controlConditionThen);
  return values;
}

export function composePrompt(v: PromptValues): string {
  const name = v.name ? `'${v.name}' 장치` : '에너지 절약 장치';
  const lines = [
    `첨부한 학교 사진(${v.place || '우리 모둠이 고른 공간'})에 우리 모둠이 설계한 ${name}를 자연스럽게 설치한 모습으로 바꿔 줘.`,
  ];
  const rows: [string, string | undefined][] = [
    ['설치 위치', v.where],
    ['해결할 문제', v.problem],
    ['감지(센서)', v.sensor],
    ['동작(액추에이터)', v.output],
    ['모양·크기·색', v.look],
    ['그림 속 장면', v.scene],
    ['추가', v.extra],
  ];
  rows.forEach(([k, x]) => {
    if (x) lines.push(`- ${k}: ${x}`);
  });
  lines.push(
    '지킬 것: 사진의 나머지 배경(벽, 바닥, 창문, 가구, 조명 위치)은 그대로 유지하고, 사람은 넣지 말아 줘.'
  );
  lines.push(`그림 느낌: ${v.style || '실제 사진처럼 자연스럽게'}`);
  return lines.join('\n');
}

export const PROMPT_CHECKS: { label: string; ok: (v: PromptValues) => boolean }[] = [
  { label: '어디에', ok: (v) => Boolean(v.place && v.where) },
  { label: '무엇을', ok: (v) => Boolean(v.sensor && v.output) },
  { label: '어떤 모양', ok: (v) => Boolean(v.look) },
  { label: '어떻게 작동', ok: (v) => Boolean(v.scene) },
  { label: '왜 (문제)', ok: (v) => Boolean(v.problem) },
];

const BAD_WORDS = [
  '씨발', '시발', '씨바', 'ㅅㅂ', 'ㅆㅂ', '병신', 'ㅂㅅ', '븅신', '개새', '개색', '좆',
  '존나', '졸라', '지랄', 'ㅈㄹ', '닥쳐', '꺼져', '미친놈', '미친년', '니애미', '느금',
  '엠창', 'fuck', 'shit', '시체', '폭발', '무기', '총기', '흉기',
];

export function hasInappropriateWord(text: string): boolean {
  const s = String(text)
    .toLowerCase()
    .replace(/[\s._*~!?,-]/g, '')
    .replace(/시발(점|역)/g, '');
  return BAD_WORDS.some((w) => s.includes(w));
}

/** 8차시 평가표: 체크하지 못한 항목이 수정 요청 문장이 된다 */
export const EVAL_ITEMS: {
  label: string;
  fix: string | ((v: PromptValues) => string);
}[] = [
  {
    label: '배경(벽, 바닥, 창문)이 원래 사진과 같다',
    fix: '배경은 원래 사진과 똑같이 유지해 줘',
  },
  {
    label: '기기가 우리가 정한 위치에 있다',
    fix: (v) => `기기를 이 위치로 옮겨 줘: ${v.where || '처음에 정한 위치'}`,
  },
  {
    label: '센서가 눈에 보이고, 감지할 수 있는 방향을 향한다',
    fix: (v) =>
      `감지 부분(${
        v.sensor && v.sensor.length <= 20 ? v.sensor : '센서'
      })이 앞면에 잘 보이고 감지할 공간을 향하게 해 줘`,
  },
  {
    label: '작동 장면이 우리가 정한 대로 나왔다',
    fix: (v) => `장면을 이렇게 바꿔 줘: ${v.scene || '처음에 정한 장면'}`,
  },
  {
    label: '기기 크기와 모양이 실제로 만들 수 있을 만큼 현실적이다',
    fix: (v) =>
      `기기를 실제로 만들 수 있는 크기로 줄이고 이 모양으로 해 줘: ${v.look || '작고 단순한 상자'}`,
  },
  {
    label: '사람, 글자 오류, 이상한 물건이 없다',
    fix: '사람과 이상한 글자, 필요 없는 물건은 지워 줘',
  },
];

export function composeFixRequest(
  checks: number[],
  extraFix: string,
  v: PromptValues
): string {
  const items = EVAL_ITEMS.map((item, i) => ({ item, i }))
    .filter(({ i }) => !checks.includes(i))
    .map(({ item }) => (typeof item.fix === 'function' ? item.fix(v) : item.fix));
  if (extraFix.trim()) items.push(extraFix.trim());
  if (items.length === 0) return '';
  return `방금 만든 그림을 바탕으로 다음만 고쳐 줘.\n${items
    .map((m, i) => `${i + 1}. ${m.replace(/[.。]$/, '')}.`)
    .join('\n')}\n나머지는 그대로 둬.`;
}

export const ETHICS_ITEMS: { text: string; ok: boolean; why: string }[] = [
  {
    text: '조감도를 "우리 학교에 설치된 새 기기"라며 실제 사진처럼 SNS에 올린다.',
    ok: false,
    why: '실제로 없는 장면을 사실처럼 퍼뜨리면 가짜 정보가 돼요. AI 이미지라고 꼭 밝혀요.',
  },
  {
    text: '발표 자료에 "AI로 만든 가상 이미지"라고 표시하고 넣는다.',
    ok: true,
    why: '보는 사람이 가상 이미지임을 알 수 있어요.',
  },
  {
    text: '더 실감 나게 하려고 친구 얼굴 사진을 함께 넣어 생성한다.',
    ok: false,
    why: '친구의 얼굴은 개인 정보예요. 동의 없이 AI 서비스에 올리면 안 돼요.',
  },
  {
    text: '사람이 나오지 않은 학교 공간 사진만 사용한다.',
    ok: true,
    why: '개인 정보가 드러나지 않아 안전해요.',
  },
  {
    text: 'AI가 그린 기기 모양을 그대로 믿고, 센서 위치를 확인하지 않는다.',
    ok: false,
    why: 'AI는 그럴듯하게 그릴 뿐 작동을 보장하지 않아요. 판단은 우리 몫이에요.',
  },
];

export function aiImageLabel(deviceName: string): string {
  return `※ 이 그림은 생성형 AI로 만든 가상 이미지입니다. (${
    deviceName || '우리 모둠 기기'
  } 설치 상상도 · 실제 설치된 모습이 아님)`;
}

export function formatDateTime(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(
    d.getMinutes()
  ).padStart(2, '0')}`;
}
