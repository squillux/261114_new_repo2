export type StorageConnectionStatus = 'checking' | 'not-connected' | 'connected';

export type SyncState = 'saved-to-api' | 'preview-only';

export interface ObservationInput {
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
}

export interface GroupTopicInput {
  classInfo: string;
  groupName: string;
  groupMembers: string;
  selectedLocation: string;
  referencePhotoDataUrl: string;
  projectTitle: string;
  coreQuestion: string;
  selectionReason: string;
  controlConditionDraft: string;
}

export interface GroupTopicRecord extends GroupTopicInput {
  id: string;
  createdAt: string;
  syncState: SyncState;
}

export interface GroupAuthCode {
  groupName: string;
  code: string;
  updatedAt: string;
  syncState: SyncState;
}

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
  '직접 입력',
] as const;
