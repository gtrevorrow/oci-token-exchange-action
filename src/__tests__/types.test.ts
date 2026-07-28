/**
 * Copyright (c) 2021, 2025 Oracle and/or its affiliates.
 * Licensed under the Universal Permissive License v1.0 as shown at https://oss.oracle.com/licenses/upl.
 */

import { jest, expect, describe, test, beforeEach, afterEach } from "@jest/globals";
import { resolveInput } from "../platforms/types";

describe("resolveInput", () => {
  const restoredValues: Record<string, string | undefined> = {};

  beforeEach(() => {
    // Clear all environment variables before each test
    Object.keys(process.env).forEach((key) => {
      if (
        key.startsWith("INPUT_") ||
        key.startsWith("OCI_") ||
        key.startsWith("OIDC_") ||
        ["SOME_VAR", "OCI_HOME", "TEST_VAR", "MY_TEST_VAR"].includes(key)
      ) {
        restoredValues[key] = process.env[key];
        delete process.env[key];
      }
    });
  });

  afterEach(() => {
    Object.entries(restoredValues).forEach(([key, value]) => {
      if (typeof value === "string") {
        process.env[key] = value;
      } else {
        delete process.env[key];
      }
    });
    Object.keys(restoredValues).forEach((key) => delete restoredValues[key]);
  });

  test("should resolve environment variables with proper priority order", () => {
    // Test the complete priority chain in ONE test
    process.env.TEST_VAR = "direct";
    process.env.INPUT_TEST_VAR = "input";
    process.env.OCI_TEST_VAR = "oci";
    process.env.OIDC_TEST_VAR = "oidc";

    // Direct should win
    expect(resolveInput("test_var")).toBe("direct");

    // Remove direct, INPUT_ should win
    delete process.env.TEST_VAR;
    expect(resolveInput("test_var")).toBe("input");

    // Remove INPUT_, OCI_ should win
    delete process.env.INPUT_TEST_VAR;
    expect(resolveInput("test_var")).toBe("oci");

    // Remove OCI_, OIDC_ should win
    delete process.env.OCI_TEST_VAR;
    expect(resolveInput("test_var")).toBe("oidc");

    // Remove all, should return empty
    delete process.env.OIDC_TEST_VAR;
    expect(resolveInput("test_var")).toBe("");
  });

  test("should handle OCI_HOME resolution with proper priority", () => {
    process.env.OCI_HOME = "/direct/oci";
    process.env.INPUT_OCI_HOME = "/input/oci";

    // Direct should win
    expect(resolveInput("oci_home")).toBe("/direct/oci");

    // Remove direct, INPUT_ should win
    delete process.env.OCI_HOME;
    expect(resolveInput("oci_home")).toBe("/input/oci");
  });

  test("should handle case normalization correctly", () => {
    process.env.TEST_VAR = "test_value";
    expect(resolveInput("test_var")).toBe("test_value");

    process.env.MY_TEST_VAR = "mixed_value";
    expect(resolveInput("my_test_var")).toBe("mixed_value");
  });

  test("should handle edge cases correctly", () => {
    // Empty string
    process.env.TEST_VAR = "";
    expect(resolveInput("test_var")).toBe("");

    // Whitespace
    process.env.TEST_VAR = "  whitespace  ";
    expect(resolveInput("test_var")).toBe("  whitespace  ");

    // Special characters
    process.env.TEST_VAR = "value@with#special$chars%";
    expect(resolveInput("test_var")).toBe("value@with#special$chars%");

    // Non-existent variable
    delete process.env.TEST_VAR;
    expect(resolveInput("nonexistent_var")).toBe("");
  });
});
