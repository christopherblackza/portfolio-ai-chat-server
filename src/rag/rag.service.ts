import { Injectable, InternalServerErrorException } from '@nestjs/common';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import * as pdf from 'pdf-parse';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import * as fs from 'fs';
import { ConversationMessage, ConversationSession } from './rag.types';
import { AI_PROMPT } from 'src/constants.const';

@Injectable()
export class RagService {
  private openai: OpenAI;
  private supabaseUrl = process.env.SUPABASE_URL;
  private supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  private readonly supabase = createClient(
    this.supabaseUrl,
    this.supabaseAnonKey,
  );

  constructor() {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
      throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY must be set');
    }
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  /**
   * New method that automatically manages sessions per user
   */
  async processQuestionWithAutoSession(
    question: string,
    userId: string,
  ): Promise<{ answer: string; sessionId: string }> {
    // Get or create the user's active session
    let activeSession = await this.getOrCreateActiveSession(userId);

    // Use the existing processQuestionWithMemory method
    return this.processQuestionWithMemory(question, activeSession.id, userId);
  }

  /**
   * Get the user's most recent session or create a new one
   */
  private async getOrCreateActiveSession(
    userId: string,
  ): Promise<ConversationSession> {
    const { data: sessions, error } = await this.supabase
      .from('conversation_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('Error fetching user sessions:', error);
      throw new InternalServerErrorException('Failed to fetch user sessions');
    }

    const SESSION_EXPIRY_MS = 60 * 60 * 1000; // 1 hour
    if (sessions && sessions.length > 0) {
      const lastActive = new Date(sessions[0].updated_at).getTime();
      if (Date.now() - lastActive < SESSION_EXPIRY_MS) {
        return sessions[0];
      }
    }

    return this.createSession(userId, 'New Conversation');
  }

  async processQuestionWithMemory(
    question: string,
    sessionId?: string,
    userId?: string,
  ): Promise<{ answer: string; sessionId: string }> {
    let currentSessionId = sessionId;
    if (!currentSessionId) {
      const session = await this.createSession(userId);
      currentSessionId = session.id;
    }

    const { messages, currentSessionId: sid } = await this.buildChatMessages(
      question,
      currentSessionId,
    );

    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      max_tokens: 500,
      temperature: 0.7,
    });

    const answer = completion.choices[0].message.content || '';
    await this.addMessageToHistory(sid, 'assistant', answer);

    return { answer, sessionId: sid };
  }

  async streamQuestion(
    question: string,
    userId: string,
    res: import('express').Response,
  ): Promise<void> {
    const activeSession = await this.getOrCreateActiveSession(userId);

    const { messages, currentSessionId } = await this.buildChatMessages(
      question,
      activeSession.id,
    );

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const stream = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      max_tokens: 500,
      temperature: 0.7,
      stream: true,
    });

    let fullAnswer = '';
    for await (const chunk of stream) {
      const token = chunk.choices[0]?.delta?.content || '';
      if (token) {
        fullAnswer += token;
        res.write(`data: ${JSON.stringify({ token })}\n\n`);
      }
    }

    res.write(
      `data: ${JSON.stringify({ done: true, sessionId: currentSessionId })}\n\n`,
    );
    res.end();

    await this.addMessageToHistory(currentSessionId, 'assistant', fullAnswer);
  }

  private async buildChatMessages(
    question: string,
    sessionId: string,
  ): Promise<{
    messages: OpenAI.Chat.ChatCompletionMessageParam[];
    currentSessionId: string;
  }> {
    const history = await this.getConversationHistory(sessionId);
    await this.addMessageToHistory(sessionId, 'user', question);

    const embeddingResponse = await this.openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: question,
      encoding_format: 'float',
    });

    const { data: documents, error } = await this.supabase.rpc(
      'match_documents',
      { query_embedding: embeddingResponse.data[0].embedding, match_count: 5 },
    );

    if (error) {
      throw new InternalServerErrorException('Failed to query vectors table');
    }

    const docContext = documents
      ?.map((doc, i) => `(${i + 1}) ${doc.content}`)
      .join('\n\n');

    const conversationContext = history
      .slice(-10)
      .map((msg) => `${msg.role}: ${msg.content}`)
      .join('\n');

    const userPrompt = `${AI_PROMPT}

---
Knowledge Base Context:
${docContext}

---
Conversation History:
${conversationContext}

---
Current Question: ${question}`;

    return {
      messages: [
        {
          role: 'system',
          content:
            'Answer only from the provided Knowledge Base Context. Be conversational and concise. If the context does not cover the question, say so naturally.',
        },
        { role: 'user', content: userPrompt },
      ],
      currentSessionId: sessionId,
    };
  }

  async createSession(
    userId?: string,
    sessionName?: string,
  ): Promise<ConversationSession> {
    const { data, error } = await this.supabase
      .from('conversation_sessions')
      .insert({
        user_id: userId,
        session_name: sessionName || 'New Conversation',
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating session:', error);
      throw new InternalServerErrorException('Failed to create session');
    }

    return data;
  }

  async getUserSessions(userId: string): Promise<ConversationSession[]> {
    const { data, error } = await this.supabase
      .from('conversation_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching user sessions:', error);
      throw new InternalServerErrorException('Failed to fetch sessions');
    }

    return data || [];
  }

  async getConversationHistory(
    sessionId: string,
  ): Promise<ConversationMessage[]> {
    const { data, error } = await this.supabase
      .from('conversation_history')
      .select('role, content, timestamp')
      .eq('session_id', sessionId)
      .order('timestamp', { ascending: true });

    if (error) {
      console.error('Error fetching conversation history:', error);
      throw new InternalServerErrorException(
        'Failed to fetch conversation history',
      );
    }

    return data || [];
  }

  async addMessageToHistory(
    sessionId: string,
    role: 'user' | 'assistant',
    content: string,
  ): Promise<void> {
    const { error } = await this.supabase.from('conversation_history').insert({
      session_id: sessionId,
      role,
      content,
    });

    if (error) {
      console.error('Error adding message to history:', error);
      throw new InternalServerErrorException('Failed to save message');
    }

    // Update session timestamp
    await this.supabase
      .from('conversation_sessions')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', sessionId);
  }

  async deleteSession(sessionId: string): Promise<{ message: string }> {
    const { error } = await this.supabase
      .from('conversation_sessions')
      .delete()
      .eq('id', sessionId);

    if (error) {
      console.error('Error deleting session:', error);
      throw new InternalServerErrorException('Failed to delete session');
    }

    return { message: 'Session deleted successfully' };
  }

  // Keep the original method for backward compatibility
  async processQuestion(question: string): Promise<string> {
    const result = await this.processQuestionWithMemory(question);
    return result.answer;
  }

  async processPdf(file: Express.Multer.File) {
    const uploadsDir = path.join(__dirname, '..', '..', 'uploads');

    // ✅ Create the uploads directory if it doesn't exist
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const filePath = path.join(uploadsDir, `${uuidv4()}_${file.originalname}`);
    fs.writeFileSync(filePath, file.buffer);

    // Upload to Supabase Storage
    const filename = `${uuidv4()}_${file.originalname}`;
    const storagePath = `pdfs/${filename}`;

    const { data: uploadData, error: uploadErr } = await this.supabase.storage
      .from('documents')
      .upload(storagePath, file.buffer, {
        contentType: file.mimetype,
        upsert: true,
      });
    if (uploadErr) throw uploadErr;

    // Parse PDF Text
    const dataBuffer = fs.readFileSync(filePath);
    const pdfData = await pdf(dataBuffer);

    // Split Text
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });

    const chunks = await splitter.splitText(pdfData.text);

    for (const chunk of chunks) {
      const embedding = await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: chunk,
      });

      const vector = embedding.data[0].embedding;

      // Store vector and text in Supabase (assumes pgvector is set up)
      await this.supabase.from('vectors').insert({
        content: chunk,
        embedding: vector,
        file_url: uploadData.path,
      });
    }

    return { message: 'PDF processed and embedded successfully' };
  }

  async processMd(file: Express.Multer.File) {
    // const uploadsDir = path.join(__dirname, '..', '..', 'uploads');

    // if (!fs.existsSync(uploadsDir)) {
    //   fs.mkdirSync(uploadsDir, { recursive: true });
    // }

    // const filePath = path.join(uploadsDir, `${uuidv4()}_${file.originalname}`);
    // fs.writeFileSync(filePath, file.buffer);

    // Upload to Supabase Storage
    const filename = `${uuidv4()}_${file.originalname}`;
    const storagePath = `markdowns/${filename}`;

    const { data: uploadData, error: uploadErr } = await this.supabase.storage
      .from('documents')
      .upload(storagePath, file.buffer, {
        contentType: file.mimetype,
        upsert: true,
      });

    if (uploadErr) throw uploadErr;

    const mdText = file.buffer.toString('utf-8');
    const chunks = await this.splitMarkdownBySections(mdText);

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];

      const embedding = await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: chunk,
      });

      const vector = embedding.data[0].embedding;

      await this.supabase.from('vectors').insert({
        content: chunk,
        embedding: vector,
        file_url: uploadData.path,
        file_name: file.originalname,
        chunk_index: i,
        total_chunks: chunks.length,
        uploaded_at: new Date().toISOString(),
        source_type: 'markdown', // or 'pdf'
      });
    }

    return { message: 'Markdown file processed and embedded successfully' };
  }

  private async splitMarkdownBySections(text: string): Promise<string[]> {
    const rawSections = text
      .split(/(?=\n#{1,3}\s)/)
      .map((s) => s.trim())
      .filter(Boolean);

    const chunks: string[] = [];
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });

    for (const section of rawSections) {
      if (section.length <= 1000) {
        chunks.push(section);
      } else {
        const heading = section.match(/^#{1,3}\s[^\n]+/)?.[0] ?? '';
        const subChunks = await splitter.splitText(section);
        subChunks.forEach((sub, i) => {
          chunks.push(i === 0 ? sub : `${heading}\n${sub}`);
        });
      }
    }

    return chunks;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    return dotProduct / (magnitudeA * magnitudeB);
  }
}
