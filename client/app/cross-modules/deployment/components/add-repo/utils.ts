import { z } from "zod";
const URL_REGEX =
  /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)$/;
const monitorSettingsSchema = z.object({
  monitor_interval: z.number(),
  request_timeout: z.number(),
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

export const addAlertRepoSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Service name is required")
    .max(100, "Service name too long. Maximum 100 characters allowed."),
  urlMonitor: z
    .string()
    .min(1, "URL is required")
    .regex(URL_REGEX, "Please enter a valid URL (must start with http:// or https://)"),
  monitorSettings: monitorSettingsSchema,
  requestConfiguration: requestConfigurationSchema,
});

export type AddAlertRepoForm = z.infer<typeof addAlertRepoSchema>;

export const addAlertRepoDefaultValues: AddAlertRepoForm = {
  name: "",
  urlMonitor: "",
  monitorSettings: {
    monitor_interval: 2,
    request_timeout: 3,
    check_ssl_errors: false,
    ssl_expiry_reminders: false,
    domain_expiry_reminders: false,
  },
  requestConfiguration: {
    http_methods: "0", // Default to GET
    request_body: `{"key": "value"}`,
    json_switcher: false,
    x_header_name: "",
    value: "",
  },
};

export const addACallbackSchema = z.object({
  name: z
    .string()
    .min(1, "Service name is required")
    .max(100, "Service name too long")
    .refine((val) => val.trim().length > 0, "Service name cannot contain only whitespace"),
  monitor_interval: z.number(),
  grace_time: z.number(),
});
export type AddCallbackForm = z.infer<typeof addACallbackSchema>;
export const addCallbackFormDefaultValues: AddCallbackForm = {
  name: "",
  monitor_interval: 2,
  grace_time: 3,
};
