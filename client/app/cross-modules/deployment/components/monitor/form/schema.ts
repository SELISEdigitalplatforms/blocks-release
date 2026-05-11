import { z } from "zod";

export type MonitorFormMode = "add" | "edit";
export type MonitorConfigurationType = "request" | "callback";
export type SourceType = "deployed" | "my-services" | "none";

const URL_REGEX =
  /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)$/;

const monitorSettingsSchema = z.object({
  monitor_interval: z.number(),
  request_timeout: z.number(),
  grace_time: z.number(),
  check_ssl_errors: z.boolean().optional().default(false),
  ssl_expiry_reminders: z.boolean().optional().default(false),
  domain_expiry_reminders: z.boolean().optional().default(false),
});

const requestConfigurationSchema = z
  .object({
    http_methods: z.string().trim(),
    request_body: z.string().trim().default(""),
    json_switcher: z.boolean().optional().default(false),
    x_header_name: z.string().trim().default(""),
    value: z.string().trim().default(""),
  })
  .superRefine((data, ctx) => {
    if (data.http_methods === "2" && data.request_body.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Request body is required for POST requests",
        path: ["request_body"],
      });
    }

    if (data.json_switcher && data.x_header_name.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Header name is required when sending JSON",
        path: ["x_header_name"],
      });
    }

    if (data.json_switcher && data.value.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Header value is required when sending JSON",
        path: ["value"],
      });
    }
  });

export const monitorFormSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Service name is required")
      .max(100, "Service name too long. Maximum 100 characters allowed."),
    monitorConfigurationType: z.enum(["request", "callback"]),
    sourceType: z.enum(["none", "deployed", "my-services"]),
    selectedRepoId: z.string().default(""),
    selectedServiceId: z.string().default(""),
    urlMonitor: z.string().trim().default(""),
    monitorSettings: monitorSettingsSchema,
    requestConfiguration: requestConfigurationSchema,
  })
  .superRefine((data, ctx) => {
    if (data.sourceType === "deployed" && !data.selectedRepoId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select a deployed repo.",
        path: ["selectedRepoId"],
      });
    }

    if (data.sourceType === "my-services" && !data.selectedServiceId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select a service.",
        path: ["selectedServiceId"],
      });
    }

    if (data.monitorConfigurationType === "request") {
      if (!data.urlMonitor) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "URL is required",
          path: ["urlMonitor"],
        });
      } else if (!URL_REGEX.test(data.urlMonitor)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "Please enter a valid URL (must start with http:// or https://)",
          path: ["urlMonitor"],
        });
      }
    }

    if (
      data.monitorConfigurationType === "callback" &&
      !data.monitorSettings.grace_time
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Grace time is required",
        path: ["monitorSettings", "grace_time"],
      });
    }
  });

export type MonitorFormValues = z.infer<typeof monitorFormSchema>;

export const getMonitorFormDefaultValues = (
  monitorConfigurationType: MonitorConfigurationType = "request",
): MonitorFormValues => ({
  name: "",
  monitorConfigurationType,
  sourceType: "none",
  selectedRepoId: "",
  selectedServiceId: "",
  urlMonitor: "",
  monitorSettings: {
    monitor_interval: 2,
    request_timeout: 3,
    grace_time: 3,
    check_ssl_errors: false,
    ssl_expiry_reminders: false,
    domain_expiry_reminders: false,
  },
  requestConfiguration: {
    http_methods: "0",
    request_body: '{"key":"value"}',
    json_switcher: false,
    x_header_name: "",
    value: "",
  },
});
