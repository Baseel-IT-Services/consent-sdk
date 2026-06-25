import { BackendSdkConfig, ErrorCode } from "@baseel/types";
import { ApiError } from "./errors.js";

export function validateBackendConfig(data: any): BackendSdkConfig {
  if (!data || typeof data !== "object") {
    throw new ApiError(
      ErrorCode.INVALID_BACKEND_RESPONSE,
      "Backend configuration is missing or not a valid object",
    );
  }

  if (typeof data.appId !== "string" || data.appId.trim() === "") {
    throw new ApiError(
      ErrorCode.INVALID_BACKEND_RESPONSE,
      'Backend configuration option "appId" is required and must be a non-empty string',
    );
  }

  if (typeof data.appName !== "string" || data.appName.trim() === "") {
    throw new ApiError(
      ErrorCode.INVALID_BACKEND_RESPONSE,
      'Backend configuration option "appName" is required and must be a non-empty string',
    );
  }

  if (!data.consent || typeof data.consent !== "object") {
    throw new ApiError(
      ErrorCode.INVALID_BACKEND_RESPONSE,
      'Backend configuration option "consent" is required and must be an object',
    );
  }

  if (typeof data.consent.enabled !== "boolean") {
    throw new ApiError(
      ErrorCode.INVALID_BACKEND_RESPONSE,
      'Backend configuration option "consent.enabled" is required and must be a boolean',
    );
  }

  if (!Array.isArray(data.consent.categories)) {
    throw new ApiError(
      ErrorCode.INVALID_BACKEND_RESPONSE,
      'Backend configuration option "consent.categories" is required and must be an array',
    );
  }

  const validatedCategories = data.consent.categories.map(
    (category: any, index: number) => {
      if (!category || typeof category !== "object") {
        throw new ApiError(
          ErrorCode.INVALID_BACKEND_RESPONSE,
          `Backend configuration consent category at index ${index} must be an object`,
        );
      }

      if (typeof category.id !== "string" || category.id.trim() === "") {
        throw new ApiError(
          ErrorCode.INVALID_BACKEND_RESPONSE,
          `Backend configuration consent category at index ${index} is missing or has an empty "id"`,
        );
      }

      if (typeof category.name !== "string" || category.name.trim() === "") {
        throw new ApiError(
          ErrorCode.INVALID_BACKEND_RESPONSE,
          `Backend configuration consent category at index ${index} is missing or has an empty "name"`,
        );
      }

      if (typeof category.required !== "boolean") {
        throw new ApiError(
          ErrorCode.INVALID_BACKEND_RESPONSE,
          `Backend configuration consent category at index ${index} "required" property must be a boolean`,
        );
      }

      if (
        category.defaultStatus !== "granted" &&
        category.defaultStatus !== "denied"
      ) {
        throw new ApiError(
          ErrorCode.INVALID_BACKEND_RESPONSE,
          `Backend configuration consent category at index ${index} "defaultStatus" must be "granted" or "denied"`,
        );
      }

      return {
        id: category.id.trim(),
        name: category.name.trim(),
        description:
          typeof category.description === "string"
            ? category.description.trim()
            : undefined,
        required: category.required,
        defaultStatus: category.defaultStatus,
      };
    },
  );

  const version =
    typeof data.version === "string" ? data.version.trim() : "1.0.0";

  const validatedConfig: BackendSdkConfig = {
    appId: data.appId.trim(),
    appName: data.appName.trim(),
    consent: {
      enabled: data.consent.enabled,
      categories: validatedCategories,
    },
    version,
  };

  if (data.banner && typeof data.banner === "object") {
    validatedConfig.banner = {
      title:
        typeof data.banner.title === "string"
          ? data.banner.title.trim()
          : undefined,
      description:
        typeof data.banner.description === "string"
          ? data.banner.description.trim()
          : undefined,
      primaryButtonText:
        typeof data.banner.primaryButtonText === "string"
          ? data.banner.primaryButtonText.trim()
          : undefined,
      secondaryButtonText:
        typeof data.banner.secondaryButtonText === "string"
          ? data.banner.secondaryButtonText.trim()
          : undefined,
    };
  }

  return validatedConfig;
}
