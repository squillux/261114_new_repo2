import type { GroupTopicRecord } from '../types/observation';

/** 7·8차시 가상 조감도 API (Cloudflare Worker /api/birdseye/*) */

export interface BirdseyeVersion {
  version: number;
  createdAt: string;
}

export interface BirdseyeReview {
  checks: number[];
  extraFix: string;
  fixText: string;
  reflection: string;
  basedOnVersion: number | null;
}

export interface GroupCredential {
  classRoom: string;
  groupName: string;
  code: string;
}

export interface StudentBirdseyeData {
  classRoom: string;
  groupName: string;
  topic: GroupTopicRecord | null;
  promptFields: Record<string, string> | null;
  promptText: string;
  promptSubmittedAt: string;
  review: BirdseyeReview | null;
  reviewSavedAt: string;
  versions: BirdseyeVersion[];
  finalVersion: number | null;
  finalImageDataUrl: string;
}

export interface TeacherBirdseyeGroup {
  classRoom: string;
  groupName: string;
  projectTitle: string;
  selectedLocation: string;
  hasReferencePhoto: boolean;
  promptText: string;
  promptSubmittedAt: string;
  review: BirdseyeReview | null;
  reviewSavedAt: string;
  versions: BirdseyeVersion[];
  finalVersion: number | null;
}

export type ApiResult<T> =
  | ({ ok: true } & T)
  | { ok: false; error: string; status: number };

const CREDENTIAL_KEY = 'smart_eco_school_birdseye_group_v1';

async function request<T>(
  url: string,
  init: RequestInit = {}
): Promise<ApiResult<T>> {
  try {
    const response = await fetch(url, {
      credentials: 'same-origin',
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
    });
    const type = response.headers.get('Content-Type') || '';
    if (!type.includes('application/json')) {
      return {
        ok: false,
        status: response.status,
        error:
          '서버에 연결되지 않았습니다. Cloudflare에 배포된 주소에서 이용해 주세요.',
      };
    }
    const data = await response.json();
    if (!response.ok || data?.ok === false) {
      return {
        ok: false,
        status: response.status,
        error:
          typeof data?.error === 'string'
            ? data.error
            : '요청을 처리하지 못했습니다.',
      };
    }
    return { ok: true, ...(data as T) };
  } catch {
    return {
      ok: false,
      status: 0,
      error: '네트워크 연결을 확인한 뒤 다시 시도해 주세요.',
    };
  }
}

const post = <T>(url: string, body: unknown) =>
  request<T>(url, { method: 'POST', body: JSON.stringify(body) });

/* ---------- 학생 ---------- */

export function loadSavedCredential(): GroupCredential | null {
  try {
    const raw = sessionStorage.getItem(CREDENTIAL_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.classRoom && parsed?.groupName && parsed?.code) return parsed;
  } catch {
    // ignore
  }
  return null;
}

export function saveCredential(cred: GroupCredential | null): void {
  try {
    if (cred) sessionStorage.setItem(CREDENTIAL_KEY, JSON.stringify(cred));
    else sessionStorage.removeItem(CREDENTIAL_KEY);
  } catch {
    // ignore
  }
}

export const fetchStudentBirdseye = (cred: GroupCredential) =>
  post<StudentBirdseyeData>('/api/birdseye/student/load', cred);

export const fetchStudentStatus = (cred: GroupCredential) =>
  post<{ versions: BirdseyeVersion[]; finalVersion: number | null }>(
    '/api/birdseye/student/status',
    cred
  );

export const fetchStudentImage = (cred: GroupCredential, version: number) =>
  post<{ version: number; dataUrl: string; createdAt: string }>(
    '/api/birdseye/student/image',
    { ...cred, version }
  );

export const submitBirdseyePrompt = (
  cred: GroupCredential,
  promptFields: Record<string, string>,
  promptText: string
) =>
  post<{ promptSubmittedAt: string }>('/api/birdseye/student/prompt', {
    ...cred,
    promptFields,
    promptText,
  });

export const submitBirdseyeReview = (
  cred: GroupCredential,
  review: BirdseyeReview
) =>
  post<{ reviewSavedAt: string }>('/api/birdseye/student/review', {
    ...cred,
    review,
  });

/* ---------- 교사 ---------- */

export const fetchTeacherBirdseyeOverview = () =>
  request<{ groups: TeacherBirdseyeGroup[] }>('/api/birdseye/teacher/overview');

const groupQuery = (classRoom: string, groupName: string) =>
  `classRoom=${encodeURIComponent(classRoom)}&groupName=${encodeURIComponent(groupName)}`;

export const fetchTeacherBirdseyeImage = (
  classRoom: string,
  groupName: string,
  version: number
) =>
  request<{ version: number; dataUrl: string; createdAt: string }>(
    `/api/birdseye/teacher/image?${groupQuery(classRoom, groupName)}&version=${version}`
  );

export const fetchTeacherReferencePhoto = (classRoom: string, groupName: string) =>
  request<{ dataUrl: string }>(
    `/api/birdseye/teacher/reference?${groupQuery(classRoom, groupName)}`
  );

export const uploadTeacherBirdseyeImage = (
  classRoom: string,
  groupName: string,
  imageDataUrl: string
) =>
  post<{ version: number; createdAt: string }>('/api/birdseye/teacher/images', {
    classRoom,
    groupName,
    imageDataUrl,
  });

export const setTeacherFinalVersion = (
  classRoom: string,
  groupName: string,
  version: number
) =>
  post<{ finalVersion: number }>('/api/birdseye/teacher/final', {
    classRoom,
    groupName,
    version,
  });

export const deleteTeacherBirdseyeImage = (
  classRoom: string,
  groupName: string,
  version: number
) =>
  request<{ deletedVersion: number }>('/api/birdseye/teacher/images', {
    method: 'DELETE',
    body: JSON.stringify({ classRoom, groupName, version }),
  });
