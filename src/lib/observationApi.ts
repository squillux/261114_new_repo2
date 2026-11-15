import type {
  GroupAuthCode,
  GroupTopicInput,
  GroupTopicRecord,
  ObservationInput,
  ObservationRecord,
  StorageConnectionStatus,
} from '../types/observation';

const HEALTH_ENDPOINT = '/api/health';
const TEACHER_SESSION_ENDPOINT = '/api/teacher/session';
const TEACHER_LOGIN_ENDPOINT = '/api/teacher/login';
const TEACHER_LOGOUT_ENDPOINT = '/api/teacher/logout';
const OBSERVATIONS_ENDPOINT = '/api/observations';
const GROUP_TOPICS_ENDPOINT = '/api/group-topics';
const GROUP_CODES_ENDPOINT = '/api/group-codes';
const GROUP_CODES_BULK_ENDPOINT = '/api/group-codes/bulk';
const GROUP_VERIFY_ENDPOINT = '/api/group-observations/verify';

const PREVIEW_OBSERVATIONS_KEY = 'smart_eco_school_preview_observations_v3';
const PREVIEW_TOPICS_KEY = 'smart_eco_school_preview_group_topics_v2';
const PREVIEW_CODES_KEY = 'smart_eco_school_preview_group_codes_v2';
const MY_SESSION_OBSERVATIONS_KEY = 'smart_eco_school_my_observations_v1';
const MY_SESSION_TOPICS_KEY = 'smart_eco_school_my_topics_v1';

export interface ApiHealthResult {
  status: StorageConnectionStatus;
  tablesReady: boolean;
  hasTeacherPassword: boolean;
  message?: string;
}

export interface ApiTeacherSessionResult {
  status: StorageConnectionStatus;
  authenticated: boolean;
  configured: boolean;
}

export interface ApiTeacherLoginResult {
  ok: boolean;
  status: StorageConnectionStatus;
  authenticated: boolean;
  message: string;
}

export interface ApiFetchObservationsResult {
  status: StorageConnectionStatus;
  authorized: boolean;
  records: ObservationRecord[];
  totalCount?: number;
  availableClasses?: string[];
  photosDeferred?: boolean;
  error?: string;
}

export interface ApiFetchObservationPhotoResult {
  ok: boolean;
  photoDataUrl: string;
  error?: string;
}

export interface ApiSubmitObservationResult {
  savedToServer: boolean;
  failed: boolean;
  status: StorageConnectionStatus;
  record?: ObservationRecord;
  message: string;
}

export interface ApiFetchTopicsResult {
  status: StorageConnectionStatus;
  authorized: boolean;
  records: GroupTopicRecord[];
  error?: string;
}

export interface ApiSubmitTopicResult {
  savedToServer: boolean;
  failed: boolean;
  status: StorageConnectionStatus;
  record?: GroupTopicRecord;
  message: string;
}

export interface ApiFetchCodesResult {
  status: StorageConnectionStatus;
  authorized: boolean;
  codes: GroupAuthCode[];
  error?: string;
}

export interface ApiSaveCodeResult {
  savedToServer: boolean;
  failed: boolean;
  status: StorageConnectionStatus;
  entry?: GroupAuthCode;
  message: string;
}

export interface ApiSaveBulkCodesResult {
  savedToServer: boolean;
  failed: boolean;
  status: StorageConnectionStatus;
  entries: GroupAuthCode[];
  message: string;
}

export interface ApiVerifyGroupResult {
  verified: boolean;
  status: StorageConnectionStatus;
  observations: ObservationRecord[];
  existingTopic: GroupTopicRecord | null;
  message: string;
}

export interface ApiDeleteResult {
  deletedOnServer: boolean;
  failed: boolean;
  status: StorageConnectionStatus;
  error?: string;
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

export function loadMySessionObservations(): ObservationRecord[] {
  try {
    const raw = window.sessionStorage.getItem(MY_SESSION_OBSERVATIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveMySessionObservations(records: ObservationRecord[]): void {
  try {
    window.sessionStorage.setItem(
      MY_SESSION_OBSERVATIONS_KEY,
      JSON.stringify(records)
    );
  } catch {
    try {
      const compact = records.map((r) => ({ ...r, photoDataUrl: '' }));
      window.sessionStorage.setItem(
        MY_SESSION_OBSERVATIONS_KEY,
        JSON.stringify(compact)
      );
    } catch {
      // Ignore quota errors
    }
  }
}

export function loadMySessionTopics(): GroupTopicRecord[] {
  try {
    const raw = window.sessionStorage.getItem(MY_SESSION_TOPICS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveMySessionTopics(records: GroupTopicRecord[]): void {
  try {
    window.sessionStorage.setItem(
      MY_SESSION_TOPICS_KEY,
      JSON.stringify(records)
    );
  } catch {
    try {
      const compact = records.map((r) => ({ ...r, referencePhotoDataUrl: '' }));
      window.sessionStorage.setItem(
        MY_SESSION_TOPICS_KEY,
        JSON.stringify(compact)
      );
    } catch {
      // Ignore quota errors
    }
  }
}

export async function checkApiHealth(): Promise<ApiHealthResult> {
  try {
    const response = await fetch(HEALTH_ENDPOINT, {
      method: 'GET',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    });

    if (!isJsonResponse(response)) {
      return {
        status: 'not-connected',
        tablesReady: false,
        hasTeacherPassword: false,
      };
    }

    const data = await response.json();
    const connected = Boolean(response.ok && data?.connected);
    return {
      status: connected ? 'connected' : 'not-connected',
      tablesReady: Boolean(data?.tablesReady),
      hasTeacherPassword: Boolean(data?.hasTeacherPassword),
      message: typeof data?.error === 'string' ? data.error : undefined,
    };
  } catch {
    return {
      status: 'not-connected',
      tablesReady: false,
      hasTeacherPassword: false,
    };
  }
}

export async function fetchTeacherSession(): Promise<ApiTeacherSessionResult> {
  try {
    const response = await fetch(TEACHER_SESSION_ENDPOINT, {
      method: 'GET',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    });

    if (!isJsonResponse(response)) {
      return {
        status: 'not-connected',
        authenticated: false,
        configured: false,
      };
    }

    const data = await response.json();
    return {
      status: 'connected',
      authenticated: Boolean(data?.authenticated),
      configured: Boolean(data?.configured),
    };
  } catch {
    return {
      status: 'not-connected',
      authenticated: false,
      configured: false,
    };
  }
}

export async function loginTeacher(
  password: string
): Promise<ApiTeacherLoginResult> {
  try {
    const response = await fetch(TEACHER_LOGIN_ENDPOINT, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ password }),
    });

    if (!isJsonResponse(response)) {
      return {
        ok: false,
        status: 'not-connected',
        authenticated: false,
        message:
          '아직 Cloudflare Worker 서버(/api/teacher/login)가 연결되지 않았습니다.',
      };
    }

    const data = await response.json();
    if (response.ok && data?.authenticated) {
      return {
        ok: true,
        status: 'connected',
        authenticated: true,
        message: '교사 인증이 완료되었습니다.',
      };
    }

    return {
      ok: false,
      status: response.status >= 500 ? 'not-connected' : 'connected',
      authenticated: false,
      message:
        typeof data?.error === 'string'
          ? data.error
          : '교사 비밀번호 확인에 실패했습니다.',
    };
  } catch {
    return {
      ok: false,
      status: 'not-connected',
      authenticated: false,
      message: '서버와 연결할 수 없어 로그인하지 못했습니다.',
    };
  }
}

export async function logoutTeacher(): Promise<void> {
  try {
    await fetch(TEACHER_LOGOUT_ENDPOINT, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    });
  } catch {
    // Ignore logout network error when offline/not-connected
  }
}

export async function fetchObservationsFromApi(
  classRoom?: string
): Promise<ApiFetchObservationsResult> {
  try {
    const query =
      classRoom && classRoom !== 'all'
        ? `?classRoom=${encodeURIComponent(classRoom)}`
        : '';
    const response = await fetch(`${OBSERVATIONS_ENDPOINT}${query}`, {
      method: 'GET',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    });

    if (!isJsonResponse(response)) {
      return { status: 'not-connected', authorized: false, records: [] };
    }

    const data = await response.json();
    if (response.status === 401 || response.status === 403) {
      return {
        status: 'connected',
        authorized: false,
        records: [],
        error: typeof data?.error === 'string' ? data.error : undefined,
      };
    }

    if (!response.ok) {
      return {
        status: 'not-connected',
        authorized: true,
        records: [],
        error:
          typeof data?.error === 'string'
            ? data.error
            : '관찰 일지를 불러오지 못했습니다.',
      };
    }

    const list = Array.isArray(data)
      ? data
      : Array.isArray(data?.observations)
        ? data.observations
        : [];

    const normalized: ObservationRecord[] = list.map(
      (item: ObservationRecord) => ({
        ...item,
        hasPhoto:
          typeof item.hasPhoto === 'boolean'
            ? item.hasPhoto
            : Boolean(item.photoDataUrl),
        syncState: 'saved-to-api',
      })
    );

    const availableClasses = Array.isArray(data?.availableClasses)
      ? (data.availableClasses as string[])
      : undefined;

    return {
      status: 'connected',
      authorized: true,
      records: normalized,
      totalCount:
        typeof data?.totalCount === 'number'
          ? data.totalCount
          : normalized.length,
      availableClasses,
      photosDeferred: Boolean(data?.photosDeferred),
    };
  } catch {
    return { status: 'not-connected', authorized: false, records: [] };
  }
}

export async function fetchObservationPhotoFromApi(
  id: string
): Promise<ApiFetchObservationPhotoResult> {
  try {
    const response = await fetch(
      `${OBSERVATIONS_ENDPOINT}/${encodeURIComponent(id)}/photo`,
      {
        method: 'GET',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      }
    );

    if (!isJsonResponse(response)) {
      return {
        ok: false,
        photoDataUrl: '',
        error: '서버와 연결되지 않았습니다.',
      };
    }

    const data = await response.json();
    if (!response.ok || data?.ok === false) {
      return {
        ok: false,
        photoDataUrl: '',
        error:
          typeof data?.error === 'string'
            ? data.error
            : '사진을 불러오지 못했습니다.',
      };
    }

    return {
      ok: true,
      photoDataUrl:
        typeof data?.photoDataUrl === 'string' ? data.photoDataUrl : '',
    };
  } catch {
    return {
      ok: false,
      photoDataUrl: '',
      error: '사진을 불러오는 중 네트워크 오류가 발생했습니다.',
    };
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
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ ...input, createdAt: nowIso }),
    });

    if (isJsonResponse(response)) {
      const data = await response.json();
      if (response.ok && data?.ok !== false) {
        const serverRecord: ObservationRecord = {
          ...input,
          id: data?.id ? String(data.id) : localId,
          createdAt: data?.createdAt ? String(data.createdAt) : nowIso,
          syncState: 'saved-to-api',
        };

        return {
          savedToServer: true,
          failed: false,
          status: 'connected',
          record: serverRecord,
          message:
            '서버(Cloudflare D1)에 개인 관찰 일지가 안전하게 저장되었습니다.',
        };
      }

      return {
        savedToServer: false,
        failed: true,
        status: response.status >= 500 ? 'not-connected' : 'connected',
        message:
          typeof data?.error === 'string'
            ? data.error
            : '개인 관찰 일지를 서버에 저장하지 못했습니다.',
      };
    }
  } catch {
    // Not connected yet (e.g. Vite dev preview without Worker)
  }

  return {
    savedToServer: false,
    failed: false,
    status: 'not-connected',
    record: {
      ...input,
      id: localId,
      createdAt: nowIso,
      syncState: 'preview-only',
    },
    message:
      '미리보기 모드 (서버에 저장되지 않음): 현재 제작 미리보기 화면에서는 Cloudflare D1에 저장되지 않으며, 이 브라우저에서만 흐름을 확인할 수 있습니다. Cloudflare 배포 후 실제 저장됩니다.',
  };
}

export async function deleteObservationFromApi(
  id: string
): Promise<ApiDeleteResult> {
  try {
    const response = await fetch(
      `${OBSERVATIONS_ENDPOINT}/${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      }
    );
    if (isJsonResponse(response)) {
      const data = await response.json();
      if (response.ok && data?.ok !== false) {
        return { deletedOnServer: true, failed: false, status: 'connected' };
      }
      return {
        deletedOnServer: false,
        failed: true,
        status: response.status >= 500 ? 'not-connected' : 'connected',
        error:
          typeof data?.error === 'string'
            ? data.error
            : '기록을 삭제하지 못했습니다.',
      };
    }
  } catch {
    // Not connected yet
  }
  return { deletedOnServer: false, failed: false, status: 'not-connected' };
}

export async function fetchGroupTopicsFromApi(): Promise<ApiFetchTopicsResult> {
  try {
    const response = await fetch(GROUP_TOPICS_ENDPOINT, {
      method: 'GET',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    });

    if (!isJsonResponse(response)) {
      return { status: 'not-connected', authorized: false, records: [] };
    }

    const data = await response.json();
    if (response.status === 401 || response.status === 403) {
      return {
        status: 'connected',
        authorized: false,
        records: [],
        error: typeof data?.error === 'string' ? data.error : undefined,
      };
    }

    if (!response.ok) {
      return {
        status: 'not-connected',
        authorized: true,
        records: [],
        error:
          typeof data?.error === 'string'
            ? data.error
            : '모둠별 주제를 불러오지 못했습니다.',
      };
    }

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

    return { status: 'connected', authorized: true, records: normalized };
  } catch {
    return { status: 'not-connected', authorized: false, records: [] };
  }
}

/** 교사 화면: 모둠 순서도 사진을 필요할 때만 불러오기 */
export async function fetchGroupFlowchartFromApi(
  classRoom: string,
  groupName: string
): Promise<{ ok: boolean; dataUrl: string; error?: string }> {
  try {
    const response = await fetch(
      `/api/group-flowchart?classRoom=${encodeURIComponent(classRoom)}&groupName=${encodeURIComponent(groupName)}`,
      { credentials: 'same-origin', headers: { Accept: 'application/json' } }
    );
    if (!isJsonResponse(response)) {
      return { ok: false, dataUrl: '', error: '서버에 연결되지 않았습니다.' };
    }
    const data = await response.json();
    if (!response.ok || data?.ok === false) {
      return {
        ok: false,
        dataUrl: '',
        error: typeof data?.error === 'string' ? data.error : '순서도 사진을 불러오지 못했습니다.',
      };
    }
    return { ok: true, dataUrl: typeof data?.dataUrl === 'string' ? data.dataUrl : '' };
  } catch {
    return { ok: false, dataUrl: '', error: '네트워크 연결을 확인해 주세요.' };
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
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ ...input, createdAt: nowIso }),
    });

    if (isJsonResponse(response)) {
      const data = await response.json();
      if (response.ok && data?.ok !== false) {
        // 순서도 원본은 서버에만 두고, 화면 상태에는 "올림 여부"만 남김
        const { flowchartDataUrl, ...rest } = input;
        const serverRecord: GroupTopicRecord = {
          ...rest,
          hasFlowchart: Boolean(flowchartDataUrl),
          id: data?.id ? String(data.id) : localId,
          createdAt: data?.createdAt ? String(data.createdAt) : nowIso,
          syncState: 'saved-to-api',
        };

        return {
          savedToServer: true,
          failed: false,
          status: 'connected',
          record: serverRecord,
          message:
            '서버(Cloudflare D1)에 모둠별 프로젝트 주제가 저장되었습니다.',
        };
      }

      return {
        savedToServer: false,
        failed: true,
        status: response.status >= 500 ? 'not-connected' : 'connected',
        message:
          typeof data?.error === 'string'
            ? data.error
            : '모둠 프로젝트 주제를 서버에 저장하지 못했습니다.',
      };
    }
  } catch {
    // Not connected yet
  }

  return {
    savedToServer: false,
    failed: false,
    status: 'not-connected',
    record: {
      ...input,
      id: localId,
      createdAt: nowIso,
      syncState: 'preview-only',
    },
    message:
      '미리보기 모드 (서버에 저장되지 않음): 현재 제작 미리보기 화면에서는 Cloudflare D1에 저장되지 않으며, 이 브라우저에서만 흐름을 확인할 수 있습니다. Cloudflare 배포 후 실제 저장됩니다.',
  };
}

export async function deleteGroupTopicFromApi(
  id: string
): Promise<ApiDeleteResult> {
  try {
    const response = await fetch(
      `${GROUP_TOPICS_ENDPOINT}/${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      }
    );
    if (isJsonResponse(response)) {
      const data = await response.json();
      if (response.ok && data?.ok !== false) {
        return { deletedOnServer: true, failed: false, status: 'connected' };
      }
      return {
        deletedOnServer: false,
        failed: true,
        status: response.status >= 500 ? 'not-connected' : 'connected',
        error:
          typeof data?.error === 'string'
            ? data.error
            : '모둠 주제를 삭제하지 못했습니다.',
      };
    }
  } catch {
    // Not connected yet
  }
  return { deletedOnServer: false, failed: false, status: 'not-connected' };
}

export async function fetchGroupCodesFromApi(): Promise<ApiFetchCodesResult> {
  try {
    const response = await fetch(GROUP_CODES_ENDPOINT, {
      method: 'GET',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    });

    if (!isJsonResponse(response)) {
      return { status: 'not-connected', authorized: false, codes: [] };
    }

    const data = await response.json();
    if (response.status === 401 || response.status === 403) {
      return {
        status: 'connected',
        authorized: false,
        codes: [],
        error: typeof data?.error === 'string' ? data.error : undefined,
      };
    }

    if (!response.ok) {
      return {
        status: 'not-connected',
        authorized: true,
        codes: [],
        error:
          typeof data?.error === 'string'
            ? data.error
            : '모둠 인증코드 목록을 불러오지 못했습니다.',
      };
    }

    const list = Array.isArray(data)
      ? data
      : Array.isArray(data?.codes)
        ? data.codes
        : [];

    const normalized: GroupAuthCode[] = list.map((item: GroupAuthCode) => ({
      ...item,
      syncState: 'saved-to-api',
    }));

    return { status: 'connected', authorized: true, codes: normalized };
  } catch {
    return { status: 'not-connected', authorized: false, codes: [] };
  }
}

export async function saveGroupCode(
  classRoom: string,
  groupName: string,
  code: string
): Promise<ApiSaveCodeResult> {
  const nowIso = new Date().toISOString();
  const normalizedClass = classRoom.trim();
  const normalizedGroup = groupName.trim();
  const normalizedCode = code.trim();

  try {
    const response = await fetch(GROUP_CODES_ENDPOINT, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        classRoom: normalizedClass,
        groupName: normalizedGroup,
        code: normalizedCode,
        updatedAt: nowIso,
      }),
    });

    if (isJsonResponse(response)) {
      const data = await response.json();
      if (response.ok && data?.ok !== false) {
        return {
          savedToServer: true,
          failed: false,
          status: 'connected',
          entry: {
            classRoom: data?.classRoom
              ? String(data.classRoom)
              : normalizedClass,
            groupName: data?.groupName
              ? String(data.groupName)
              : normalizedGroup,
            code: data?.code ? String(data.code) : normalizedCode,
            updatedAt: data?.updatedAt ? String(data.updatedAt) : nowIso,
            syncState: 'saved-to-api',
          },
          message: '서버(Cloudflare D1)에 모둠 인증코드가 저장되었습니다.',
        };
      }

      return {
        savedToServer: false,
        failed: true,
        status: response.status >= 500 ? 'not-connected' : 'connected',
        message:
          typeof data?.error === 'string'
            ? data.error
            : '모둠 인증코드를 저장하지 못했습니다.',
      };
    }
  } catch {
    // Not connected yet
  }

  return {
    savedToServer: false,
    failed: false,
    status: 'not-connected',
    entry: {
      classRoom: normalizedClass,
      groupName: normalizedGroup,
      code: normalizedCode,
      updatedAt: nowIso,
      syncState: 'preview-only',
    },
    message:
      '미리보기 모드 (서버에 저장되지 않음): 현재 제작 미리보기 화면에서는 Cloudflare D1에 저장되지 않아 이 브라우저 임시 미리보기에만 반영되었습니다. Cloudflare 배포 후 실제 저장됩니다.',
  };
}

export async function saveBulkGroupCodes(
  classRoom: string,
  entries: Array<{ groupName: string; code: string }>
): Promise<ApiSaveBulkCodesResult> {
  const nowIso = new Date().toISOString();
  const normalizedClass = classRoom.trim();
  const cleanedEntries = entries.map((item) => ({
    groupName: item.groupName.trim(),
    code: item.code.trim(),
  }));

  try {
    const response = await fetch(GROUP_CODES_BULK_ENDPOINT, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        classRoom: normalizedClass,
        entries: cleanedEntries,
      }),
    });

    if (isJsonResponse(response)) {
      const data = await response.json();
      if (response.ok && data?.ok !== false) {
        const list: GroupAuthCode[] = Array.isArray(data?.entries)
          ? data.entries.map(
              (item: {
                classRoom?: string;
                groupName?: string;
                code?: string;
                updatedAt?: string;
              }) => ({
                classRoom: item.classRoom
                  ? String(item.classRoom)
                  : normalizedClass,
                groupName: String(item.groupName || ''),
                code: String(item.code || ''),
                updatedAt: item.updatedAt ? String(item.updatedAt) : nowIso,
                syncState: 'saved-to-api',
              })
            )
          : cleanedEntries.map((item) => ({
              classRoom: normalizedClass,
              groupName: item.groupName,
              code: item.code,
              updatedAt: nowIso,
              syncState: 'saved-to-api',
            }));

        return {
          savedToServer: true,
          failed: false,
          status: 'connected',
          entries: list,
          message: `${normalizedClass}의 ${list.length}개 모둠 인증코드가 서버(Cloudflare D1)에 일괄 저장되었습니다.`,
        };
      }

      return {
        savedToServer: false,
        failed: true,
        status: response.status >= 500 ? 'not-connected' : 'connected',
        entries: [],
        message:
          typeof data?.error === 'string'
            ? data.error
            : '모둠 인증코드를 일괄 저장하지 못했습니다.',
      };
    }
  } catch {
    // Not connected yet
  }

  const previewEntries: GroupAuthCode[] = cleanedEntries.map((item) => ({
    classRoom: normalizedClass,
    groupName: item.groupName,
    code: item.code,
    updatedAt: nowIso,
    syncState: 'preview-only',
  }));

  return {
    savedToServer: false,
    failed: false,
    status: 'not-connected',
    entries: previewEntries,
    message: `미리보기 모드 (서버에 저장되지 않음): ${normalizedClass} ${previewEntries.length}개 모둠 인증코드가 현재 브라우저 임시 미리보기에만 반영되었습니다.`,
  };
}

export async function deleteGroupCodeFromApi(
  classRoom: string,
  groupName: string
): Promise<ApiDeleteResult> {
  try {
    const params = new URLSearchParams({
      classRoom: classRoom.trim(),
      groupName: groupName.trim(),
    });
    const response = await fetch(
      `${GROUP_CODES_ENDPOINT}?${params.toString()}`,
      {
        method: 'DELETE',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      }
    );
    if (isJsonResponse(response)) {
      const data = await response.json();
      if (response.ok && data?.ok !== false) {
        return { deletedOnServer: true, failed: false, status: 'connected' };
      }
      return {
        deletedOnServer: false,
        failed: true,
        status: response.status >= 500 ? 'not-connected' : 'connected',
        error:
          typeof data?.error === 'string'
            ? data.error
            : '모둠 인증코드를 삭제하지 못했습니다.',
      };
    }
  } catch {
    // Not connected yet
  }
  return { deletedOnServer: false, failed: false, status: 'not-connected' };
}

export async function verifyGroupAuthAndFetchObservations(
  classRoom: string,
  groupName: string,
  code: string,
  previewCodes: GroupAuthCode[],
  previewObservations: ObservationRecord[],
  previewTopics: GroupTopicRecord[] = []
): Promise<ApiVerifyGroupResult> {
  const normalizedClass = classRoom.trim();
  const normalizedGroup = groupName.trim();
  const normalizedCode = code.trim();

  try {
    const response = await fetch(GROUP_VERIFY_ENDPOINT, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        classRoom: normalizedClass,
        groupName: normalizedGroup,
        code: normalizedCode,
      }),
    });

    if (isJsonResponse(response)) {
      const data = await response.json();
      if (response.ok && data?.verified) {
        const list = Array.isArray(data.observations) ? data.observations : [];
        const existingTopic: GroupTopicRecord | null = data.existingTopic
          ? {
              ...(data.existingTopic as GroupTopicRecord),
              syncState: 'saved-to-api',
            }
          : null;

        return {
          verified: true,
          status: 'connected',
          observations: list.map((item: ObservationRecord) => ({
            ...item,
            syncState: 'saved-to-api',
          })),
          existingTopic,
          message: `${normalizedClass} ${normalizedGroup} 인증이 완료되었습니다.`,
        };
      }

      return {
        verified: false,
        status: response.status >= 500 ? 'not-connected' : 'connected',
        observations: [],
        existingTopic: null,
        message:
          data?.message ||
          '모둠 인증코드가 일치하지 않습니다. 선생님께 받은 코드를 다시 확인해 주세요.',
      };
    }
  } catch {
    // Not connected yet; evaluate against teacher-created preview codes
  }

  const matchedCode = previewCodes.find(
    (item) =>
      item.classRoom.trim() === normalizedClass &&
      item.groupName.trim() === normalizedGroup
  );

  if (!matchedCode) {
    return {
      verified: false,
      status: 'not-connected',
      observations: [],
      existingTopic: null,
      message: `아직 "${normalizedClass} ${normalizedGroup}"의 인증코드가 등록되지 않았습니다. 선생님께 모둠 인증코드를 확인해 주세요.`,
    };
  }

  if (matchedCode.code.trim().toLowerCase() !== normalizedCode.toLowerCase()) {
    return {
      verified: false,
      status: 'not-connected',
      observations: [],
      existingTopic: null,
      message:
        '인증코드가 일치하지 않습니다. 선생님께 받은 모둠별 인증코드를 다시 확인해 주세요.',
    };
  }

  const matchedObs = previewObservations.filter(
    (obs) =>
      obs.classRoom.trim() === normalizedClass &&
      obs.groupName.trim() === normalizedGroup
  );

  const matchedTopic =
    previewTopics.find(
      (t) =>
        t.classRoom.trim() === normalizedClass &&
        t.groupName.trim() === normalizedGroup
    ) || null;

  return {
    verified: true,
    status: 'not-connected',
    observations: matchedObs,
    existingTopic: matchedTopic,
    message: `임시 미리보기 인증 완료 (${normalizedClass} ${normalizedGroup}) · 저장소 연결 전이므로 현재 브라우저에 입력된 2차시 기록만 표시됩니다.`,
  };
}
