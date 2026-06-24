import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildStaffEmailDeliveryResponse,
  buildStaffManualCredentialsResponse,
  formatStaffActionUserError,
  parseEmailDeliveryModeEnv,
  parseSmtpPort,
  resolveEffectiveEmailDelivery,
  resolveSmtpTls,
  resolveStaffInviteDelivery,
  resolveStaffResetDelivery,
} from "@/lib/mail";

const SMTP_ENV = {
  EMAIL_SERVER_HOST: "smtp.gmail.com",
  EMAIL_SERVER_PORT: "587",
  EMAIL_SERVER_USER: "user@example.com",
  EMAIL_SERVER_PASSWORD: "secret",
} as const;

const savedEnv: Record<string, string | undefined> = {};

function withEnv(
  overrides: Record<string, string | undefined>,
  fn: () => void
): void {
  for (const key of new Set([
    ...Object.keys(process.env),
    ...Object.keys(overrides),
    "EMAIL_DELIVERY_MODE",
    ...Object.keys(SMTP_ENV),
  ])) {
    if (!(key in savedEnv)) savedEnv[key] = process.env[key];
  }
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    fn();
  } finally {
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    for (const key of Object.keys(savedEnv)) delete savedEnv[key];
  }
}

describe("EMAIL_DELIVERY_MODE", () => {
  it("accepts manual and smtp", () => {
    assert.equal(parseEmailDeliveryModeEnv("manual"), "manual");
    assert.equal(parseEmailDeliveryModeEnv(" SMTP "), "smtp");
    assert.equal(parseEmailDeliveryModeEnv(undefined), null);
  });

  it("forces manual even when SMTP vars exist", () => {
    withEnv({ ...SMTP_ENV, EMAIL_DELIVERY_MODE: "manual" }, () => {
      assert.equal(
        resolveEffectiveEmailDelivery({
          modeEnv: process.env.EMAIL_DELIVERY_MODE,
          smtpConfigured: true,
        }),
        "manual"
      );
      assert.equal(resolveStaffInviteDelivery("email"), "manual");
      assert.equal(resolveStaffResetDelivery(), "manual");
    });
  });

  it("uses smtp when mode is smtp and SMTP vars exist", () => {
    withEnv({ ...SMTP_ENV, EMAIL_DELIVERY_MODE: "smtp" }, () => {
      assert.equal(
        resolveEffectiveEmailDelivery({
          modeEnv: process.env.EMAIL_DELIVERY_MODE,
          smtpConfigured: true,
        }),
        "smtp"
      );
      assert.equal(resolveStaffResetDelivery(), "email");
    });
  });

  it("preserves legacy behavior when mode is unset", () => {
    withEnv(
      {
        EMAIL_DELIVERY_MODE: undefined,
        EMAIL_SERVER_HOST: undefined,
        EMAIL_SERVER_USER: undefined,
        EMAIL_SERVER_PASSWORD: undefined,
      },
      () => {
        assert.equal(
          resolveEffectiveEmailDelivery({
            modeEnv: process.env.EMAIL_DELIVERY_MODE,
            smtpConfigured: false,
          }),
          "manual"
        );
      }
    );

    withEnv({ ...SMTP_ENV, EMAIL_DELIVERY_MODE: undefined }, () => {
      assert.equal(
        resolveEffectiveEmailDelivery({
          modeEnv: process.env.EMAIL_DELIVERY_MODE,
          smtpConfigured: true,
        }),
        "smtp"
      );
    });
  });
});

describe("SMTP port and TLS", () => {
  it("parses ports and TLS modes", () => {
    assert.equal(parseSmtpPort("587"), 587);
    assert.deepEqual(resolveSmtpTls(587), { secure: false, requireTls: true });
    assert.deepEqual(resolveSmtpTls(465), { secure: true, requireTls: false });
  });
});

describe("staff credential API responses", () => {
  it("manual response includes temporaryPassword", () => {
    const body = buildStaffManualCredentialsResponse("a@b.com", "temp-1");
    assert.deepEqual(body, {
      delivery: "manual",
      email: "a@b.com",
      temporaryPassword: "temp-1",
    });
  });

  it("email response excludes temporaryPassword", () => {
    const body = buildStaffEmailDeliveryResponse();
    assert.deepEqual(body, { delivery: "email" });
    assert.equal("temporaryPassword" in body, false);
  });
});

describe("formatStaffActionUserError", () => {
  it("sanitizes mail errors", () => {
    const err = Object.assign(new Error("Connection timeout"), { code: "ETIMEDOUT" });
    assert.equal(
      formatStaffActionUserError(err, "reset_password"),
      "Email delivery failed. Please check email configuration."
    );
  });
});
