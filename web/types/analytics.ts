export type EmailAnalytics = {
  total_sent: number;
  total_failed: number;
  total_skipped: number;
  total_campaigns: number;
  total_contacts: number;
  total_unsubscribes: number;
  last_send_date: string | null;
  campaigns_this_week: number;
  average_send_size: number;
};

export type CampaignAnalyticsRow = {
  id: number;
  campaign_name: string;
  file_used: string | null;
  total_sent: number;
  total_failed: number;
  total_skipped: number;
  date_sent: string | null;
  delivery_rate: number;
};

export type SendGridStats = {
  opens: number;
  clicks: number;
  bounces: number;
  spam_reports: number;
  unsubscribes: number;
  delivered: number;
  requests: number;
  error: string | null;
};

export type SendGridSeriesPoint = {
  period: string;
  delivered: number;
  opens: number;
  clicks: number;
  bounces: number;
};

export type SendGridSeriesResponse = {
  granularity: string;
  points: SendGridSeriesPoint[];
  error: string | null;
};

export type SuppressionEntry = {
  email: string;
  reason: string;
  date: string;
  marked_follow_up: boolean;
};

export type SuppressionListResponse = {
  items: SuppressionEntry[];
  error: string | null;
};
