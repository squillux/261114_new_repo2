export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  TEACHER_PASSWORD?: string;
}

const SESSION_COOKIE_NAME = 'smart_eco_teacher_session';
const SESSION_TTL_SECONDS = 60 * 60 * 4;
const MAX_JSON_BYTES = 2_000_000;
const MAX_PHOTO_DATA_URL_LENGTH = 750_000;

/* 3~4차시 순서도 사진 (종이 활동지 촬영본) — 주제 표와 분리해 저장 */
let flowchartSchemaReady = false;
async function ensureFlowchartTable(env: Env): Promise<void> {
  if (flowchartSchemaReady) return;
  await env.DB.prepare(
    'CREATE TABLE IF NOT EXISTS group_flowcharts (class_room TEXT NOT NULL, group_name TEXT NOT NULL, image_data_url TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY (class_room, group_name))'
  ).run();
  flowchartSchemaReady = true;
}

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

interface ObservationLiteRow {
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
  has_photo: number;
  photo_caption: string;
  privacy_confirmed: number;
  created_at: string;
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
    hasPhoto: Boolean(row.photo_data_url),
    photoCaption: row.photo_caption,
    privacyConfirmed: Boolean(row.privacy_confirmed),
    createdAt: row.created_at,
  };
}

function mapObservationLiteRow(row: ObservationLiteRow) {
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
    photoDataUrl: '',
    hasPhoto: Boolean(row.has_photo),
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

    const requestedClass = (url.searchParams.get('classRoom') || '').trim();
    const classFilter =
      requestedClass && requestedClass !== 'all' ? requestedClass : '';
    const includePhotosParam = url.searchParams.get('includePhotos');

    try {
      const classesResult = await env.DB.prepare(
        'SELECT DISTINCT class_room FROM observations ORDER BY class_room ASC'
      ).all<{ class_room: string }>();
      const availableClasses = (classesResult.results || [])
        .map((r) => r.class_room)
        .filter(Boolean);

      if (classFilter) {
        const result = await env.DB.prepare(
          'SELECT id, class_room, student_number, author_alias, group_name, location_category, location_detail, waste_scene, waste_cause, sensor_idea, photo_data_url, photo_caption, privacy_confirmed, created_at FROM observations WHERE class_room = ? ORDER BY created_at DESC LIMIT 1000'
        )
          .bind(classFilter)
          .all<ObservationRow>();

        const mapped = (result.results || []).map(mapObservationRow);
        return jsonResponse({
          ok: true,
          observations: mapped,
          totalCount: mapped.length,
          availableClasses,
          photosDeferred: false,
        });
      }

      const countRow = await env.DB.prepare(
        'SELECT COUNT(*) AS total FROM observations'
      ).first<{ total: number }>();
      const totalCount = Number(countRow?.total || 0);

      const shouldDeferPhotos =
        includePhotosParam === '0' ||
        (includePhotosParam !== '1' && totalCount > 120);

      if (shouldDeferPhotos) {
        const result = await env.DB.prepare(
          "SELECT id, class_room, student_number, author_alias, group_name, location_category, location_detail, waste_scene, waste_cause, sensor_idea, (photo_data_url != '') AS has_photo, photo_caption, privacy_confirmed, created_at FROM observations ORDER BY created_at DESC LIMIT 2000"
        ).all<ObservationLiteRow>();

        return jsonResponse({
          ok: true,
          observations: (result.results || []).map(mapObservationLiteRow),
          totalCount,
          availableClasses,
          photosDeferred: true,
        });
      }

      const result = await env.DB.prepare(
        'SELECT id, class_room, student_number, author_alias, group_name, location_category, location_detail, waste_scene, waste_cause, sensor_idea, photo_data_url, photo_caption, privacy_confirmed, created_at FROM observations ORDER BY created_at DESC LIMIT 1000'
      ).all<ObservationRow>();

      return jsonResponse({
        ok: true,
        observations: (result.results || []).map(mapObservationRow),
        totalCount,
        availableClasses,
        photosDeferred: false,
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

  if (
    method === 'GET' &&
    path.startsWith('/api/observations/') &&
    path.endsWith('/photo')
  ) {
    const authorized = await isTeacherAuthenticated(request, env);
    if (!authorized) {
      return jsonResponse(
        { ok: false, error: '교사 로그인 후에만 사진을 불러올 수 있습니다.' },
        401
      );
    }

    const rawId = path.slice(
      '/api/observations/'.length,
      path.length - '/photo'.length
    );
    const id = decodeURIComponent(rawId).trim();
    if (!id || id.length > 80) {
      return jsonResponse(
        { ok: false, error: '올바른 관찰 일지 ID가 아닙니다.' },
        400
      );
    }

    try {
      const row = await env.DB.prepare(
        'SELECT photo_data_url FROM observations WHERE id = ?'
      )
        .bind(id)
        .first<{ photo_data_url: string }>();

      if (!row) {
        return jsonResponse(
          { ok: false, error: '해당 관찰 일지를 찾지 못했습니다.' },
          404
        );
      }

      return jsonResponse({
        ok: true,
        id,
        photoDataUrl: row.photo_data_url || '',
      });
    } catch {
      return jsonResponse(
        { ok: false, error: '사진을 불러오는 중 오류가 발생했습니다.' },
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

  if (method === 'POST' && path === '/api/group-codes/bulk') {
    const authorized = await isTeacherAuthenticated(request, env);
    if (!authorized) {
      return jsonResponse(
        { ok: false, error: '교사 로그인 후에만 모둠 인증코드를 일괄 등록할 수 있습니다.' },
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

    const rawEntries = parsed.data.entries;
    if (!Array.isArray(rawEntries) || rawEntries.length === 0) {
      return jsonResponse(
        { ok: false, error: '등록할 모둠 인증코드 목록이 비어 있습니다.' },
        400
      );
    }
    if (rawEntries.length > 30) {
      return jsonResponse(
        { ok: false, error: '한 번에 최대 30개 모둠까지만 일괄 등록할 수 있습니다.' },
        400
      );
    }

    const validatedEntries: Array<{ groupName: string; code: string }> = [];
    for (const raw of rawEntries) {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        return jsonResponse(
          { ok: false, error: '일괄 등록 항목 형식이 올바르지 않습니다.' },
          400
        );
      }
      const item = raw as Record<string, unknown>;
      const groupName = readRequiredString(item, 'groupName', '모둠 이름', 30);
      if (!groupName.ok) {
        return jsonResponse({ ok: false, error: groupName.error }, 400);
      }
      const code = readRequiredString(item, 'code', '모둠 인증코드', 24);
      if (!code.ok) {
        return jsonResponse({ ok: false, error: code.error }, 400);
      }
      validatedEntries.push({
        groupName: groupName.value,
        code: code.value,
      });
    }

    const updatedAt = new Date().toISOString();
    try {
      const stmt = env.DB.prepare(
        'INSERT INTO group_auth_codes (class_room, group_name, auth_code, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(class_room, group_name) DO UPDATE SET auth_code = excluded.auth_code, updated_at = excluded.updated_at'
      );
      await env.DB.batch(
        validatedEntries.map((item) =>
          stmt.bind(classRoom.value, item.groupName, item.code, updatedAt)
        )
      );

      return jsonResponse({
        ok: true,
        entries: validatedEntries.map((item) => ({
          classRoom: classRoom.value,
          groupName: item.groupName,
          code: item.code,
          updatedAt,
        })),
      });
    } catch {
      return jsonResponse(
        { ok: false, error: '모둠 인증코드를 일괄 저장하지 못했습니다.' },
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

      const existingTopicRow = await env.DB.prepare(
        'SELECT id, class_room, group_name, group_members, selected_location, reference_photo_data_url, project_title, core_question, selection_reason, control_condition_when, control_condition_then, control_condition_draft, created_at FROM group_topics WHERE class_room = ? AND group_name = ? LIMIT 1'
      )
        .bind(classRoom.value, groupName.value)
        .first<GroupTopicRow>();

      await ensureFlowchartTable(env);
      const flowchartRow = await env.DB.prepare(
        'SELECT image_data_url FROM group_flowcharts WHERE class_room = ? AND group_name = ?'
      )
        .bind(classRoom.value, groupName.value)
        .first<{ image_data_url: string }>();

      return jsonResponse({
        verified: true,
        observations: (obsResult.results || []).map(mapObservationRow),
        existingTopic: existingTopicRow
          ? {
              ...mapGroupTopicRow(existingTopicRow),
              flowchartDataUrl: flowchartRow?.image_data_url || '',
              hasFlowchart: Boolean(flowchartRow?.image_data_url),
            }
          : null,
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
        'SELECT id, class_room, group_name, group_members, selected_location, reference_photo_data_url, project_title, core_question, selection_reason, control_condition_when, control_condition_then, control_condition_draft, created_at FROM group_topics ORDER BY created_at DESC LIMIT 500'
      ).all<GroupTopicRow>();

      await ensureFlowchartTable(env);
      const flowchartKeys = await env.DB.prepare(
        'SELECT class_room, group_name FROM group_flowcharts'
      ).all<{ class_room: string; group_name: string }>();
      const hasFlowchart = new Set(
        (flowchartKeys.results || []).map((r) => `${r.class_room}::${r.group_name}`)
      );

      return jsonResponse({
        ok: true,
        topics: (result.results || []).map((row) => ({
          ...mapGroupTopicRow(row),
          hasFlowchart: hasFlowchart.has(`${row.class_room}::${row.group_name}`),
        })),
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

    const flowchartDataUrl = validatePhotoDataUrl(d.flowchartDataUrl);
    if (!flowchartDataUrl.ok) {
      return jsonResponse(
        { ok: false, error: `순서도 사진: ${flowchartDataUrl.error}` },
        400
      );
    }

    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();

    try {
      if (flowchartDataUrl.value) {
        await ensureFlowchartTable(env);
        await env.DB.prepare(
          'INSERT INTO group_flowcharts (class_room, group_name, image_data_url, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(class_room, group_name) DO UPDATE SET image_data_url = excluded.image_data_url, updated_at = excluded.updated_at'
        )
          .bind(classRoom.value, groupName.value, flowchartDataUrl.value, createdAt)
          .run();
      }

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
      const target = await env.DB.prepare(
        'SELECT class_room, group_name FROM group_topics WHERE id = ?'
      )
        .bind(id)
        .first<{ class_room: string; group_name: string }>();
      await env.DB.prepare('DELETE FROM group_topics WHERE id = ?')
        .bind(id)
        .run();
      if (target) {
        await ensureFlowchartTable(env);
        await env.DB.prepare(
          'DELETE FROM group_flowcharts WHERE class_room = ? AND group_name = ?'
        )
          .bind(target.class_room, target.group_name)
          .run();
      }
      return jsonResponse({ ok: true, deletedId: id });
    } catch {
      return jsonResponse(
        { ok: false, error: '모둠 주제를 삭제하지 못했습니다.' },
        500
      );
    }
  }

  if (method === 'GET' && path === '/api/group-flowchart') {
    const authorized = await isTeacherAuthenticated(request, env);
    if (!authorized) {
      return jsonResponse(
        { ok: false, error: '교사 로그인 후에만 순서도 사진을 볼 수 있습니다.' },
        401
      );
    }
    try {
      await ensureFlowchartTable(env);
      const row = await env.DB.prepare(
        'SELECT image_data_url, updated_at FROM group_flowcharts WHERE class_room = ? AND group_name = ?'
      )
        .bind(
          (url.searchParams.get('classRoom') || '').trim(),
          (url.searchParams.get('groupName') || '').trim()
        )
        .first<{ image_data_url: string; updated_at: string }>();
      return jsonResponse({
        ok: true,
        dataUrl: row?.image_data_url || '',
        updatedAt: row?.updated_at || '',
      });
    } catch {
      return jsonResponse(
        { ok: false, error: '순서도 사진을 불러오지 못했습니다.' },
        500
      );
    }
  }

  if (path.startsWith('/api/birdseye/')) {
    return handleBirdseyeRequest(request, env, url, method, path);
  }

  return jsonResponse({ ok: false, error: '지원하지 않는 API 경로입니다.' }, 404);
}

/* ------------------------------------------------------------------ */
/* 7·8차시 가상 조감도 (프롬프트 제출 → 교사 업로드 → 학생 판단)            */
/* ------------------------------------------------------------------ */

const BIRDSEYE_SCHEMA = [
  "CREATE TABLE IF NOT EXISTS birdseye_projects (class_room TEXT NOT NULL, group_name TEXT NOT NULL, prompt_fields TEXT NOT NULL DEFAULT '', prompt_text TEXT NOT NULL DEFAULT '', prompt_submitted_at TEXT NOT NULL DEFAULT '', final_version INTEGER, review_json TEXT NOT NULL DEFAULT '', review_saved_at TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')), PRIMARY KEY (class_room, group_name))",
  "CREATE TABLE IF NOT EXISTS birdseye_images (id TEXT PRIMARY KEY, class_room TEXT NOT NULL, group_name TEXT NOT NULL, version INTEGER NOT NULL, image_data_url TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')), UNIQUE (class_room, group_name, version))",
];

let birdseyeSchemaReady = false;

async function ensureBirdseyeTables(env: Env): Promise<void> {
  if (birdseyeSchemaReady) return;
  await env.DB.batch(BIRDSEYE_SCHEMA.map((sql) => env.DB.prepare(sql)));
  birdseyeSchemaReady = true;
}

interface BirdseyeProjectRow {
  class_room: string;
  group_name: string;
  prompt_fields: string;
  prompt_text: string;
  prompt_submitted_at: string;
  final_version: number | null;
  review_json: string;
  review_saved_at: string;
}

interface BirdseyeVersionRow {
  class_room: string;
  group_name: string;
  version: number;
  created_at: string;
}

function parseJsonObject(text: string): Record<string, unknown> | null {
  if (!text) return null;
  try {
    const parsed: unknown = JSON.parse(text);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function effectiveFinalVersion(
  finalVersion: number | null | undefined,
  versions: number[]
): number | null {
  if (versions.length === 0) return null;
  if (typeof finalVersion === 'number' && versions.includes(finalVersion)) {
    return finalVersion;
  }
  return Math.max(...versions);
}

function readGroupTarget(
  data: Record<string, unknown>
):
  | { ok: true; classRoom: string; groupName: string }
  | { ok: false; error: string } {
  const classRoom = readRequiredString(data, 'classRoom', '학급(반)', 30);
  if (!classRoom.ok) return { ok: false, error: classRoom.error };
  const groupName = readRequiredString(data, 'groupName', '모둠 이름', 30);
  if (!groupName.ok) return { ok: false, error: groupName.error };
  return { ok: true, classRoom: classRoom.value, groupName: groupName.value };
}

/** 학생 요청: 반·모둠·인증코드를 서버에서 직접 확인 (다른 모둠 자료 차단) */
async function verifyStudentGroup(
  request: Request,
  env: Env
): Promise<
  | {
      ok: true;
      classRoom: string;
      groupName: string;
      data: Record<string, unknown>;
    }
  | { ok: false; response: Response }
> {
  const parsed = await readJsonBody(request);
  if (!parsed.ok) return parsed;

  const target = readGroupTarget(parsed.data);
  if (!target.ok) {
    return {
      ok: false,
      response: jsonResponse({ ok: false, error: target.error }, 400),
    };
  }
  const code = readRequiredString(parsed.data, 'code', '모둠 인증코드', 24);
  if (!code.ok) {
    return {
      ok: false,
      response: jsonResponse({ ok: false, error: code.error }, 400),
    };
  }

  const row = await env.DB.prepare(
    'SELECT auth_code FROM group_auth_codes WHERE class_room = ? AND group_name = ?'
  )
    .bind(target.classRoom, target.groupName)
    .first<{ auth_code: string }>();

  if (!row) {
    return {
      ok: false,
      response: jsonResponse(
        {
          ok: false,
          error: `아직 "${target.classRoom} ${target.groupName}"의 인증코드가 등록되지 않았습니다. 선생님께 확인해 주세요.`,
        },
        404
      ),
    };
  }
  if (row.auth_code.trim().toLowerCase() !== code.value.trim().toLowerCase()) {
    return {
      ok: false,
      response: jsonResponse(
        {
          ok: false,
          error:
            '모둠 인증코드가 일치하지 않습니다. 선생님께 받은 코드를 다시 확인해 주세요.',
        },
        401
      ),
    };
  }

  return {
    ok: true,
    classRoom: target.classRoom,
    groupName: target.groupName,
    data: parsed.data,
  };
}

async function loadGroupVersions(
  env: Env,
  classRoom: string,
  groupName: string
): Promise<{ version: number; createdAt: string }[]> {
  const result = await env.DB.prepare(
    'SELECT class_room, group_name, version, created_at FROM birdseye_images WHERE class_room = ? AND group_name = ? ORDER BY version ASC'
  )
    .bind(classRoom, groupName)
    .all<BirdseyeVersionRow>();
  return (result.results || []).map((row) => ({
    version: row.version,
    createdAt: row.created_at,
  }));
}

async function loadGroupProject(
  env: Env,
  classRoom: string,
  groupName: string
): Promise<BirdseyeProjectRow | null> {
  return env.DB.prepare(
    'SELECT class_room, group_name, prompt_fields, prompt_text, prompt_submitted_at, final_version, review_json, review_saved_at FROM birdseye_projects WHERE class_room = ? AND group_name = ?'
  )
    .bind(classRoom, groupName)
    .first<BirdseyeProjectRow>();
}

async function loadImageDataUrl(
  env: Env,
  classRoom: string,
  groupName: string,
  version: number
): Promise<{ dataUrl: string; createdAt: string } | null> {
  const row = await env.DB.prepare(
    'SELECT image_data_url, created_at FROM birdseye_images WHERE class_room = ? AND group_name = ? AND version = ?'
  )
    .bind(classRoom, groupName, version)
    .first<{ image_data_url: string; created_at: string }>();
  return row ? { dataUrl: row.image_data_url, createdAt: row.created_at } : null;
}

function validateStringRecord(
  raw: unknown,
  maxKeys: number,
  maxValueLength: number
): Record<string, string> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const entries = Object.entries(raw as Record<string, unknown>);
  if (entries.length > maxKeys) return null;
  const out: Record<string, string> = {};
  for (const [key, value] of entries) {
    if (key.length > 40 || typeof value !== 'string') return null;
    if (value.length > maxValueLength) return null;
    out[key] = value.trim();
  }
  return out;
}

function validateReview(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const checks = Array.isArray(r.checks)
    ? r.checks.filter(
        (n): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0 && n < 20
      )
    : [];
  const str = (v: unknown, max: number) =>
    typeof v === 'string' ? v.trim().slice(0, max) : '';
  return {
    checks: Array.from(new Set(checks)).slice(0, 20),
    extraFix: str(r.extraFix, 300),
    fixText: str(r.fixText, 1500),
    reflection: str(r.reflection, 500),
    basedOnVersion:
      typeof r.basedOnVersion === 'number' && Number.isInteger(r.basedOnVersion)
        ? r.basedOnVersion
        : null,
  };
}

async function handleBirdseyeRequest(
  request: Request,
  env: Env,
  url: URL,
  method: string,
  path: string
): Promise<Response> {
  try {
    await ensureBirdseyeTables(env);
  } catch {
    return jsonResponse(
      { ok: false, error: '가상 조감도 저장 공간을 준비하지 못했습니다.' },
      500
    );
  }

  try {
    /* ---------- 학생: 모둠 인증 후 자기 모둠 자료만 ---------- */
    if (method === 'POST' && path === '/api/birdseye/student/load') {
      const auth = await verifyStudentGroup(request, env);
      if (!auth.ok) return auth.response;
      const { classRoom, groupName } = auth;

      const topicRow = await env.DB.prepare(
        'SELECT id, class_room, group_name, group_members, selected_location, reference_photo_data_url, project_title, core_question, selection_reason, control_condition_when, control_condition_then, control_condition_draft, created_at FROM group_topics WHERE class_room = ? AND group_name = ? LIMIT 1'
      )
        .bind(classRoom, groupName)
        .first<GroupTopicRow>();
      const project = await loadGroupProject(env, classRoom, groupName);
      const versions = await loadGroupVersions(env, classRoom, groupName);
      const finalVersion = effectiveFinalVersion(
        project?.final_version,
        versions.map((v) => v.version)
      );
      const finalImage =
        finalVersion !== null
          ? await loadImageDataUrl(env, classRoom, groupName, finalVersion)
          : null;

      return jsonResponse({
        ok: true,
        classRoom,
        groupName,
        topic: topicRow ? mapGroupTopicRow(topicRow) : null,
        promptFields: parseJsonObject(project?.prompt_fields || ''),
        promptText: project?.prompt_text || '',
        promptSubmittedAt: project?.prompt_submitted_at || '',
        review: parseJsonObject(project?.review_json || ''),
        reviewSavedAt: project?.review_saved_at || '',
        versions,
        finalVersion,
        finalImageDataUrl: finalImage?.dataUrl || '',
      });
    }

    if (method === 'POST' && path === '/api/birdseye/student/status') {
      const auth = await verifyStudentGroup(request, env);
      if (!auth.ok) return auth.response;
      const project = await loadGroupProject(env, auth.classRoom, auth.groupName);
      const versions = await loadGroupVersions(env, auth.classRoom, auth.groupName);
      return jsonResponse({
        ok: true,
        versions,
        finalVersion: effectiveFinalVersion(
          project?.final_version,
          versions.map((v) => v.version)
        ),
      });
    }

    if (method === 'POST' && path === '/api/birdseye/student/image') {
      const auth = await verifyStudentGroup(request, env);
      if (!auth.ok) return auth.response;
      const version = auth.data.version;
      if (typeof version !== 'number' || !Number.isInteger(version)) {
        return jsonResponse({ ok: false, error: '버전 번호가 올바르지 않습니다.' }, 400);
      }
      const image = await loadImageDataUrl(env, auth.classRoom, auth.groupName, version);
      if (!image) {
        return jsonResponse({ ok: false, error: '해당 조감도를 찾을 수 없습니다.' }, 404);
      }
      return jsonResponse({ ok: true, version, ...image });
    }

    if (method === 'POST' && path === '/api/birdseye/student/prompt') {
      const auth = await verifyStudentGroup(request, env);
      if (!auth.ok) return auth.response;
      const fields = validateStringRecord(auth.data.promptFields, 20, 120);
      if (!fields) {
        return jsonResponse({ ok: false, error: '프롬프트 항목 형식이 올바르지 않습니다.' }, 400);
      }
      const promptText = readRequiredString(auth.data, 'promptText', '완성된 프롬프트', 2000);
      if (!promptText.ok) {
        return jsonResponse({ ok: false, error: promptText.error }, 400);
      }
      const now = new Date().toISOString();
      await env.DB.prepare(
        'INSERT INTO birdseye_projects (class_room, group_name, prompt_fields, prompt_text, prompt_submitted_at, updated_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(class_room, group_name) DO UPDATE SET prompt_fields = excluded.prompt_fields, prompt_text = excluded.prompt_text, prompt_submitted_at = excluded.prompt_submitted_at, updated_at = excluded.updated_at'
      )
        .bind(auth.classRoom, auth.groupName, JSON.stringify(fields), promptText.value, now, now)
        .run();
      return jsonResponse({ ok: true, promptSubmittedAt: now });
    }

    if (method === 'POST' && path === '/api/birdseye/student/review') {
      const auth = await verifyStudentGroup(request, env);
      if (!auth.ok) return auth.response;
      const review = validateReview(auth.data.review);
      if (!review) {
        return jsonResponse({ ok: false, error: '평가 내용 형식이 올바르지 않습니다.' }, 400);
      }
      const now = new Date().toISOString();
      await env.DB.prepare(
        'INSERT INTO birdseye_projects (class_room, group_name, review_json, review_saved_at, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(class_room, group_name) DO UPDATE SET review_json = excluded.review_json, review_saved_at = excluded.review_saved_at, updated_at = excluded.updated_at'
      )
        .bind(auth.classRoom, auth.groupName, JSON.stringify(review), now, now)
        .run();
      return jsonResponse({ ok: true, reviewSavedAt: now });
    }

    /* ---------- 교사: 로그인한 경우에만 ---------- */
    if (path.startsWith('/api/birdseye/teacher/')) {
      const authorized = await isTeacherAuthenticated(request, env);
      if (!authorized) {
        return jsonResponse(
          { ok: false, error: '교사 로그인 후에만 가상 조감도를 관리할 수 있습니다.' },
          401
        );
      }
    }

    if (method === 'GET' && path === '/api/birdseye/teacher/overview') {
      const [topicsRes, codesRes, projectsRes, versionsRes] = await env.DB.batch([
        env.DB.prepare(
          "SELECT class_room, group_name, project_title, selected_location, (reference_photo_data_url != '') AS has_reference FROM group_topics"
        ),
        env.DB.prepare('SELECT class_room, group_name FROM group_auth_codes'),
        env.DB.prepare(
          'SELECT class_room, group_name, prompt_fields, prompt_text, prompt_submitted_at, final_version, review_json, review_saved_at FROM birdseye_projects'
        ),
        env.DB.prepare(
          'SELECT class_room, group_name, version, created_at FROM birdseye_images ORDER BY version ASC'
        ),
      ]);

      type Group = {
        classRoom: string;
        groupName: string;
        projectTitle: string;
        selectedLocation: string;
        hasReferencePhoto: boolean;
        promptText: string;
        promptSubmittedAt: string;
        review: Record<string, unknown> | null;
        reviewSavedAt: string;
        versions: { version: number; createdAt: string }[];
        finalVersion: number | null;
        storedFinal: number | null;
      };
      const groups = new Map<string, Group>();
      const keyOf = (c: string, g: string) => `${c}::${g}`;
      const ensure = (c: string, g: string): Group => {
        const key = keyOf(c, g);
        let item = groups.get(key);
        if (!item) {
          item = {
            classRoom: c,
            groupName: g,
            projectTitle: '',
            selectedLocation: '',
            hasReferencePhoto: false,
            promptText: '',
            promptSubmittedAt: '',
            review: null,
            reviewSavedAt: '',
            versions: [],
            finalVersion: null,
            storedFinal: null,
          };
          groups.set(key, item);
        }
        return item;
      };

      for (const row of (codesRes.results || []) as { class_room: string; group_name: string }[]) {
        ensure(row.class_room, row.group_name);
      }
      for (const row of (topicsRes.results || []) as {
        class_room: string;
        group_name: string;
        project_title: string;
        selected_location: string;
        has_reference: number;
      }[]) {
        const g = ensure(row.class_room, row.group_name);
        g.projectTitle = row.project_title;
        g.selectedLocation = row.selected_location;
        g.hasReferencePhoto = Boolean(row.has_reference);
      }
      for (const row of (projectsRes.results || []) as BirdseyeProjectRow[]) {
        const g = ensure(row.class_room, row.group_name);
        g.promptText = row.prompt_text;
        g.promptSubmittedAt = row.prompt_submitted_at;
        g.review = parseJsonObject(row.review_json);
        g.reviewSavedAt = row.review_saved_at;
        g.storedFinal = row.final_version;
      }
      for (const row of (versionsRes.results || []) as BirdseyeVersionRow[]) {
        ensure(row.class_room, row.group_name).versions.push({
          version: row.version,
          createdAt: row.created_at,
        });
      }

      const list = Array.from(groups.values()).map(({ storedFinal, ...g }) => ({
        ...g,
        finalVersion: effectiveFinalVersion(
          storedFinal,
          g.versions.map((v) => v.version)
        ),
      }));
      return jsonResponse({ ok: true, groups: list });
    }

    if (method === 'GET' && path === '/api/birdseye/teacher/image') {
      const classRoom = (url.searchParams.get('classRoom') || '').trim();
      const groupName = (url.searchParams.get('groupName') || '').trim();
      const version = Number(url.searchParams.get('version'));
      if (!classRoom || !groupName || !Number.isInteger(version)) {
        return jsonResponse({ ok: false, error: '요청 정보가 올바르지 않습니다.' }, 400);
      }
      const image = await loadImageDataUrl(env, classRoom, groupName, version);
      if (!image) {
        return jsonResponse({ ok: false, error: '해당 조감도를 찾을 수 없습니다.' }, 404);
      }
      return jsonResponse({ ok: true, version, ...image });
    }

    if (method === 'GET' && path === '/api/birdseye/teacher/reference') {
      const classRoom = (url.searchParams.get('classRoom') || '').trim();
      const groupName = (url.searchParams.get('groupName') || '').trim();
      const row = await env.DB.prepare(
        'SELECT reference_photo_data_url FROM group_topics WHERE class_room = ? AND group_name = ?'
      )
        .bind(classRoom, groupName)
        .first<{ reference_photo_data_url: string }>();
      return jsonResponse({ ok: true, dataUrl: row?.reference_photo_data_url || '' });
    }

    if (method === 'POST' && path === '/api/birdseye/teacher/images') {
      const parsed = await readJsonBody(request);
      if (!parsed.ok) return parsed.response;
      const target = readGroupTarget(parsed.data);
      if (!target.ok) return jsonResponse({ ok: false, error: target.error }, 400);
      const image = validatePhotoDataUrl(parsed.data.imageDataUrl);
      if (!image.ok) return jsonResponse({ ok: false, error: image.error }, 400);
      if (!image.value) {
        return jsonResponse({ ok: false, error: '올릴 조감도 이미지를 선택해 주세요.' }, 400);
      }

      const maxRow = await env.DB.prepare(
        'SELECT COALESCE(MAX(version), 0) AS max_version FROM birdseye_images WHERE class_room = ? AND group_name = ?'
      )
        .bind(target.classRoom, target.groupName)
        .first<{ max_version: number }>();
      const version = (maxRow?.max_version || 0) + 1;
      const now = new Date().toISOString();

      await env.DB.batch([
        env.DB.prepare(
          'INSERT INTO birdseye_images (id, class_room, group_name, version, image_data_url, created_at) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind(crypto.randomUUID(), target.classRoom, target.groupName, version, image.value, now),
        env.DB.prepare(
          'INSERT INTO birdseye_projects (class_room, group_name, final_version, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(class_room, group_name) DO UPDATE SET final_version = excluded.final_version, updated_at = excluded.updated_at'
        ).bind(target.classRoom, target.groupName, version, now),
      ]);
      return jsonResponse({ ok: true, version, createdAt: now }, 201);
    }

    if (method === 'POST' && path === '/api/birdseye/teacher/final') {
      const parsed = await readJsonBody(request);
      if (!parsed.ok) return parsed.response;
      const target = readGroupTarget(parsed.data);
      if (!target.ok) return jsonResponse({ ok: false, error: target.error }, 400);
      const version = parsed.data.version;
      if (typeof version !== 'number' || !Number.isInteger(version)) {
        return jsonResponse({ ok: false, error: '버전 번호가 올바르지 않습니다.' }, 400);
      }
      const exists = await loadImageDataUrl(env, target.classRoom, target.groupName, version);
      if (!exists) {
        return jsonResponse({ ok: false, error: '해당 조감도를 찾을 수 없습니다.' }, 404);
      }
      const now = new Date().toISOString();
      await env.DB.prepare(
        'INSERT INTO birdseye_projects (class_room, group_name, final_version, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(class_room, group_name) DO UPDATE SET final_version = excluded.final_version, updated_at = excluded.updated_at'
      )
        .bind(target.classRoom, target.groupName, version, now)
        .run();
      return jsonResponse({ ok: true, finalVersion: version });
    }

    if (method === 'DELETE' && path === '/api/birdseye/teacher/images') {
      const parsed = await readJsonBody(request);
      if (!parsed.ok) return parsed.response;
      const target = readGroupTarget(parsed.data);
      if (!target.ok) return jsonResponse({ ok: false, error: target.error }, 400);
      const version = parsed.data.version;
      if (typeof version !== 'number' || !Number.isInteger(version)) {
        return jsonResponse({ ok: false, error: '버전 번호가 올바르지 않습니다.' }, 400);
      }
      await env.DB.batch([
        env.DB.prepare(
          'DELETE FROM birdseye_images WHERE class_room = ? AND group_name = ? AND version = ?'
        ).bind(target.classRoom, target.groupName, version),
        env.DB.prepare(
          'UPDATE birdseye_projects SET final_version = (SELECT MAX(version) FROM birdseye_images WHERE class_room = ? AND group_name = ?) WHERE class_room = ? AND group_name = ? AND final_version = ?'
        ).bind(target.classRoom, target.groupName, target.classRoom, target.groupName, version),
      ]);
      return jsonResponse({ ok: true, deletedVersion: version });
    }
  } catch {
    return jsonResponse(
      { ok: false, error: '가상 조감도 처리 중 데이터베이스 오류가 발생했습니다.' },
      500
    );
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
