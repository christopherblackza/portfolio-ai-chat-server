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
    this.openai = new OpenAI({ apiKey: process.env.OPEN_API_KEY });
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
    // Try to get the user's most recent session
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

    // If user has a recent session, use it
    if (sessions && sessions.length > 0) {
      return sessions[0];
    }

    // Otherwise, create a new session
    return this.createSession(userId, 'Auto Session');
  }

  async processQuestionWithMemory(
    question: string,
    sessionId?: string,
    userId?: string,
  ): Promise<{ answer: string; sessionId: string }> {
    // Create or get session
    let currentSessionId = sessionId;
    if (!currentSessionId) {
      const session = await this.createSession(userId);
      currentSessionId = session.id;
    }

    // Get conversation history
    const history = await this.getConversationHistory(currentSessionId);

    // Store user question
    await this.addMessageToHistory(currentSessionId, 'user', question);

    // Step 1: Embed the question
    const embeddingResponse = await this.openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: question,
      encoding_format: 'float',
    });

    const questionEmbedding = embeddingResponse.data[0].embedding;

    let docContext = '';

    try {
      // Step 2: Query Supabase vectors table using RPC function
      const { data: documents, error } = await this.supabase.rpc(
        'match_documents',
        {
          query_embedding: questionEmbedding,
          match_count: 3,
        },
      );

      if (error) {
        console.error('Error querying Supabase vectors:', error);
        throw new InternalServerErrorException('Failed to query vectors table');
      }

      // Format the retrieved documents
      const docsMap =
        documents
          ?.map(
            (doc, index) =>
              `(${index + 1}) ${doc.content.slice(0, 500).replace(/\n/g, ' ')}`,
          )
          .join('\n') || '';

      docContext = JSON.stringify(docsMap);
    } catch (err) {
      console.error('Error querying vectors table:', err);
      throw new InternalServerErrorException('Failed to query vectors table');
    }

    // Step 3: Prepare conversation context
    const conversationContext = history
      .slice(-10) // Keep last 10 messages for context
      .map((msg) => `${msg.role}: ${msg.content}`)
      .join('\n');

    // Step 4: Construct prompt with retrieved context and conversation history
    const prompt = `
${AI_PROMPT}

---
Knowledge Base Context:
${docContext}

---
Conversation History:
${conversationContext}

---
Current Question: ${question}`;

    console.log('[PROMPT]', prompt);

    // Step 5: Ask OpenAI
    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a helpful assistant that answers questions based only on the provided context.
          Keep your answers conversational, natural, and concise (1 short sentence).
          Do NOT include extra details (like dates or specific numbers) unless the user explicitly asks for them.
          Example: If asked "How old are you?", answer "I'm 30 years old." (NOT "I'm 30 years old, born in 1995").
          If you don't know the answer, just say so naturally.`,
        },
        { role: 'user', content: prompt },
      ],
      max_tokens: 500,
      temperature: 0.7,
    });

    const answer = completion.choices[0].message.content || '';

    // Store assistant response
    await this.addMessageToHistory(currentSessionId, 'assistant', answer);

    return { answer, sessionId: currentSessionId };
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

    // Convert Buffer to Text
    const mdText = file.buffer.toString('utf-8');

    // Optional: Strip frontmatter or markdown formatting if needed
    const cleanText = mdText.replace(/[#*_>`-]/g, '').replace(/\n+/g, '\n');
    console.log('CLEAN TEXT', cleanText);

    // Split Text
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });

    const chunks = await splitter.splitText(cleanText);

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

  private cosineSimilarity(a: number[], b: number[]): number {
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    return dotProduct / (magnitudeA * magnitudeB);
  }
}
