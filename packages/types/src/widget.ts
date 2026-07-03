export interface WidgetPiiItem {
  piiUuid: string;
  uuid?: string;
  piiCode?: string;
  name?: string;
  title?: string;
  description?: string;
  required: boolean;
  expiresAt?: string | null;
}

export interface WidgetCategory {
  uuid?: string;
  categoryCode?: string;
  name?: string;
  title?: string;
}

export interface WidgetPurposeItem {
  purposeUuid: string;
  uuid?: string;
  purposeCode?: string;
  name?: string;
  title?: string;
  description?: string;
  required?: boolean;
  category?: WidgetCategory;
  piis: WidgetPiiItem[];
}

export interface WidgetBranding {
  logoUrl?: string;
  brandTitle?: string;
}

export interface WidgetLegalEntity {
  type?: string;
  name?: string;
  email?: string;
  contact?: string;
}

export interface WidgetCallbacks {
  agreeCallbackUrl?: string;
  disagreeCallbackUrl?: string;
}

export interface WidgetUserAccount {
  uuid: string;
  email: string;
  contactNo?: string;
  roles: string[];
}

export interface WidgetUser {
  uuid: string;
  title?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  email?: string;
}

export interface WidgetApplication {
  uuid: string;
  name: string;
}

export interface WidgetTranslation {
  uuid?: string;
  languageCode: string;
  header: string;
  body: string;
  footer: string;
}

export interface WidgetPrivacyNotice {
  uuid: string;
  noticeCode?: string;
  version?: number;
  title: string;
  content: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  active?: boolean;
}

export interface WidgetTemplate {
  uuid: string;
  version: string | number;
  templateCode?: string;
  title: string;
  description?: string;
  status?: string;
  languageCode?: string;
  header?: string;
  body?: string;
  footer?: string;
  logoUrl?: string;
  callbackUrl?: string;
  legalEntityType?: string;
  legalEntityName?: string;
  legalEntityEmail?: string;
  legalEntityContact?: string;
  owner?: WidgetUser;
  dpo?: WidgetUser;
  application?: WidgetApplication;
  branding?: WidgetBranding;
  legalEntity?: WidgetLegalEntity;
  callbacks?: WidgetCallbacks;
  translations?: Record<string, WidgetTranslation>;
  notice?: WidgetPrivacyNotice;
  privacyNotice?: WidgetPrivacyNotice;
  purposes: WidgetPurposeItem[];
}

export interface ConsentPiiPayload {
  piiUuid: string;
  required: boolean;
}

export interface ConsentPurposePayload {
  purposeUuid: string;
  piis: ConsentPiiPayload[];
}

export interface ConsentSubmitPayload {
  templateUuid: string;
  templateVersion: string | number;
  languageCode: string;
  purposes: ConsentPurposePayload[];
}
