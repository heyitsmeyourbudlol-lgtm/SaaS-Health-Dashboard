export const INTEGRATION_PROVIDERS = [
  "stripe",
  "uptime",
  "hubspot",
  "aws",
  "datadog",
  "sentry",
] as const;

export type IntegrationProvider = (typeof INTEGRATION_PROVIDERS)[number];

export interface SyncResult {
  ok: boolean;
  provider: IntegrationProvider;
  error?: string;
  details?: Record<string, unknown>;
}

export interface IntegrationMeta {
  id: IntegrationProvider;
  label: string;
  category: "financial" | "technical" | "commercial";
  description: string;
  credentialFields: { name: string; label: string; type: "text" | "password" }[];
  configFields?: { name: string; label: string; placeholder?: string }[];
}

export const INTEGRATION_CATALOG: IntegrationMeta[] = [
  {
    id: "stripe",
    label: "Stripe",
    category: "financial",
    description: "MRR, churn, and active subscribers from billing data.",
    credentialFields: [
      { name: "apiKey", label: "Restricted read-only API key", type: "password" },
    ],
  },
  {
    id: "uptime",
    label: "Uptime (HTTP)",
    category: "technical",
    description: "Ping monitored URLs and compute uptime %.",
    credentialFields: [],
    configFields: [
      {
        name: "targets",
        label: "Targets (one per line)",
        placeholder: "https://client.com\nhttps://client.com/api/health",
      },
    ],
  },
  {
    id: "hubspot",
    label: "HubSpot",
    category: "commercial",
    description: "Open pipeline value and deal count from CRM.",
    credentialFields: [
      { name: "accessToken", label: "Private app access token", type: "password" },
    ],
    configFields: [
      {
        name: "dealStageFilter",
        label: "Open deal stages (comma-separated, optional)",
        placeholder: "appointmentscheduled,qualifiedtobuy",
      },
    ],
  },
  {
    id: "aws",
    label: "AWS CloudWatch",
    category: "technical",
    description: "Alarm health from CloudWatch (OK vs ALARM).",
    credentialFields: [
      { name: "accessKeyId", label: "Access key ID", type: "text" },
      { name: "secretAccessKey", label: "Secret access key", type: "password" },
    ],
    configFields: [
      { name: "region", label: "Region", placeholder: "us-east-1" },
      {
        name: "alarmNames",
        label: "Alarm names (comma-separated)",
        placeholder: "prod-alb-5xx,prod-rds-cpu",
      },
    ],
  },
  {
    id: "datadog",
    label: "Datadog Synthetics",
    category: "technical",
    description: "Synthetic test pass rate as uptime signal.",
    credentialFields: [
      { name: "apiKey", label: "API key", type: "password" },
      { name: "appKey", label: "Application key", type: "password" },
    ],
    configFields: [
      {
        name: "testIds",
        label: "Synthetic test public IDs (comma-separated)",
        placeholder: "abc-def-ghi",
      },
      { name: "site", label: "Datadog site", placeholder: "datadoghq.com" },
    ],
  },
  {
    id: "sentry",
    label: "Sentry",
    category: "technical",
    description: "Unresolved error count from production issues.",
    credentialFields: [
      { name: "authToken", label: "Auth token", type: "password" },
    ],
    configFields: [
      { name: "orgSlug", label: "Organization slug", placeholder: "my-org" },
      {
        name: "projectSlug",
        label: "Project slug (optional)",
        placeholder: "my-app",
      },
    ],
  },
];
