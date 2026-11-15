export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  TEACHER_PASSWORD?: string;
}

const SESSION_COOKIE_NAME = 'smart_eco_teacher_session';
const SESSION_TTL_SECONDS = 60 * 60 * 4;
const MAX_JSON_BYTES = 1_200_000;
const MAX_PHOTO_DATA_URL_LENGTH = 750_000;

interface ObservationRow {
  id: string;
  class_room: string;
  student_number: string;
  author_alias: string;
  group_name: string;
  location_category: string;
  location_detail: string;
  waste_scene: string;
  waste_cause: string;
  sensor_idea: string;
  photo_data_url: string;
  photo_caption: string;
  privacy_confirmed: number;
  created_at: string;
}

interface GroupCodeRow {
  class_room: string;
  group_name: string;
  auth_code: string;
  updated_at: string;
}

interface GroupTopicRow {
  id: string;
  class_room: string;
  group_name: string;
  group_members: string;
  selected_location: string;
  reference_photo_data_url: string;
  project_title: string;
  core_question: string;
  selection_reason: string;
  control_condition_when: string;
  control_condition_then: string;
  control_condition_draft: string;
  created_at: string;
}

function jsonResponse(
  body: unknown,
  status = 200,
  extraHeaders?: Record<string, string>
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...extraHeaders,
    },
  });
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function fromBase64Url(value: string): Uint8Array | null {
  try {
    const padded =
      value.replace(/-/g, '+').replace(/_/g, '/') +
      '='.repeat((4 - (value.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}

async function importSessionKey(secret: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = encoder.encode(`smart-eco-session-v1:${secret}`);
  return crypto.subtle.importKey(
    'raw',
    keyMaterial,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

async function timingSafePasswordEqual(
  input: string,
  expected: string
): Promise<boolean> {
  const encoder = new TextEncoder();
  const [hashA, hashB] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(input)),
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
  ]);
  const bytesA = new Uint8Array(hashA);
  const bytesB = new Uint8Array(hashB);
  let diff = 0;
  for (let i = 0; i < bytesA.length; i += 1) {
    diff |= bytesA[i] ^ bytesB[i];
  }
  return diff === 0;
}

async function createSessionToken(secret: string): Promise<string> {
  const exp = Date.now() + SESSION_TTL_SECONDS * 1000;
  const nonceBytes = new Uint8Array(16);
  crypto.getRandomValues(nonceBytes);
  const payloadText = `${exp}.${toBase64Url(nonceBytes)}`;
  const key = await importSessionKey(secret);
  const sigBuffer = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(payloadText)
  );
  const sigText = toBase64Url(new Uint8Array(sigBuffer));
  return `${payloadText}.${sigText}`;
}

async function verifySessionToken(
  token: string,
  secret: string
): Promise<boolean> {
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [expText, nonceText, sigText] = parts;
  if (!expText || !nonceText || !sigText) return false;

  const exp = Number(expText);
  if (!Number.isFinite(exp) || Date.now() > exp) return false;

  const sigBytes = fromBase64Url(sigText);
  if (!sigBytes) return false;

  const key = await importSessionKey(secret);
  const payloadBytes = new TextEncoder().encode(`${expText}.${nonceText}`);
  return crypto.subtle.verify('HMAC', key, sigBytes, payloadBytes);
}

function getCookieValue(request: Request, name: string): string | null {
  const cookieHeader = request.headers.get('Cookie');
  if (!cookieHeader) return null;
  const pairs = cookieHeader.split(';');
  for (const pair of pairs) {
    const eqIndex = pair.indexOf('=');
    if (eqIndex <= 0) continue;
    const key = pair.slice(0, eqIndex).trim();
    if (key === name) {
      return decodeURIComponent(pair.slice(eqIndex + 1).trim());
    }
  }
  return null;
}

function buildCookieHeader(
  value: string,
  maxAge: number,
  isHttps: boolean
): string {
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
  ];
  if (isHttps) {
    parts.push('Secure');
  }
  return parts.join('; ');
}

async function isTeacherAuthenticated(
  request: Request,
  env: Env
): Promise<boolean> {
  const secret = env.TEACHER_PASSWORD?.trim();
  if (!secret) return false;
  const token = getCookieValue(request, SESSION_COOKIE_NAME);
  if (!token) return false;
  return verifySessionToken(token, secret);
}

async function readJsonBody(
  request: Request
): Promise<
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; response: Response }
> {
  const contentLengthHeader = request.headers.get('Content-Length');
  if (contentLengthHeader) {
    const declaredLength = Number(contentLengthHeader);
    if (Number.isFinite(declaredLength) && declaredLength > MAX_JSON_BYTES) {
      return {
        ok: false,
        response: jsonResponse(
          {
            ok: false,
            error:
              '전송 용량이 너무 큽니다. 사진 크기를 줄여서 다시 시도해 주세요.',
          },
          413
        ),
      };
    }
  }

  let rawText = '';
  try {
    rawText = await request.text();
  } catch {
    return {
      ok: false,
      response: jsonResponse(
        { ok: false, error: '요청 본문을 읽을 수 없습니다.' },
        400
      ),
    };
  }

  if (new TextEncoder().encode(rawText).byteLength > MAX_JSON_BYTES) {
    return {
      ok: false,
      response: jsonResponse(
        {
          ok: false,
          error:
            '전송 용량이 너무 큽니다. 사진 크기를 줄여서 다시 시도해 주세요.',
        },
        413
      ),
    };
  }

  try {
    const parsed: unknown = JSON.parse(rawText);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {
        ok: false,
        response: jsonResponse(
          { ok: false, error: '올바른 JSON 형식의 요청이 아닙니다.' },
          400
        ),
      };
    }
    return { ok: true, data: parsed as Record<string, unknown> };
  } catch {
    return {
      ok: false,
      response: jsonResponse(
        { ok: false, error: 'JSON 데이터를 해석하지 못했습니다.' },
        400
      ),
    };
  }
}

function readRequiredString(
  data: Record<string, unknown>,
  key: string,
  label: string,
  maxLength: number
): { ok: true; value: string } | { ok: false; error: string } {
  const raw = data[key];
  if (typeof raw !== 'string') {
    return { ok: false, error: `${label} 항목을 입력해 주세요.` };
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, error: `${label} 항목을 비워 둘 수 없습니다.` };
  }
  if (trimmed.length > maxLength) {
    return {
      ok: false,
      error: `${label} 항목은 최대 ${maxLength}자까지 입력할 수 있습니다.`,
    };
  }
  return { ok: true, value: trimmed };
}

function readOptionalString(
  data: Record<string, unknown>,
  key: string,
  label: string,
  maxLength: number
): { ok: true; value: string } | { ok: false; error: string } {
  const raw = data[key];
  if (raw === undefined || raw === null) {
    return { ok: true, value: '' };
  }
  if (typeof raw !== 'string') {
    return { ok: false, error: `${label} 항목의 형식이 올바르지 않습니다.` };
  }
  const trimmed = raw.trim();
  if (trimmed.length > maxLength) {
    return {
      ok: false,
      error: `${label} 항목은 최대 ${maxLength}자까지 입력할 수 있습니다.`,
    };
  }
  return { ok: true, value: trimmed };
}

function validatePhotoDataUrl(
  raw: unknown
): { ok: true; value: string } | { ok: false; error: string } {
  if (raw === undefined || raw === null || raw === '') {
    return { ok: true, value: '' };
  }
  if (typeof raw !== 'string') {
    return { ok: false, error: '사진 데이터 형식이 올바르지 않습니다.' };
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: true, value: '' };
  }
  if (trimmed.length > MAX_PHOTO_DATA_URL_LENGTH) {
    return {
      ok: false,
      error:
        '사진 용량이 너무 큽니다. 조금 더 가벼운 사진으로 다시 촬영하거나 올려 주세요.',
    };
  }
  if (!/^data:image\/(jpeg|jpg|png|webp|gif);base64,/i.test(trimmed)) {
    return {
      ok: false,
      error: '지원하지 않는 이미지 형식입니다. (JPEG, PNG, WebP, GIF만 허용)',
    };
  }
  return { ok: true, value: trimmed };
}

function mapObservationRow(row: ObservationRow) {
  return {
    id: row.id,
    classRoom: row.class_room,
    classInfo: row.student_number,
    authorName: row.author_alias,
    groupName: row.group_name,
    locationCategory: row.location_category,
    locationDetail: row.location_detail,
    wasteScene: row.waste_scene,
    wasteCause: row.waste_cause,
    sensorIdea: row.sensor_idea,
    photoDataUrl: row.photo_data_url,
    photoCaption: row.photo_caption,
    privacyConfirmed: Boolean(row.privacy_confirmed),
    createdAt: row.created_at,
  };
}

function mapGroupTopicRow(row: GroupTopicRow) {
  return {
    id: row.id,
    classRoom: row.class_room,
    groupName: row.group_name,
    groupMembers: row.group_members,
    selectedLocation: row.selected_location,
    referencePhotoDataUrl: row.reference_photo_data_url,
    projectTitle: row.project_title,
    coreQuestion: row.core_question,
    selectionReason: row.selection_reason,
    controlConditionWhen: row.control_condition_when,
    controlConditionThen: row.control_condition_then,
    controlConditionDraft: row.control_condition_draft,
    createdAt: row.created_at,
  };
}

async function handleHealth(env: Env): Promise<Response> {
  if (!env.DB) {
    return jsonResponse(
      {
        ok: false,
        connected: false,
        tablesReady: false,
        error: 'D1 데이터베이스(DB)가 연결되지 않았습니다.',
      },
      503
    );
  }

  try {
    const result = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('observations', 'group_auth_codes', 'group_topics')"
    ).all<{ name: string }>();
    const names = new Set((result.results || []).map((row) => row.name));
    const tablesReady =
      names.has('observations') &&
      names.has('group_auth_codes') &&
      names.has('group_topics');

    if (!tablesReady) {
      return jsonResponse(
        {
          ok: false,
          connected: false,
          tablesReady: false,
          error:
            'D1 데이터베이스 테이블이 아직 생성되지 않았습니다. D1 Console에서 setup.sql을 실행해 주세요.',
        },
        503
      );
    }

    return jsonResponse({
      ok: true,
      connected: true,
      tablesReady: true,
      hasTeacherPassword: Boolean(env.TEACHER_PASSWORD?.trim()),
    });
  } catch {
    return jsonResponse(
      {
        ok: false,
        connected: false,
        tablesReady: false,
        error: 'D1 데이터베이스 연결 확인 중 오류가 발생했습니다.',
      },
      503
    );
  }
}

async function handleApiRequest(
  request: Request,
  env: Env,
  url: URL
): Promise<Response> {
  const path = url.pathname;
  const method = request.method.toUpperCase();
  const isHttps = url.protocol === 'https:';

  if (method === 'GET' && path === '/api/health') {
    return handleHealth(env);
  }

  if (method === 'GET' && path === '/api/teacher/session') {
    const configured = Boolean(env.TEACHER_PASSWORD?.trim());
    const authenticated = await isTeacherAuthenticated(request, env);
    return jsonResponse({ ok: true, authenticated, configured });
  }

  if (method === 'POST' && path === '/api/teacher/login') {
    const expected = env.TEACHER_PASSWORD?.trim();
    if (!expected) {
      return jsonResponse(
        {
          ok: false,
          error:
            '서버에 교사 비밀번호(TEACHER_PASSWORD Secret)가 아직 설정되지 않았습니다.',
        },
        503
      );
    }

    const parsed = await readJsonBody(request);
    if (!parsed.ok) return parsed.response;

    const password = parsed.data.password;
    if (typeof password !== 'string' || !password.trim()) {
      return jsonResponse(
        { ok: false, error: '교사 비밀번호를 입력해 주세요.' },
        400
      );
    }
    if (password.length > 200) {
      return jsonResponse(
        { ok: false, error: '비밀번호 길이가 허용 범위를 초과했습니다.' },
        400
      );
    }

    const matched = await timingSafePasswordEqual(password, expected);
    if (!matched) {
      return jsonResponse(
        { ok: false, error: '교사 비밀번호가 일치하지 않습니다.' },
        401
      );
    }

    const token = await createSessionToken(expected);
    return jsonResponse(
      { ok: true, authenticated: true },
      200,
      {
        'Set-Cookie': buildCookieHeader(token, SESSION_TTL_SECONDS, isHttps),
      }
    );
  }

  if (method === 'POST' && path === '/api/teacher/logout') {
    return jsonResponse(
      { ok: true, authenticated: false },
      200,
      {
        'Set-Cookie': buildCookieHeader('', 0, isHttps),
      }
    );
  }

  if (method === 'GET' && path === '/api/observations') {
    const authorized = await isTeacherAuthenticated(request, env);
    if (!authorized) {
      return jsonResponse(
        {
          ok: false,
          error: '교사 로그인 후에만 전체 학생 관찰 일지를 조회할 수 있습니다.',
        },
        401
      );
    }

    try {
      const result = await env.DB.prepare(
        'SELECT id, class_room, student_number, author_alias, group_name, location_category, location_detail, waste_scene, waste_cause, sensor_idea, photo_data_url, photo_caption, privacy_confirmed, created_at FROM observations ORDER BY created_at DESC LIMIT 500'
      ).all<ObservationRow>();

      return jsonResponse({
        ok: true,
        observations: (result.results || []).map(mapObservationRow),
      });
    } catch {
      return jsonResponse(
        {
          ok: false,
          error: 'D1 데이터베이스에서 관찰 일지를 불러오지 못했습니다.',
        },
        500
      );
    }
  }

  if (method === 'POST' && path === '/api/observations') {
    const parsed = await readJsonBody(request);
    if (!parsed.ok) return parsed.response;

    const d = parsed.data;
    const classRoom = readRequiredString(d, 'classRoom', '학급(반)', 30);
    if (!classRoom.ok) return jsonResponse({ ok: false, error: classRoom.error }, 400);

    const studentNumber = readRequiredString(d, 'classInfo', '학번', 40);
    if (!studentNumber.ok) {
      return jsonResponse({ ok: false, error: studentNumber.error }, 400);
    }

    const authorAlias = readRequiredString(d, 'authorName', '이름(별칭)', 40);
    if (!authorAlias.ok) {
      return jsonResponse({ ok: false, error: authorAlias.error }, 400);
    }

    const groupName = readRequiredString(d, 'groupName', '소속 모둠', 30);
    if (!groupName.ok) return jsonResponse({ ok: false, error: groupName.error }, 400);

    const locationCategory = readRequiredString(
      d,
      'locationCategory',
      '관찰한 학교 공간',
      30
    );
    if (!locationCategory.ok) {
      return jsonResponse({ ok: false, error: locationCategory.error }, 400);
    }

    const locationDetail = readOptionalString(
      d,
      'locationDetail',
      '세부 위치',
      80
    );
    if (!locationDetail.ok) {
      return jsonResponse({ ok: false, error: locationDetail.error }, 400);
    }

    const wasteScene = readRequiredString(
      d,
      'wasteScene',
      '발견한 에너지 낭비 장면',
      500
    );
    if (!wasteScene.ok) {
      return jsonResponse({ ok: false, error: wasteScene.error }, 400);
    }

    const wasteCause = readRequiredString(
      d,
      'wasteCause',
      '원인과 불편한 점',
      400
    );
    if (!wasteCause.ok) {
      return jsonResponse({ ok: false, error: wasteCause.error }, 400);
    }

    const sensorIdea = readOptionalString(
      d,
      'sensorIdea',
      '센서와 코딩 아이디어',
      250
    );
    if (!sensorIdea.ok) {
      return jsonResponse({ ok: false, error: sensorIdea.error }, 400);
    }

    const photoDataUrl = validatePhotoDataUrl(d.photoDataUrl);
    if (!photoDataUrl.ok) {
      return jsonResponse({ ok: false, error: photoDataUrl.error }, 400);
    }

    const photoCaption = readOptionalString(d, 'photoCaption', '사진 설명', 100);
    if (!photoCaption.ok) {
      return jsonResponse({ ok: false, error: photoCaption.error }, 400);
    }

    if (d.privacyConfirmed !== true) {
      return jsonResponse(
        {
          ok: false,
          error: '사진 촬영 및 디지털 안전 약속 확인에 체크해 주세요.',
        },
        400
      );
    }

    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();

    try {
      await env.DB.prepare(
        'INSERT INTO observations (id, class_room, student_number, author_alias, group_name, location_category, location_detail, waste_scene, waste_cause, sensor_idea, photo_data_url, photo_caption, privacy_confirmed, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      )
        .bind(
          id,
          classRoom.value,
          studentNumber.value,
          authorAlias.value,
          groupName.value,
          locationCategory.value,
          locationDetail.value,
          wasteScene.value,
          wasteCause.value,
          sensorIdea.value,
          photoDataUrl.value,
          photoCaption.value,
          1,
          createdAt
        )
        .run();

      return jsonResponse({ ok: true, id, createdAt }, 201);
    } catch {
      return jsonResponse(
        {
          ok: false,
          error:
            '관찰 일지를 데이터베이스에 저장하지 못했습니다. D1 테이블 설정을 확인해 주세요.',
        },
        500
      );
    }
  }

  if (method === 'DELETE' && path.startsWith('/api/observations/')) {
    const authorized = await isTeacherAuthenticated(request, env);
    if (!authorized) {
      return jsonResponse(
        { ok: false, error: '교사 로그인 후에만 기록을 삭제할 수 있습니다.' },
        401
      );
    }

    const id = decodeURIComponent(path.slice('/api/observations/'.length)).trim();
    if (!id || id.length > 80) {
      return jsonResponse(
        { ok: false, error: '삭제할 기록 ID가 올바르지 않습니다.' },
        400
      );
    }

    try {
      await env.DB.prepare('DELETE FROM observations WHERE id = ?')
        .bind(id)
        .run();
      return jsonResponse({ ok: true, deletedId: id });
    } catch {
      return jsonResponse(
        { ok: false, error: '관찰 일지를 삭제하지 못했습니다.' },
        500
      );
    }
  }

  if (method === 'GET' && path === '/api/group-codes') {
    const authorized = await isTeacherAuthenticated(request, env);
    if (!authorized) {
      return jsonResponse(
        { ok: false, error: '교사 로그인 후에만 모둠 인증코드를 조회할 수 있습니다.' },
        401
      );
    }

    try {
      const result = await env.DB.prepare(
        'SELECT class_room, group_name, auth_code, updated_at FROM group_auth_codes ORDER BY class_room ASC, group_name ASC'
      ).all<GroupCodeRow>();

      const codes = (result.results || []).map((row) => ({
        classRoom: row.class_room,
        groupName: row.group_name,
        code: row.auth_code,
        updatedAt: row.updated_at,
      }));

      return jsonResponse({ ok: true, codes });
    } catch {
      return jsonResponse(
        { ok: false, error: '모둠 인증코드 목록을 불러오지 못했습니다.' },
        500
      );
    }
  }

  if (method === 'POST' && path === '/api/group-codes') {
    const authorized = await isTeacherAuthenticated(request, env);
    if (!authorized) {
      return jsonResponse(
        { ok: false, error: '교사 로그인 후에만 모둠 인증코드를 등록할 수 있습니다.' },
        401
      );
    }

    const parsed = await readJsonBody(request);
    if (!parsed.ok) return parsed.response;

    const classRoom = readRequiredString(
      parsed.data,
      'classRoom',
      '학급(반)',
      30
    );
    if (!classRoom.ok) {
      return jsonResponse({ ok: false, error: classRoom.error }, 400);
    }

    const groupName = readRequiredString(
      parsed.data,
      'groupName',
      '모둠 이름',
      30
    );
    if (!groupName.ok) {
      return jsonResponse({ ok: false, error: groupName.error }, 400);
    }

    const code = readRequiredString(parsed.data, 'code', '모둠 인증코드', 24);
    if (!code.ok) {
      return jsonResponse({ ok: false, error: code.error }, 400);
    }

    const updatedAt = new Date().toISOString();

    try {
      await env.DB.prepare(
        'INSERT INTO group_auth_codes (class_room, group_name, auth_code, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(class_room, group_name) DO UPDATE SET auth_code = excluded.auth_code, updated_at = excluded.updated_at'
      )
        .bind(classRoom.value, groupName.value, code.value, updatedAt)
        .run();

      return jsonResponse(
        {
          ok: true,
          classRoom: classRoom.value,
          groupName: groupName.value,
          code: code.value,
          updatedAt,
        },
        200
      );
    } catch {
      return jsonResponse(
        { ok: false, error: '모둠 인증코드를 저장하지 못했습니다.' },
        500
      );
    }
  }

  if (method === 'DELETE' && path === '/api/group-codes') {
    const authorized = await isTeacherAuthenticated(request, env);
    if (!authorized) {
      return jsonResponse(
        { ok: false, error: '교사 로그인 후에만 모둠 인증코드를 삭제할 수 있습니다.' },
        401
      );
    }

    let classRoomValue = (url.searchParams.get('classRoom') || '').trim();
    let groupNameValue = (url.searchParams.get('groupName') || '').trim();

    if (!classRoomValue || !groupNameValue) {
      const parsed = await readJsonBody(request);
      if (parsed.ok) {
        if (typeof parsed.data.classRoom === 'string') {
          classRoomValue = parsed.data.classRoom.trim();
        }
        if (typeof parsed.data.groupName === 'string') {
          groupNameValue = parsed.data.groupName.trim();
        }
      }
    }

    if (!classRoomValue || !groupNameValue) {
      return jsonResponse(
        { ok: false, error: '삭제할 학급(반)과 모둠 이름이 필요합니다.' },
        400
      );
    }

    try {
      await env.DB.prepare(
        'DELETE FROM group_auth_codes WHERE class_room = ? AND group_name = ?'
      )
        .bind(classRoomValue, groupNameValue)
        .run();

      return jsonResponse({ ok: true });
    } catch {
      return jsonResponse(
        { ok: false, error: '모둠 인증코드를 삭제하지 못했습니다.' },
        500
      );
    }
  }

  if (method === 'POST' && path === '/api/group-observations/verify') {
    const parsed = await readJsonBody(request);
    if (!parsed.ok) return parsed.response;

    const classRoom = readRequiredString(
      parsed.data,
      'classRoom',
      '학급(반)',
      30
    );
    if (!classRoom.ok) {
      return jsonResponse(
        { verified: false, message: classRoom.error },
        400
      );
    }

    const groupName = readRequiredString(
      parsed.data,
      'groupName',
      '모둠 이름',
      30
    );
    if (!groupName.ok) {
      return jsonResponse(
        { verified: false, message: groupName.error },
        400
      );
    }

    const code = readRequiredString(
      parsed.data,
      'code',
      '모둠 인증코드',
      24
    );
    if (!code.ok) {
      return jsonResponse({ verified: false, message: code.error }, 400);
    }

    try {
      const codeRow = await env.DB.prepare(
        'SELECT auth_code FROM group_auth_codes WHERE class_room = ? AND group_name = ?'
      )
        .bind(classRoom.value, groupName.value)
        .first<{ auth_code: string }>();

      if (!codeRow) {
        return jsonResponse(
          {
            verified: false,
            message: `아직 "${classRoom.value} ${groupName.value}"의 인증코드가 등록되지 않았습니다. 선생님께 확인해 주세요.`,
          },
          404
        );
      }

      if (
        codeRow.auth_code.trim().toLowerCase() !==
        code.value.trim().toLowerCase()
      ) {
        return jsonResponse(
          {
            verified: false,
            message:
              '모둠 인증코드가 일치하지 않습니다. 선생님께 받은 코드를 다시 확인해 주세요.',
          },
          401
        );
      }

      const obsResult = await env.DB.prepare(
        'SELECT id, class_room, student_number, author_alias, group_name, location_category, location_detail, waste_scene, waste_cause, sensor_idea, photo_data_url, photo_caption, privacy_confirmed, created_at FROM observations WHERE class_room = ? AND group_name = ? ORDER BY created_at DESC LIMIT 100'
      )
        .bind(classRoom.value, groupName.value)
        .all<ObservationRow>();

      return jsonResponse({
        verified: true,
        observations: (obsResult.results || []).map(mapObservationRow),
      });
    } catch {
      return jsonResponse(
        {
          verified: false,
          message: '모둠 인증 확인 중 데이터베이스 오류가 발생했습니다.',
        },
        500
      );
    }
  }

  if (method === 'GET' && path === '/api/group-topics') {
    const authorized = await isTeacherAuthenticated(request, env);
    if (!authorized) {
      return jsonResponse(
        {
          ok: false,
          error: '교사 로그인 후에만 전체 모둠 프로젝트 주제를 조회할 수 있습니다.',
        },
        401
      );
    }

    try {
      const result = await env.DB.prepare(
        'SELECT id, class_room, group_name, group_members, selected_location, reference_photo_data_url, project_title, core_question, selection_reason, control_condition_when, control_condition_then, control_condition_draft, created_at FROM group_topics ORDER BY created_at DESC LIMIT 200'
      ).all<GroupTopicRow>();

      return jsonResponse({
        ok: true,
        topics: (result.results || []).map(mapGroupTopicRow),
      });
    } catch {
      return jsonResponse(
        { ok: false, error: '모둠별 주제 목록을 불러오지 못했습니다.' },
        500
      );
    }
  }

  if (method === 'POST' && path === '/api/group-topics') {
    const parsed = await readJsonBody(request);
    if (!parsed.ok) return parsed.response;

    const d = parsed.data;
    const classRoom = readRequiredString(d, 'classRoom', '학급(반)', 30);
    if (!classRoom.ok) return jsonResponse({ ok: false, error: classRoom.error }, 400);

    const groupName = readRequiredString(d, 'groupName', '모둠 이름', 30);
    if (!groupName.ok) return jsonResponse({ ok: false, error: groupName.error }, 400);

    const groupMembers = readRequiredString(
      d,
      'groupMembers',
      '함께 정한 모둠원',
      100
    );
    if (!groupMembers.ok) {
      return jsonResponse({ ok: false, error: groupMembers.error }, 400);
    }

    const selectedLocation = readRequiredString(
      d,
      'selectedLocation',
      '최종 선정한 학교 공간',
      200
    );
    if (!selectedLocation.ok) {
      return jsonResponse({ ok: false, error: selectedLocation.error }, 400);
    }

    const referencePhotoDataUrl = validatePhotoDataUrl(
      d.referencePhotoDataUrl
    );
    if (!referencePhotoDataUrl.ok) {
      return jsonResponse(
        { ok: false, error: referencePhotoDataUrl.error },
        400
      );
    }

    const projectTitle = readRequiredString(
      d,
      'projectTitle',
      '최종 모둠 프로젝트 주제',
      140
    );
    if (!projectTitle.ok) {
      return jsonResponse({ ok: false, error: projectTitle.error }, 400);
    }

    const coreQuestion = readRequiredString(
      d,
      'coreQuestion',
      '모둠 핵심 질문',
      300
    );
    if (!coreQuestion.ok) {
      return jsonResponse({ ok: false, error: coreQuestion.error }, 400);
    }

    const selectionReason = readRequiredString(
      d,
      'selectionReason',
      '주제를 선정한 이유',
      400
    );
    if (!selectionReason.ok) {
      return jsonResponse({ ok: false, error: selectionReason.error }, 400);
    }

    const controlConditionWhen = readOptionalString(
      d,
      'controlConditionWhen',
      '센서 입력 조건',
      220
    );
    if (!controlConditionWhen.ok) {
      return jsonResponse(
        { ok: false, error: controlConditionWhen.error },
        400
      );
    }

    const controlConditionThen = readOptionalString(
      d,
      'controlConditionThen',
      '작동 출력',
      220
    );
    if (!controlConditionThen.ok) {
      return jsonResponse(
        { ok: false, error: controlConditionThen.error },
        400
      );
    }

    const controlConditionDraft = readOptionalString(
      d,
      'controlConditionDraft',
      '제어 조건 초안',
      450
    );
    if (!controlConditionDraft.ok) {
      return jsonResponse(
        { ok: false, error: controlConditionDraft.error },
        400
      );
    }

    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();

    try {
      await env.DB.prepare(
        'INSERT INTO group_topics (id, class_room, group_name, group_members, selected_location, reference_photo_data_url, project_title, core_question, selection_reason, control_condition_when, control_condition_then, control_condition_draft, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(class_room, group_name) DO UPDATE SET id = excluded.id, group_members = excluded.group_members, selected_location = excluded.selected_location, reference_photo_data_url = excluded.reference_photo_data_url, project_title = excluded.project_title, core_question = excluded.core_question, selection_reason = excluded.selection_reason, control_condition_when = excluded.control_condition_when, control_condition_then = excluded.control_condition_then, control_condition_draft = excluded.control_condition_draft, created_at = excluded.created_at'
      )
        .bind(
          id,
          classRoom.value,
          groupName.value,
          groupMembers.value,
          selectedLocation.value,
          referencePhotoDataUrl.value,
          projectTitle.value,
          coreQuestion.value,
          selectionReason.value,
          controlConditionWhen.value,
          controlConditionThen.value,
          controlConditionDraft.value,
          createdAt
        )
        .run();

      return jsonResponse({ ok: true, id, createdAt }, 201);
    } catch {
      return jsonResponse(
        {
          ok: false,
          error: '모둠 프로젝트 주제를 데이터베이스에 저장하지 못했습니다.',
        },
        500
      );
    }
  }

  if (method === 'DELETE' && path.startsWith('/api/group-topics/')) {
    const authorized = await isTeacherAuthenticated(request, env);
    if (!authorized) {
      return jsonResponse(
        { ok: false, error: '교사 로그인 후에만 모둠 주제를 삭제할 수 있습니다.' },
        401
      );
    }

    const id = decodeURIComponent(path.slice('/api/group-topics/'.length)).trim();
    if (!id || id.length > 80) {
      return jsonResponse(
        { ok: false, error: '삭제할 주제 ID가 올바르지 않습니다.' },
        400
      );
    }

    try {
      await env.DB.prepare('DELETE FROM group_topics WHERE id = ?')
        .bind(id)
        .run();
      return jsonResponse({ ok: true, deletedId: id });
    } catch {
      return jsonResponse(
        { ok: false, error: '모둠 주제를 삭제하지 못했습니다.' },
        500
      );
    }
  }

  return jsonResponse({ ok: false, error: '지원하지 않는 API 경로입니다.' }, 404);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      return handleApiRequest(request, env, url);
    }
    return env.ASSETS.fetch(request);
  },
};
