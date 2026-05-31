import { Component, OnInit, ElementRef, ViewChild, AfterViewChecked } from '@angular/core';
import { AiChatService, ChatMessage } from '../../services/ai-chat.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-ai-chat',
  templateUrl: './ai-chat.component.html',
  styleUrls: ['./ai-chat.component.css']
})
export class AiChatComponent implements OnInit, AfterViewChecked {
  @ViewChild('chatBody') private chatBody!: ElementRef;
  
  public isOpen = false;
  public messages$: Observable<ChatMessage[]>;
  public isLoading$: Observable<boolean>;
  public userInput = '';

  constructor(private aiChatService: AiChatService) {
    this.messages$ = this.aiChatService.messages$;
    this.isLoading$ = this.aiChatService.isLoading$;
  }

  ngOnInit(): void {}

  ngAfterViewChecked() {
    this.scrollToBottom();
  }

  toggleChat() {
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      setTimeout(() => this.scrollToBottom(), 100);
    }
  }

  sendMessage() {
    if (!this.userInput.trim()) return;
    this.aiChatService.sendMessage(this.userInput);
    this.userInput = '';
  }

  handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  clearChat() {
    this.aiChatService.clearHistory();
  }

  private scrollToBottom(): void {
    if (this.chatBody && this.chatBody.nativeElement) {
      try {
        this.chatBody.nativeElement.scrollTop = this.chatBody.nativeElement.scrollHeight;
      } catch (err) {}
    }
  }
}
