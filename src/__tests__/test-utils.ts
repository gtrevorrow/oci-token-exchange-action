/**
 * Copyright (c) 2021, 2025 Oracle and/or its affiliates.
 * Licensed under the Universal Permissive License v1.0 as shown at https://oss.oracle.com/licenses/upl.
 */

import { jest } from "@jest/globals";
import { OIDCTokenOptions, Platform, PlatformLogger } from "../platforms/types";

export class MockPlatform implements Platform {
  public readonly logger: PlatformLogger;

  constructor() {
    this.logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warning: jest.fn(),
      error: jest.fn(),
    };
  }

  getInput = jest.fn<(name: string, required?: boolean) => string>();
  setOutput = jest.fn();
  setFailed = jest.fn();
  isDebug = jest.fn<() => boolean>().mockReturnValue(false);
  configure = jest.fn();
  getOIDCToken = jest
    .fn<(options?: OIDCTokenOptions) => Promise<string>>()
    .mockResolvedValue("mock-token");
}
