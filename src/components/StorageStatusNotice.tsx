import React from 'react';
import { AlertCircle, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
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
        <div className="flex items-start gap-2.5">
          <CheckCircle2
            className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700"
            aria-hidden="true"
          />
          <div>
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

  return (
    <div
      role="status"
      className="flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50/80 px-4 py-3.5 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-2.5">
        <AlertCircle
          className="mt-0.5 h-4 w-4 shrink-0 text-amber-700"
          aria-hidden="true"
        />
        <div className="space-y-0.5 leading-relaxed">
          <p className="font-semibold">
            저장 준비 중 · Cloudflare D1 저장소 미연결
          </p>
          <p className="text-xs sm:text-sm text-amber-900">
            {statusDetail ||
              (context === 'student'
                ? '아직 서버 저장소가 연결되지 않아 입력한 내용은 서버에 저장되지 않습니다. 현재 브라우저 화면 미리보기에서만 흐름을 확인할 수 있습니다.'
                : '아직 /api 저장소가 연결되지 않아 서버의 학생 응답을 불러올 수 없습니다. 아래에는 현재 브라우저의 임시 미리보기 기록만 표시됩니다.')}
          </p>
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
};
