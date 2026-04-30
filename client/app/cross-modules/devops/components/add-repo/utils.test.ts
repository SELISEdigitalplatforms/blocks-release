import { describe, expect, it } from "vitest";
import { addAlertRepoSchema, addACallbackSchema } from "./utils";

describe("AddRepoUtils", () => {
  describe("addAlertRepoSchema", () => {
    it("should validate a correct payload", () => {
      const validPayload = {
        name: "Test Service",
        urlMonitor: "https://example.com",
        monitorSettings: {
          monitor_interval: 2,
          request_timeout: 3,
          check_ssl_errors: true,
          ssl_expiry_reminders: false,
          domain_expiry_reminders: false,
        },
        requestConfiguration: {
          http_methods: "0",
          request_body: "{}",
          json_switcher: true,
          x_header_name: "X-Header",
          value: "value",
        },
      };
      const result = addAlertRepoSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });

    it("should fail if name is empty", () => {
      const invalidPayload = {
        name: "",
        urlMonitor: "https://example.com",
        monitorSettings: { monitor_interval: 2, request_timeout: 3 },
        requestConfiguration: { http_methods: "0", x_header_name: "h", value: "v" },
      };
      const result = addAlertRepoSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toBe("Service name is required");
      }
    });

    it("should fail if URL is invalid", () => {
      const invalidPayload = {
        name: "Test",
        urlMonitor: "invalid-url",
        monitorSettings: { monitor_interval: 2, request_timeout: 3 },
        requestConfiguration: { http_methods: "0", x_header_name: "h", value: "v" },
      };
      const result = addAlertRepoSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toContain("Please enter a valid URL");
      }
    });
  });

  describe("addACallbackSchema", () => {
    it("should validate a correct callback payload", () => {
      const validPayload = {
        name: "Callback Service",
        monitor_interval: 5,
        grace_time: 10,
      };
      const result = addACallbackSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });

    it("should fail if name is missing in callback", () => {
      const invalidPayload = {
        monitor_interval: 5,
        grace_time: 10,
      };
      const result = addACallbackSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });

    it("should fail if callback name is only whitespace", () => {
      const invalidPayload = {
        name: "   ",
        monitor_interval: 5,
        grace_time: 10,
      };
      const result = addACallbackSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });
  });

  describe("requestConfigurationSchema", () => {
    it("should fail if POST request body is only whitespace", () => {
      const invalidPayload = {
        name: "Test Service",
        urlMonitor: "https://example.com",
        monitorSettings: { monitor_interval: 2, request_timeout: 3 },
        requestConfiguration: {
          http_methods: "2",
          request_body: "   ",
          json_switcher: false,
          x_header_name: "",
          value: "",
        },
      };
      const result = addAlertRepoSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors.some((error) => error.path.includes("request_body"))).toBe(true);
      }
    });

    it("should fail if JSON headers are enabled with whitespace-only header name or value", () => {
      const invalidPayload = {
        name: "Test Service",
        urlMonitor: "https://example.com",
        monitorSettings: { monitor_interval: 2, request_timeout: 3 },
        requestConfiguration: {
          http_methods: "0",
          request_body: "",
          json_switcher: true,
          x_header_name: "   ",
          value: "   ",
        },
      };
      const result = addAlertRepoSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors.some((error) => error.path.includes("x_header_name"))).toBe(
          true,
        );
        expect(result.error.errors.some((error) => error.path.includes("value"))).toBe(true);
      }
    });
  });
});
