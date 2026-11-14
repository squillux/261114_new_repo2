import type {
  GroupAuthCode,
  GroupTopicInput,
  GroupTopicRecord,
  ObservationInput,
  ObservationRecord,
  StorageConnectionStatus,
} from '../types/observation';

const OBSERVATIONS_ENDPOINT = '/api/observations';
const GROUP_TOPICS_ENDPOINT = '/api/group-topics';
const GROUP_CODES_ENDPOINT = '/api/group-codes';
const GROUP_VERIFY_ENDPOINT = '/api/group-observations/verify';

const PREVIEW_OBSERVATIONS_KEY = 'smart_eco_school_preview_observations_v2';
const PREVIEW_TOPICS_KEY = 'smart_eco_school_preview_group_topics_v1';
const PREVIEW_CODES_KEY = 'smart_eco_school_preview_group_codes_v1';

export interface ApiFetchObservationsResult {
  status: StorageConnectionStatus;
  records: ObservationRecord[];
}

export interface ApiSubmitObservationResult {
  savedToServer: boolean;
  status: StorageConnectionStatus;
  record: ObservationRecord;
  message: string;
}

export interface ApiFetchTopicsResult {
  status: StorageConnectionStatus;
  records: GroupTopicRecord[];
}

export interface ApiSubmitTopicResult {
  savedToServer: boolean;
  status: StorageConnectionStatus;
  record: GroupTopicRecord;
  message: string;
}

export interface ApiFetchCodesResult {
  status: StorageConnectionStatus;
  codes: GroupAuthCode[];
}

export interface ApiSaveCodeResult {
  savedToServer: boolean;
  status: StorageConnectionStatus;
  entry: GroupAuthCode;
  message: string;
}

export interface ApiVerifyGroupResult {
  verified: boolean;
  status: StorageConnectionStatus;
  observations: ObservationRecord[];
  message: string;
}

function isJsonResponse(response: Response): boolean {
  const contentType = response.headers.get('content-type') || '';
  return contentType.toLowerCase().includes('application/json');
}

function makeLocalId(prefix: string): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID();
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function loadPreviewRecords(): ObservationRecord[] {
  try {
    const raw = window.sessionStorage.getItem(PREVIEW_OBSERVATIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function savePreviewRecords(records: ObservationRecord[]): boolean {
  try {
    window.sessionStorage.setItem(
      PREVIEW_OBSERVATIONS_KEY,
      JSON.stringify(records)
    );
    return true;
  } catch {
    return false;
  }
}

export function clearPreviewRecords(): void {
  try {
    window.sessionStorage.removeItem(PREVIEW_OBSERVATIONS_KEY);
  } catch {
    // Ignore storage errors
  }
}

export function loadPreviewTopics(): GroupTopicRecord[] {
  try {
    const raw = window.sessionStorage.getItem(PREVIEW_TOPICS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function savePreviewTopics(records: GroupTopicRecord[]): boolean {
  try {
    window.sessionStorage.setItem(PREVIEW_TOPICS_KEY, JSON.stringify(records));
    return true;
  } catch {
    return false;
  }
}

export function clearPreviewTopics(): void {
  try {
    window.sessionStorage.removeItem(PREVIEW_TOPICS_KEY);
  } catch {
    // Ignore storage errors
  }
}

export function loadPreviewCodes(): GroupAuthCode[] {
  try {
    const raw = window.sessionStorage.getItem(PREVIEW_CODES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function savePreviewCodes(codes: GroupAuthCode[]): boolean {
  try {
    window.sessionStorage.setItem(PREVIEW_CODES_KEY, JSON.stringify(codes));
    return true;
  } catch {
    return false;
  }
}

export function clearPreviewCodes(): void {
  try {
    window.sessionStorage.removeItem(PREVIEW_CODES_KEY);
  } catch {
    // Ignore storage errors
  }
}

export async function fetchObservationsFromApi(): Promise<ApiFetchObservationsResult> {
  try {
    const response = await fetch(OBSERVATIONS_ENDPOINT, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    if (!response.ok || !isJsonResponse(response)) {
      return { status: 'not-connected', records: [] };
    }

    const data = await response.json();
    const list = Array.isArray(data)
      ? data
      : Array.isArray(data?.observations)
        ? data.observations
        : [];

    const normalized: ObservationRecord[] = list.map(
      (item: ObservationRecord) => ({
        ...item,
        syncState: 'saved-to-api',
      })
    );

    return { status: 'connected', records: normalized };
  } catch {
    return { status: 'not-connected', records: [] };
  }
}

export async function submitObservation(
  input: ObservationInput
): Promise<ApiSubmitObservationResult> {
  const nowIso = new Date().toISOString();
  const localId = makeLocalId('obs');

  try {
    const response = await fetch(OBSERVATIONS_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ ...input, createdAt: nowIso }),
    });

    if (response.ok && isJsonResponse(response)) {
      const saved = await response.json();
      const serverRecord: ObservationRecord = {
        ...input,
        id: saved?.id ? String(saved.id) : localId,
        createdAt: saved?.createdAt ? String(saved.createdAt) : nowIso,
        syncState: 'saved-to-api',
      };

      return {
        savedToServer: true,
        status: 'connected',
        record: serverRecord,
        message: '서버(/api/observations)에 개인 관찰 일지가 저장되었습니다.',
      };
    }
  } catch {
    // Not connected yet
  }

  return {
    savedToServer: false,
    status: 'not-connected',
    record: {
      ...input,
      id: localId,
      createdAt: nowIso,
      syncState: 'preview-only',
    },
    message:
      '저장 준비 중: 아직 /api 데이터 저장소가 연결되지 않아 다른 기기로 전송되지 않았습니다. 현재 브라우저 임시 미리보기 목록에만 표시됩니다.',
  };
}

export async function fetchGroupTopicsFromApi(): Promise<ApiFetchTopicsResult> {
  try {
    const response = await fetch(GROUP_TOPICS_ENDPOINT, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    if (!response.ok || !isJsonResponse(response)) {
      return { status: 'not-connected', records: [] };
    }

    const data = await response.json();
    const list = Array.isArray(data)
      ? data
      : Array.isArray(data?.topics)
        ? data.topics
        : [];

    const normalized: GroupTopicRecord[] = list.map(
      (item: GroupTopicRecord) => ({
        ...item,
        syncState: 'saved-to-api',
      })
    );

    return { status: 'connected', records: normalized };
  } catch {
    return { status: 'not-connected', records: [] };
  }
}

export async function submitGroupTopic(
  input: GroupTopicInput
): Promise<ApiSubmitTopicResult> {
  const nowIso = new Date().toISOString();
  const localId = makeLocalId('topic');

  try {
    const response = await fetch(GROUP_TOPICS_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ ...input, createdAt: nowIso }),
    });

    if (response.ok && isJsonResponse(response)) {
      const saved = await response.json();
      const serverRecord: GroupTopicRecord = {
        ...input,
        id: saved?.id ? String(saved.id) : localId,
        createdAt: saved?.createdAt ? String(saved.createdAt) : nowIso,
        syncState: 'saved-to-api',
      };

      return {
        savedToServer: true,
        status: 'connected',
        record: serverRecord,
        message: '서버(/api/group-topics)에 모둠별 프로젝트 주제가 저장되었습니다.',
      };
    }
  } catch {
    // Not connected yet
  }

  return {
    savedToServer: false,
    status: 'not-connected',
    record: {
      ...input,
      id: localId,
      createdAt: nowIso,
      syncState: 'preview-only',
    },
    message:
      '저장 준비 중: 아직 /api 데이터 저장소가 연결되지 않아 다른 기기로 전송되지 않았습니다. 현재 브라우저 임시 미리보기 목록에만 표시됩니다.',
  };
}

export async function fetchGroupCodesFromApi(): Promise<ApiFetchCodesResult> {
  try {
    const response = await fetch(GROUP_CODES_ENDPOINT, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    if (!response.ok || !isJsonResponse(response)) {
      return { status: 'not-connected', codes: [] };
    }

    const data = await response.json();
    const list = Array.isArray(data)
      ? data
      : Array.isArray(data?.codes)
        ? data.codes
        : [];

    const normalized: GroupAuthCode[] = list.map((item: GroupAuthCode) => ({
      ...item,
      syncState: 'saved-to-api',
    }));

    return { status: 'connected', codes: normalized };
  } catch {
    return { status: 'not-connected', codes: [] };
  }
}

export async function saveGroupCode(
  groupName: string,
  code: string
): Promise<ApiSaveCodeResult> {
  const nowIso = new Date().toISOString();
  const normalizedGroup = groupName.trim();
  const normalizedCode = code.trim();

  try {
    const response = await fetch(GROUP_CODES_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        groupName: normalizedGroup,
        code: normalizedCode,
        updatedAt: nowIso,
      }),
    });

    if (response.ok && isJsonResponse(response)) {
      const saved = await response.json();
      return {
        savedToServer: true,
        status: 'connected',
        entry: {
          groupName: saved?.groupName ? String(saved.groupName) : normalizedGroup,
          code: saved?.code ? String(saved.code) : normalizedCode,
          updatedAt: saved?.updatedAt ? String(saved.updatedAt) : nowIso,
          syncState: 'saved-to-api',
        },
        message: '서버(/api/group-codes)에 모둠 인증코드가 저장되었습니다.',
      };
    }
  } catch {
    // Not connected yet
  }

  return {
    savedToServer: false,
    status: 'not-connected',
    entry: {
      groupName: normalizedGroup,
      code: normalizedCode,
      updatedAt: nowIso,
      syncState: 'preview-only',
    },
    message:
      '저장 준비 중: 아직 /api 데이터 저장소가 연결되지 않아 현재 브라우저 임시 미리보기에만 반영되었습니다. 같은 브라우저의 2차시 화면에서 바로 테스트할 수 있습니다.',
  };
}

export async function verifyGroupAuthAndFetchObservations(
  groupName: string,
  code: string,
  previewCodes: GroupAuthCode[],
  previewObservations: ObservationRecord[]
): Promise<ApiVerifyGroupResult> {
  const normalizedGroup = groupName.trim();
  const normalizedCode = code.trim();

  try {
    const response = await fetch(GROUP_VERIFY_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        groupName: normalizedGroup,
        code: normalizedCode,
      }),
    });

    if (isJsonResponse(response)) {
      const data = await response.json();
      if (response.ok && data?.verified) {
        const list = Array.isArray(data.observations) ? data.observations : [];
        return {
          verified: true,
          status: 'connected',
          observations: list.map((item: ObservationRecord) => ({
            ...item,
            syncState: 'saved-to-api',
          })),
          message: `${normalizedGroup} 인증이 완료되었습니다.`,
        };
      }

      if (response.status === 401 || response.status === 403 || data?.verified === false) {
        return {
          verified: false,
          status: 'connected',
          observations: [],
          message:
            data?.message ||
            '모둠 인증코드가 일치하지 않습니다. 선생님께 받은 코드를 다시 확인해 주세요.',
        };
      }
    }
  } catch {
    // Not connected yet; evaluate against teacher-created preview codes
  }

  const matchedCode = previewCodes.find(
    (item) => item.groupName.trim() === normalizedGroup
  );

  if (!matchedCode) {
    return {
      verified: false,
      status: 'not-connected',
      observations: [],
      message: `아직 교사가 "${normalizedGroup}"의 인증코드를 만들지 않았습니다. 교사 확인 화면 → 「모둠 인증코드 관리」에서 인증코드를 먼저 만들어 주세요.`,
    };
  }

  if (matchedCode.code.trim().toLowerCase() !== normalizedCode.toLowerCase()) {
    return {
      verified: false,
      status: 'not-connected',
      observations: [],
      message:
        '인증코드가 일치하지 않습니다. 선생님께 받은 모둠별 인증코드를 다시 확인해 주세요.',
    };
  }

  const matchedObs = previewObservations.filter(
    (obs) => obs.groupName.trim() === normalizedGroup
  );

  return {
    verified: true,
    status: 'not-connected',
    observations: matchedObs,
    message: `임시 미리보기 인증 완료 (${normalizedGroup}) · 저장소(/api) 연결 전이므로 현재 브라우저에 입력된 1차시 기록만 표시됩니다.`,
  };
}
