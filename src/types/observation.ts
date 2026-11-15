export type StorageConnectionStatus = 'checking' | 'not-connected' | 'connected';

export type SyncState = 'saved-to-api' | 'preview-only';

export interface ObservationInput {
  classRoom: string;
  classInfo: string;
  authorName: string;
  groupName: string;
  locationCategory: string;
  locationDetail: string;
  wasteScene: string;
  wasteCause: string;
  sensorIdea: string;
  photoDataUrl: string;
  photoCaption: string;
  privacyConfirmed: boolean;
}

export interface ObservationRecord extends ObservationInput {
  id: string;
  createdAt: string;
  syncState: SyncState;
  hasPhoto?: boolean;
}

export interface GroupTopicInput {
  classRoom: string;
  groupName: string;
  groupMembers: string;
  selectedLocation: string;
  referencePhotoDataUrl: string;
  projectTitle: string;
  coreQuestion: string;
  selectionReason: string;
  controlConditionWhen: string;
  controlConditionThen: string;
  controlConditionDraft: string;
}

export interface GroupTopicRecord extends GroupTopicInput {
  id: string;
  createdAt: string;
  syncState: SyncState;
}

export interface GroupAuthCode {
  classRoom: string;
  groupName: string;
  code: string;
  updatedAt: string;
  syncState: SyncState;
}

export const CLASS_ROOM_PRESETS = [
  '1학년 1반',
  '1학년 2반',
  '1학년 3반',
  '1학년 4반',
  '1학년 5반',
  '1학년 6반',
  '1학년 7반',
  '1학년 8반',
  '1학년 9반',
  '1학년 10반',
  '1학년 11반',
  '1학년 12반',
  '직접 입력',
] as const;

export const SCHOOL_LOCATION_PRESETS = [
  '복도',
  '빈 교실',
  '화장실',
  '특별실',
  '직접 입력',
] as const;

export const GROUP_NAME_PRESETS = [
  '1모둠',
  '2모둠',
  '3모둠',
  '4모둠',
  '5모둠',
  '6모둠',
  '7모둠',
  '8모둠',
  '9모둠',
  '직접 입력',
] as const;

export const SENSOR_HINT_ITEMS = [
  '조도 센서(밝기)',
  '인체감지 센서(움직임)',
  'LED(불빛)',
  '서보모터(움직임)',
] as const;
