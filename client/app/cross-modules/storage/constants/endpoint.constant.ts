import { API_BASE } from "@/constants/endpoint.constant";

const STORAGE_SUBPATH = "/Storage";
const FILES_SUBPATH = "/Files";

// Storage Configuration endpoints
export const STORAGE_CONFIG_ENDPOINTS = {
  GET_CONFIGS: `${API_BASE}${STORAGE_SUBPATH}/Gets`,
  SAVE_CONFIG: `${API_BASE}${STORAGE_SUBPATH}/Save`,
  DELETE_CONFIG: `${API_BASE}${STORAGE_SUBPATH}/Delete`,
} as const;

// Storage File endpoints
export const STORAGE_FILE_ENDPOINTS = {
  GET_FILE: `${API_BASE}${FILES_SUBPATH}/GetFile`,
  DELETE_FILE: `${API_BASE}${FILES_SUBPATH}/DeleteFile`,
  DELETE_FOLDER: `${API_BASE}${FILES_SUBPATH}/DeleteFolder`,
  GET_PRESIGNED_URL: `${API_BASE}${FILES_SUBPATH}/GetPreSignedUrlForUpload`,
  GET_FILES_INFO: `${API_BASE}${FILES_SUBPATH}/GetFilesInfo`,
  UPDATE_FILE_ADDITIONAL_INFO: `${API_BASE}${FILES_SUBPATH}/updateFileAdditionalInfo`,
  UPLOAD_TO_LOCAL_STORAGE: `${API_BASE}${FILES_SUBPATH}/UploadFileToLocalStorage`,
  GET_DMS_FILE_AND_FOLDER: `${API_BASE}${FILES_SUBPATH}/GetDmsFileAndFolder`,
  UPLOAD_DMS_FILE: `${API_BASE}${FILES_SUBPATH}/UploadFile`,
  CREATE_FOLDER: `${API_BASE}${FILES_SUBPATH}/CreateFolder`,
  UPLOAD_PUBLIC_CERTIFICATE: `${API_BASE}/Certificate/UploadCertificate`,
} as const;
