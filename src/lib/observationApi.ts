import type {
  GroupTopicInput,
  GroupTopicRecord,
  ObservationInput,
  ObservationRecord,
  StorageConnectionStatus,
} from '../types/observation';

const OBSERVATIONS_ENDPOINT = '/api/observations';
const GROUP_TOPICS_ENDPOINT = '/api/group-topics';

const PREVIEW_OBSERVATIONS_KEY = 'smart_eco_school_preview_observations_v2';
const PREVIEW_TOPICS_KEY = 'smart_eco_school_preview_group_topics_v1';

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
