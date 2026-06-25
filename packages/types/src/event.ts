import { BaseelSdkInstance } from "./sdk.js";
import { ConsentChangePayload } from "./consent.js";
import { BaseelErrorPayload } from "./error.js";

export interface SdkEventMap {
  initialized: BaseelSdkInstance;
  consent_changed: ConsentChangePayload;
  error: BaseelErrorPayload;
}
