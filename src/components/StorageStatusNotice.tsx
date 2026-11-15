import React from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Info,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import type { StorageConnectionStatus } from '../types/observation';

interface StorageStatusNoticeProps {
  status: StorageConnectionStatus;
  onRetryCheck?: () => void;
  isChecking?: boolean;
  context: 'student' | 'teacher';
  statusDetail?: string;
}

export const StorageStatusNotice: React.FC<StorageStatusNoticeProps> = ({
  status,
  onRetryCheck,
  isChecking = false,
  context,
  statusDetail,
}) => {
  if (status === 'connected') {
    return (
      <div
        role="status"
        className="flex flex-col gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-950 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex min-w-0 items-start gap-2.5">
          <CheckCircle2
            className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700"
            aria-hidden="true"
          />
          <div className="min-w-0 leading-relaxed">
            <span className="font-semibold">Cloudflare D1 연결됨</span>
            <span className="mx-1.5 text-emerald-700" aria-hidden="true">
              ·
            </span>
            <span className="text-emerald-900">
              {context === 'student'
                ? '제출한 관찰 일지가 /api 경로를 통해 Cloudflare D1 데이터베이스에 안전하게 저장됩니다.'
                : '교사 인증 후 Cloudflare D1에 저장된 학생 응답을 조회하고 관리할 수 있습니다.'}
            </span>
          </div>
        </div>
        {onRetryCheck && (
          <button
            type="button"
            onClick={onRetryCheck}
            disabled={isChecking}
            className="inline-flex min-h-[40px] items-center justify-center gap-1.5 self-start rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-medium text-emerald-900 hover:bg-emerald-50 whitespace-nowrap shrink-0 sm:self-auto"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isChecking ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            연결 확인
          </button>
        )}
      </div>
    );
  }

  if (status === 'checking') {
    return (
      <div
        role="status"
        className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
      >
        <Loader2
          className="h-4 w-4 shrink-0 animate-spin text-slate-500"
          aria-hidden="true"
        />
        <span>데이터 저장소(/api/health) 연결 상태를 확인하고 있습니다.</span>
      </div>
    );
  }

  // Worker가 응답했지만 D1 바인딩/테이블에 실제 오류가 있는 경우
  if (statusDetail) {
    return (
      <div
        role="status"
        className="flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50/80 px-4 py-3.5 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex min-w-0 items-start gap-2.5">
          <AlertCircle
            className="mt-0.5 h-4 w-4 shrink-0 text-amber-700"
            aria-hidden="true"
          />
          <div className="min-w-0 space-y-0.5 leading-relaxed">
            <p className="font-semibold">Cloudflare D1 저장소 확인 필요</p>
            <p className="text-xs sm:text-sm text-amber-900">{statusDetail}</p>
          </div>
        </div>
        {onRetryCheck && (
          <button
            type="button"
            onClick={onRetryCheck}
            disabled={isChecking}
            className="inline-flex min-h-[44px] items-center justify-center gap-1.5 self-start rounded-lg border border-amber-300 bg-white px-3.5 py-2 text-xs font-semibold text-amber-950 hover:bg-amber-100/60 whitespace-nowrap shrink-0 sm:self-auto"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isChecking ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            연결 다시 확인
          </button>
        )}
      </div>
    );
  }

  // 제작 미리보기(Vite dev) 환경: Worker가 아직 실행되지 않는 상태
  return (
    <div
      role="status"
      className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-100/80 px-4 py-3 text-sm text-slate-800 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <Info
          className="mt-0.5 h-4 w-4 shrink-0 text-slate-600"
          aria-hidden="true"
        />
        <div className="min-w-0 space-y-0.5 leading-relaxed">
          <p className="font-semibold text-slate-900">
            미리보기 모드 · 서버 저장은 Cloudflare 배포 후 연결됩니다
          </p>
          <p className="text-xs sm:text-sm text-slate-600">
            {context === 'student'
              ? '현재는 제작 미리보기 화면으로, 입력한 내용은 이 브라우저에서만 임시 체험할 수 있고 서버에는 저장되지 않습니다. Cloudflare 배포 주소에서는 D1 데이터베이스에 자동 저장됩니다.'
              : 'wrangler.jsonc의 classroom-db ID 설정은 완료되었으나, 현재 미리보기(Vite) 화면에서는 Worker가 실행되지 않아 D1과 통신할 수 없습니다. 실제 저장·교사 로그인은 Cloudflare 배포(npx wrangler deploy) 후 동작합니다.'}
          </p>
        </div>
      </div>
      {onRetryCheck && (
        <button
          type="button"
          onClick={onRetryCheck}
          disabled={isChecking}
          className="inline-flex min-h-[40px] items-center justify-center gap-1.5 self-start rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0 sm:self-auto"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${isChecking ? 'animate-spin' : ''}`}
            aria-hidden="true"
          />
          연결 다시 확인
        </button>
      )}
    </div>
  );
};

