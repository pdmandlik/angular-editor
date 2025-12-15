import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'ed-track-change-tooltip',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="track-change-tooltip">
      <div class="tooltip-line1">{{ line1 }}</div>
      <div class="tooltip-line2">{{ line2 }}</div>
    </div>
  `,
  styles: [`
    .track-change-tooltip {
      background-color: rgba(33, 33, 33, 0.95);
      color: white;
      padding: 12px 16px;
      border-radius: 6px;
      font-size: 13px;
      line-height: 1.6;
      max-width: 300px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      pointer-events: none;
      user-select: none;
    }

    .tooltip-line1 {
      font-weight: 500;
      margin-bottom: 4px;
    }

    .tooltip-line2 {
      font-size: 12px;
      opacity: 0.9;
    }
  `]
})
export class TrackChangeTooltipComponent {
  @Input() line1: string = '';
  @Input() line2: string = '';
}