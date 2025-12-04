import {
  Directive,
  ElementRef,
  OnInit,
  OnDestroy,
  Renderer2,
  NgZone,
  ViewContainerRef
} from '@angular/core';
import { Overlay, OverlayPositionBuilder } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { TrackChangeTooltipComponent } from '../components/track-changes/track-change-tooltip/track-change-tooltip.component';
import { TooltipData } from '../entities/editor-config';

@Directive({
  selector: '[appTrackChangesTooltip]',
  standalone: true
})
export class TrackChangesTooltipDirective implements OnInit, OnDestroy {
  private readonly MUTATION_BATCH_DELAY = 50;
  
  private observer: MutationObserver | null = null;
  private tooltipDataMap = new Map<HTMLElement, TooltipData>();
  private mutationBatchTimer: any = null;
  private pendingMutations: MutationRecord[] = [];

  constructor(
    private elementRef: ElementRef,
    private renderer: Renderer2,
    private ngZone: NgZone,
    private overlay: Overlay,
    private overlayPositionBuilder: OverlayPositionBuilder,
    private viewContainerRef: ViewContainerRef
  ) {}

  ngOnInit(): void {
    this.initializeMutationObserver();
    this.processExistingSpans();
  }

  ngOnDestroy(): void {
    if (this.observer) {
      this.observer.disconnect();
    }

    if (this.mutationBatchTimer) {
      clearTimeout(this.mutationBatchTimer);
      this.processPendingMutations();
    }

    this.tooltipDataMap.forEach(data => {
      this.destroyTooltip(data);
    });
    this.tooltipDataMap.clear();
  }

  private initializeMutationObserver(): void {
    this.ngZone.runOutsideAngular(() => {
      this.observer = new MutationObserver((mutations) => {
        this.pendingMutations.push(...mutations);
        
        if (this.mutationBatchTimer) {
          clearTimeout(this.mutationBatchTimer);
        }
        
        this.mutationBatchTimer = setTimeout(() => {
          this.ngZone.run(() => {
            this.processPendingMutations();
          });
        }, this.MUTATION_BATCH_DELAY);
      });

      this.observer.observe(this.elementRef.nativeElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['data-change-id', 'data-accepted', 'data-rejected']
      });
    });
  }

  private processPendingMutations(): void {
    if (this.pendingMutations.length === 0) return;
    
    const mutations = [...this.pendingMutations];
    this.pendingMutations = [];
    this.mutationBatchTimer = null;
    
    const toRemove = new Set<HTMLElement>();
    const toAdd = new Set<HTMLElement>();
    
    for (const mutation of mutations) {
      mutation.removedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          toRemove.add(node as HTMLElement);
        }
      });
      
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          toAdd.add(node as HTMLElement);
        }
      });
    }
    
    toRemove.forEach(element => {
      this.cleanupElement(element);
    });
    
    toAdd.forEach(element => {
      if (document.contains(element)) {
        this.processElement(element);
      }
    });
  }

  private processExistingSpans(): void {
    const spans = this.elementRef.nativeElement.querySelectorAll('[data-change-id]');
    spans.forEach((span: HTMLElement) => {
      this.attachTooltipToSpan(span);
    });
  }

  private processElement(element: HTMLElement): void {
    if (element.hasAttribute('data-change-id')) {
      this.attachTooltipToSpan(element);
    }

    const spans = element.querySelectorAll('[data-change-id]');
    spans.forEach((span: HTMLElement) => {
      this.attachTooltipToSpan(span);
    });
  }

  private cleanupElement(element: HTMLElement): void {
    if (this.tooltipDataMap.has(element)) {
      const data = this.tooltipDataMap.get(element)!;
      this.destroyTooltip(data);
      this.tooltipDataMap.delete(element);
    }

    const spans = element.querySelectorAll('[data-change-id]');
    spans.forEach((span: HTMLElement) => {
      if (this.tooltipDataMap.has(span)) {
        const data = this.tooltipDataMap.get(span)!;
        this.destroyTooltip(data);
        this.tooltipDataMap.delete(span);
      }
    });
  }

  private attachTooltipToSpan(span: HTMLElement): void {
    if (this.tooltipDataMap.has(span) || 
        !document.contains(span) ||
        span.getAttribute('data-accepted') === 'true' || 
        span.getAttribute('data-rejected') === 'true') {
      return;
    }

    const tooltipText = this.generateTooltipText(span);
    if (!tooltipText) return;

    const tooltipData: TooltipData = {
      element: span,
      overlayRef: null,
      componentRef: null,
      mouseEnterListener: null,
      mouseLeaveListener: null
    };

    tooltipData.mouseEnterListener = this.renderer.listen(span, 'mouseenter', () => {
      this.showTooltip(tooltipData, tooltipText);
    });

    tooltipData.mouseLeaveListener = this.renderer.listen(span, 'mouseleave', () => {
      this.hideTooltip(tooltipData);
    });

    this.tooltipDataMap.set(span, tooltipData);
  }

  private showTooltip(tooltipData: TooltipData, text: { line1: string; line2: string }): void {
    if (tooltipData.overlayRef || !document.contains(tooltipData.element)) {
      return;
    }

    const positionStrategy = this.overlayPositionBuilder
      .flexibleConnectedTo(tooltipData.element)
      .withPositions([
        {
          originX: 'center',
          originY: 'top',
          overlayX: 'center',
          overlayY: 'bottom',
          offsetY: -8
        },
        {
          originX: 'center',
          originY: 'bottom',
          overlayX: 'center',
          overlayY: 'top',
          offsetY: 8
        }
      ])
      .withPush(true)
      .withViewportMargin(8);

    tooltipData.overlayRef = this.overlay.create({
      positionStrategy,
      scrollStrategy: this.overlay.scrollStrategies.close(),
      panelClass: 'track-changes-tooltip-overlay'
    });

    const tooltipPortal = new ComponentPortal(
      TrackChangeTooltipComponent,
      this.viewContainerRef
    );
    
    try {
      tooltipData.componentRef = tooltipData.overlayRef.attach(tooltipPortal);
      tooltipData.componentRef.instance.line1 = text.line1;
      tooltipData.componentRef.instance.line2 = text.line2;
    } catch (error) {
      if (tooltipData.overlayRef) {
        tooltipData.overlayRef.dispose();
        tooltipData.overlayRef = null;
      }
    }
  }

  private hideTooltip(tooltipData: TooltipData): void {
    if (tooltipData.overlayRef) {
      try {
        tooltipData.overlayRef.dispose();
      } catch (error) {
        // Disposal failed - ignore
      }
      tooltipData.overlayRef = null;
      tooltipData.componentRef = null;
    }
  }

  private destroyTooltip(tooltipData: TooltipData): void {
    if (tooltipData.mouseEnterListener) {
      try {
        tooltipData.mouseEnterListener();
      } catch (error) {
        // Listener removal failed
      }
    }
    if (tooltipData.mouseLeaveListener) {
      try {
        tooltipData.mouseLeaveListener();
      } catch (error) {
        // Listener removal failed
      }
    }

    this.hideTooltip(tooltipData);
  }

  private generateTooltipText(span: HTMLElement): { line1: string; line2: string } | null {
    const changeType = span.getAttribute('data-change-type');
    const userName = span.getAttribute('data-user-name') || 'Unknown User';
    const timestamp = span.getAttribute('data-timestamp');
    const isAccepted = span.getAttribute('data-accepted') === 'true';
    const isRejected = span.getAttribute('data-rejected') === 'true';

    if (!changeType || !timestamp) return null;

    let date: Date;
    try {
      date = new Date(timestamp);
      if (isNaN(date.getTime())) {
        return null;
      }
    } catch {
      return null;
    }

    const formattedDate = this.formatDate(date);
    const formattedTime = this.formatTime(date);

    let action = '';
    if (changeType === 'insert') {
      action = isAccepted ? 'Accepted insertion' : isRejected ? 'Rejected insertion' : 'Inserted';
    } else if (changeType === 'delete') {
      action = isAccepted ? 'Accepted deletion' : isRejected ? 'Rejected deletion' : 'Deleted';
    }

    return {
      line1: `${action} by ${userName}`,
      line2: `${formattedDate} at ${formattedTime}`
    };
  }

  private formatDate(date: Date): string {
    try {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      const inputDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

      if (inputDate.getTime() === today.getTime()) {
        return 'Today';
      } else if (inputDate.getTime() === yesterday.getTime()) {
        return 'Yesterday';
      } else {
        const options: Intl.DateTimeFormatOptions = {
          weekday: 'short',
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        };
        return date.toLocaleDateString('en-US', options);
      }
    } catch (error) {
      return 'Unknown date';
    }
  }

  private formatTime(date: Date): string {
    try {
      const options: Intl.DateTimeFormatOptions = {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      };
      return date.toLocaleTimeString('en-US', options);
    } catch (error) {
      return 'Unknown time';
    }
  }
}