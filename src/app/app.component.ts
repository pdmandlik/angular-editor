import { Component, ViewChild } from '@angular/core';
import { EditorComponent } from './components/editor/editor.component';
import { EditorOutputMode } from './entities/editor-config';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  @ViewChild(EditorComponent) editorComponent!: EditorComponent;
  
  title = 'angular-editor';
  editorContent = '<p>Loading editor...</p>'; // Will be updated on init
  
  // NEW: Control output mode
  outputMode = EditorOutputMode.WithTrackedChanges; // Default to tracked output
  
  // Expose enum to template
  EditorOutputMode = EditorOutputMode;

  onContentChange(content: string) {
    this.editorContent = content;
  }
  
  /**
   * Toggle between clean and tracked output modes
   */
  toggleOutputMode(): void {
    this.outputMode = this.outputMode === EditorOutputMode.Clean 
      ? EditorOutputMode.WithTrackedChanges 
      : EditorOutputMode.Clean;
      
    // Update editor's output mode
    if (this.editorComponent) {
      this.editorComponent.setOutputMode(this.outputMode);
    }
  }
  
  /**
   * Get current output mode as readable string
   */
  getOutputModeLabel(): string {
    return this.outputMode === EditorOutputMode.Clean 
      ? 'Clean (No Track Changes)'
      : 'With Tracked Changes (Default)';
  }
}