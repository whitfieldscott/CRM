export type Contact = {
  id: number;
  name: string | null;
  email: string;
  phone: string | null;
  company: string | null;
  license_number: string | null;
  license_type: string | null;
  city: string | null;
  state: string | null;
  tags: string | null;
  notes: string | null;
  last_contacted: string | null;
  created_at: string | null;
  is_active: boolean;
};

export type Client = {
  id: number;
  name: string;
  license_number: string | null;
  license_type: string | null;
  primary_contact_name: string | null;
  primary_contact_email: string | null;
  primary_contact_phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  notes: string | null;
  created_at: string | null;
  is_active: boolean;
};

export type CampaignLog = {
  id: number;
  campaign_name: string;
  file_used: string | null;
  total_sent: number;
  total_failed: number;
  total_skipped: number;
  date_sent: string | null;
};

export type EmailSendRecord = {
  id: number;
  client_id: number | null;
  contact_id: number | null;
  campaign_log_id: number | null;
  recipient_email: string;
  subject: string | null;
  success: boolean;
  sent_at: string | null;
};

export type ClientNote = {
  id: number;
  client_id: number;
  note: string;
  created_at: string | null;
};

export type Settings = {
  from_email: string;
  sendgrid_configured: boolean;
  test_mode: boolean;
};

export type CSVImportSummary = {
  added: number;
  updated: number;
  skipped_invalid: number;
  total_rows_processed: number;
};

export type PreviewCsvResponse = {
  total_rows: number;
  columns: string[];
  preview: Record<string, unknown>[];
};

export type ConfirmSendResponse = {
  file_name: string;
  total_valid_emails: number;
  sample_emails: string[];
  ready_to_send: boolean;
};

export type CampaignTemplateResponse = {
  html: string;
};

export type CampaignTemplateSaveResponse = {
  success: boolean;
};

export type CampaignSendAPIResponse = {
  sent: number;
  failed: number;
  skipped: number;
  campaign_log_id: number;
};

export type SendBulkResponse = {
  message: string;
  total_in_file: number;
  campaign_log_id: number;
  result: Record<string, unknown>;
};

export type SmsContactsResponse = {
  file_name: string;
  total_rows_in_file: number;
  total_valid_phones: number;
  rows_without_valid_phone: number;
  sample_phones: string[];
  daily_limit: number;
  warmup_day: number;
  warmup_complete: boolean;
  test_mode: boolean;
  twilio_configured: boolean;
  /** True when ``TEST_SMS_TO`` is set in .env (optional fallback for test sends). */
  test_sms_to_configured: boolean;
};

export type SmsSendResponse = {
  message: string;
  total_in_file: number;
  sms_campaign_log_id: number;
  result: Record<string, unknown>;
};

export type SmsCampaignLog = {
  id: number;
  campaign_name: string;
  file_used: string | null;
  total_sent: number;
  total_failed: number;
  total_skipped: number;
  date_sent: string | null;
};
