import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { createServer, Server } from "http";
import { AddressInfo } from "net";
import { tokenExchange } from "../main";
import { MockPlatform } from "./test-utils";

// These regressions must exercise Axios' real Node adapter, not the setup mock.
jest.unmock("axios");

const proxyVariables = [
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "ALL_PROXY",
  "NO_PROXY",
  "http_proxy",
  "https_proxy",
  "all_proxy",
  "no_proxy",
];

describe("token exchange proxy exclusions", () => {
  let endpoint: Server;
  let proxy: Server;
  let endpointPort: number;
  let proxyPort: number;
  let endpointRequests: number;
  let proxyRequests: number;
  let savedEnvironment: Record<string, string | undefined>;

  async function listen(server: Server): Promise<number> {
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    return (server.address() as AddressInfo).port;
  }

  beforeEach(async () => {
    savedEnvironment = {};
    for (const name of proxyVariables) {
      savedEnvironment[name] = process.env[name];
      delete process.env[name];
    }
    endpointRequests = 0;
    proxyRequests = 0;
    endpoint = createServer((request, response) => {
      endpointRequests++;
      request.resume();
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify({ token: "direct-test-token" }));
    });
    proxy = createServer((request, response) => {
      proxyRequests++;
      request.resume();
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify({ token: "proxy-test-token" }));
    });
    endpointPort = await listen(endpoint);
    proxyPort = await listen(proxy);
    process.env.HTTP_PROXY = `http://127.0.0.1:${proxyPort}`;
  });

  afterEach(async () => {
    for (const name of proxyVariables) {
      if (savedEnvironment[name] === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = savedEnvironment[name];
      }
    }
    await Promise.all(
      [endpoint, proxy].map(
        server =>
          new Promise<void>((resolve, reject) => {
            server.closeAllConnections();
            server.close(error => (error ? reject(error) : resolve()));
          }),
      ),
    );
  });

  function exchange(host: string) {
    return tokenExchange(new MockPlatform(), {
      tokenExchangeURL: `http://${host}:${endpointPort}/oauth2/v1/token`,
      clientCred: "synthetic-client-credential",
      ociPublicKey: "synthetic-public-key",
      subjectToken: "synthetic-oidc-token",
      retryCount: 0,
    });
  }

  it("keeps IPv4-mapped IPv6 destinations out of the proxy (#149)", async () => {
    process.env.NO_PROXY = "127.0.0.1";

    const result = await exchange("[::ffff:127.0.0.1]");

    expect(result.token).toBe("direct-test-token");
    expect(endpointRequests).toBe(1);
    expect(proxyRequests).toBe(0);
  });

  it("honors CIDR-form NO_PROXY exclusions (#200)", async () => {
    process.env.NO_PROXY = "127.0.0.0/8";

    const result = await exchange("127.0.0.1");

    expect(result.token).toBe("direct-test-token");
    expect(endpointRequests).toBe(1);
    expect(proxyRequests).toBe(0);
  });

  it("still uses the configured proxy for non-excluded destinations", async () => {
    process.env.NO_PROXY = "example.invalid";

    const result = await exchange("127.0.0.1");

    expect(result.token).toBe("proxy-test-token");
    expect(endpointRequests).toBe(0);
    expect(proxyRequests).toBe(1);
  });
});
