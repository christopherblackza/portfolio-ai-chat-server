export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

export interface ConversationSession {
  id: string;
  user_id?: string;
  session_name?: string;
  created_at: string;
  updated_at: string;
}