import { ErrorCode } from "@baseel-sdk/types";
import { Logger } from "./logger.js";
import { ApiError } from "./errors.js";

export interface ApiClientOptions {
  timeoutMs?: number;
  logger?: Logger;
}

export class ApiClient {
  private timeoutMs: number;
  private logger?: Logger;

  constructor(options: ApiClientOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? 5000;
    this.logger = options.logger;
  }

  public async get<T>(
    url: string,
    options?: { timeoutMs?: number },
  ): Promise<T> {
    const timeout = options?.timeoutMs ?? this.timeoutMs;
    this.logger?.debug(`GET request to URL: ${url}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, timeout);

    try {
      const response = await fetch(url, {
        method: "GET",
        signal: controller.signal,
        headers: {
          Accept: "application/json",
        },
      });

      clearTimeout(timeoutId);

      this.logger?.debug(
        `Response status: ${response.status} ${response.statusText}`,
      );

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new ApiError(
            ErrorCode.API_UNAUTHORIZED,
            `Unauthorized access. Status: ${response.status}`,
            { status: response.status, url },
          );
        }
        throw new ApiError(
          ErrorCode.API_CLIENT_ERROR,
          `HTTP Error response. Status: ${response.status}`,
          { status: response.status, url },
        );
      }

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new ApiError(
          ErrorCode.INVALID_BACKEND_RESPONSE,
          `Expected application/json response, got "${contentType || "none"}"`,
          { url },
        );
      }

      const data = await response.json();
      return data as T;
    } catch (err: any) {
      clearTimeout(timeoutId);
      this.logger?.debug(`Request failed: ${err.message || err}`);

      if (err instanceof ApiError) {
        throw err;
      }

      if (err.name === "AbortError") {
        throw new ApiError(
          ErrorCode.API_TIMEOUT,
          `Request timed out after ${timeout}ms`,
          { url },
        );
      }

      throw new ApiError(
        ErrorCode.API_NETWORK_ERROR,
        `Network failure: ${err.message || err}`,
        { url, originalError: err },
      );
    }
  }
}
