import { Component, ElementRef, AfterViewInit, OnDestroy, ViewChild, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class AppComponent implements AfterViewInit, OnDestroy {
  title = 'angular-app';
  showWidget = true;
  grantedCount = 0;
  lastDetail: string | null = null;

  @ViewChild('consentEl') consentEl?: ElementRef<HTMLElement>;

  private manualListener = (e: Event) => {
    const detail = (e as CustomEvent).detail;
    this.grantedCount++;
    this.lastDetail = JSON.stringify(detail) + ' (via manual addEventListener)';
    console.log('[manual addEventListener] baseel:consent-granted', detail);
  };

  ngAfterViewInit(): void {
    this.attachManualListener();
  }

  ngAfterViewChecked_manualAttach(): void {
    // no-op placeholder
  }

  private attachManualListener(): void {
    if (this.consentEl?.nativeElement) {
      this.consentEl.nativeElement.addEventListener('baseel:consent-granted', this.manualListener);
    }
  }

  private detachManualListener(): void {
    if (this.consentEl?.nativeElement) {
      this.consentEl.nativeElement.removeEventListener('baseel:consent-granted', this.manualListener);
    }
  }

  onGrantedBinding(event: Event): void {
    // This only fires if Angular's (baseel:consent-granted)="..." template binding actually works.
    const detail = (event as CustomEvent).detail;
    console.log('[Angular template binding] baseel:consent-granted', detail);
  }

  toggleWidget(): void {
    if (this.showWidget) {
      this.detachManualListener();
    }
    this.showWidget = !this.showWidget;
    if (this.showWidget) {
      setTimeout(() => this.attachManualListener(), 0);
    }
  }

  remount(): void {
    this.detachManualListener();
    this.showWidget = false;
    setTimeout(() => {
      this.showWidget = true;
      setTimeout(() => this.attachManualListener(), 0);
    }, 0);
  }

  ngOnDestroy(): void {
    this.detachManualListener();
  }
}
