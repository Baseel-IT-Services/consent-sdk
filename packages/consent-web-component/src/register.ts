import { BaseelConsent } from './component/BaseelConsent.js';
import { ELEMENT_TAG } from './constants.js';

if (typeof customElements !== 'undefined' && !customElements.get(ELEMENT_TAG)) {
  customElements.define(ELEMENT_TAG, BaseelConsent);
}
