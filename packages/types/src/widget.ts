export interface WidgetUser {
  uuid: string;
  name?: string;
  email?: string;
}

export interface WidgetPurposeItem {
  uuid: string;
  name: string;
  description?: string;
  required: boolean;
  accepted: boolean;
  legalBasis?: string;
}

export interface WidgetTemplate {
  uuid: string;
  version: string | number;
  templateCode?: string;
  title: string;
  description?: string;
  status?: string;
  languageCode?: string;
  content?: string;
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
  branding?: { logoUrl?: string };
  purposes: WidgetPurposeItem[];
}
