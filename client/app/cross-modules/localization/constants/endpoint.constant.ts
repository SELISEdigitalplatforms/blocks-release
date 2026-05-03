import { API_BASE } from "@/constants/endpoint.constant";

const KEY_SUBPATH = "/Key";
const MODULE_SUBPATH = "/Module";
const LANGUAGE_SUBPATH = "/Language";
const ASSISTANT_SUBPATH = "/Assistant";

// Language Key endpoints
export const LANGUAGE_KEY_ENDPOINTS = {
  GETS: `${API_BASE}${KEY_SUBPATH}/Gets`,
  GET: `${API_BASE}${KEY_SUBPATH}/Get`,
  SAVE: `${API_BASE}${KEY_SUBPATH}/Save`,
  DELETE: `${API_BASE}${KEY_SUBPATH}/Delete`,
  GENERATE_UILM_FILE: `${API_BASE}${KEY_SUBPATH}/GenerateUilmFile`,
  TRANSLATE_ALL: `${API_BASE}${KEY_SUBPATH}/TranslateAll`,
  TRANSLATE_KEY: `${API_BASE}${KEY_SUBPATH}/TranslateKey`,
  UILM_IMPORT: `${API_BASE}${KEY_SUBPATH}/UilmImport`,
  UILM_EXPORT: `${API_BASE}${KEY_SUBPATH}/UilmExport`,
  GET_TIMELINE: `${API_BASE}${KEY_SUBPATH}/GetTimeline`,
  GET_EXPORT_HISTORY: `${API_BASE}${KEY_SUBPATH}/GetUilmExportedFiles`,
  ROLLBACK: `${API_BASE}${KEY_SUBPATH}/RollBack`,
  GET_LOCALIZATION_TIMELINE: `${API_BASE}${KEY_SUBPATH}/GetLocalizationTimeline`,
  GET_TIMELINE_BY_OPERATION_ID: `${API_BASE}${KEY_SUBPATH}/GetTimelineByOperationId`,
} as const;

// Language Module endpoints
export const LANGUAGE_MODULE_ENDPOINTS = {
  GETS: `${API_BASE}${MODULE_SUBPATH}/Gets`,
  SAVE: `${API_BASE}${MODULE_SUBPATH}/Save`,
} as const;

// Language endpoints
export const LANGUAGE_ENDPOINTS = {
  GETS: `${API_BASE}${LANGUAGE_SUBPATH}/Gets`,
  SAVE: `${API_BASE}${LANGUAGE_SUBPATH}/Save`,
  DELETE: `${API_BASE}${LANGUAGE_SUBPATH}/Delete`,
  SET_DEFAULT: `${API_BASE}${LANGUAGE_SUBPATH}/SetDefault`,
} as const;

// Language Assistant endpoints
export const LANGUAGE_ASSISTANT_ENDPOINTS = {
  GET_TRANSLATION_SUGGESTION: `${API_BASE}${ASSISTANT_SUBPATH}/GetTranslationSuggestion`,
} as const;
