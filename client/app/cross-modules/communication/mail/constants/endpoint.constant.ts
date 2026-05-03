import { API_BASE } from "@/constants/endpoint.constant";

const MAIL_SUBPATH = "Mail";
const TEMPLATE_SUBPATH = "Template";

// Mail endpoints
export const MAIL_ENDPOINTS = {
  GET_MAILBOX_MAILS: `${API_BASE}/${MAIL_SUBPATH}/GetMailBoxMails`,
  GET_MAILBOX_MAIL: `${API_BASE}/${MAIL_SUBPATH}/GetMailBoxMail`,
  SEND_TO_ANY: `${API_BASE}/${MAIL_SUBPATH}/SendToAny`,
} as const;

// Email Template endpoints
export const EMAIL_TEMPLATE_ENDPOINTS = {
  GET_TEMPLATES: `${API_BASE}/template/gets`,
  GET_TEMPLATE: `${API_BASE}/${TEMPLATE_SUBPATH}/Get`,
  SAVE_TEMPLATE: `${API_BASE}/${TEMPLATE_SUBPATH}/Save`,
  CLONE_TEMPLATE: `${API_BASE}/${TEMPLATE_SUBPATH}/Clone`,
  DELETE_TEMPLATE: `${API_BASE}/${TEMPLATE_SUBPATH}/Delete`,
} as const;

// Mail Configuration endpoints
export const MAIL_CONFIG_ENDPOINTS = {
  GET_CONFIGS: `${API_BASE}/${MAIL_SUBPATH}/Gets`,
  SAVE_CONFIG: `${API_BASE}/${MAIL_SUBPATH}/Save`,
  DELETE_CONFIG: `${API_BASE}/${MAIL_SUBPATH}/Delete`,
} as const;
