import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { BehaviorSubject, Observable } from 'rxjs';

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}

@Injectable({
  providedIn: 'root'
})
export class AiChatService {
  private messagesSubject = new BehaviorSubject<ChatMessage[]>([
    { role: 'model', content: 'Chào bạn! Mình là AI của EZMOVIE. Mình có thể giúp gì cho bạn hôm nay?' }
  ]);
  public messages$ = this.messagesSubject.asObservable();
  private isLoadingSubject = new BehaviorSubject<boolean>(false);
  public isLoading$ = this.isLoadingSubject.asObservable();

  constructor(private http: HttpClient) {}

  sendMessage(content: string) {
    const currentMessages = this.messagesSubject.value;
    
    // Add user message
    const userMessage: ChatMessage = { role: 'user', content };
    this.messagesSubject.next([...currentMessages, userMessage]);
    this.isLoadingSubject.next(true);

    // Prepare history (excluding the first welcome message if we want, or send everything)
    const history = this.messagesSubject.value.map(m => ({ role: m.role, content: m.content }));

    this.http.post<{ response: string }>(`${environment.apiUrl}/ai/chat`, {
      message: content,
      history: history.slice(0, -1) // Exclude the current message we just added
    }).subscribe({
      next: (res) => {
        const modelMessage: ChatMessage = { role: 'model', content: res.response };
        this.messagesSubject.next([...this.messagesSubject.value, modelMessage]);
        this.isLoadingSubject.next(false);
      },
      error: (err) => {
        console.error('AI Chat Error', err);
        const errorMessage: ChatMessage = { role: 'model', content: 'Xin lỗi, hệ thống AI đang gặp sự cố. Bạn vui lòng thử lại sau.' };
        this.messagesSubject.next([...this.messagesSubject.value, errorMessage]);
        this.isLoadingSubject.next(false);
      }
    });
  }

  clearHistory() {
    this.messagesSubject.next([{ role: 'model', content: 'Chào bạn! Mình là AI của EZMOVIE. Mình có thể giúp gì cho bạn hôm nay?' }]);
  }
}
