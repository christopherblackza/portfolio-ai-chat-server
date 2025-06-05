import { Injectable, InternalServerErrorException } from '@nestjs/common';
import OpenAI from 'openai';
import { DataAPIClient } from '@datastax/astra-db-ts';

@Injectable()
export class RagService {
    private openai: OpenAI;
    private client: DataAPIClient;
    private db;

    constructor() {
        this.openai = new OpenAI({ apiKey: process.env.OPEN_API_KEY });
        this.client = new DataAPIClient(process.env.ASTRA_DB_APPLICATION_TOKEN);
        this.db = this.client.db(process.env.ASTRA_DB_API_ENDPOINT, {
            keyspace: process.env.ASTRA_DB_NAMESPACE,
        });
    }

    async processQuestion(question: string): Promise<string> {
        // Step 1: Embed the question
        const embeddingResponse = await this.openai.embeddings.create({
            model: 'text-embedding-3-small',
            input: question,
            encoding_format: 'float',
        });

        const questionEmbedding = embeddingResponse.data[0].embedding;

        let docContext = '';

        try {
            // Step 2: Query DataStax Astra Vector DB using the client
                const collection = await this.db.collection(
                    process.env.ASTRA_DB_COLLECTION,
                );
                const cursor = collection.find(null, {
                    sort: { $vector: questionEmbedding },
                    limit: 3,
                });

                const documents = await cursor.toArray();
                // const docsMap = documents?.map((doc) => doc.text);

                const docsMap = documents
                .map((doc, index) => `(${index + 1}) ${doc.text.slice(0, 500).replace(/\n/g, ' ')}`)
                .join('\n');

            docContext = JSON.stringify(docsMap);
        } catch (err) {
            console.error('Error querying db', err);
            throw new InternalServerErrorException('Failed to query DB');
        }

        // Step 3: Construct prompt with retrieved context
    //     const prompt = `
    //   You are Christopher Black, an experienced full stack developer from Cape Town, South Africa. You offer your services to companies and individuals looking to create and maintain robust web applications with a modern and user-friendly interface.
      
    //   You answer as **Christopher** by default. Only speak generically as an AI if no info about Christopher is available.
      
    //   Use markdown if it helps. No images. Don’t explain your process.
      
    //   ---
    //   Context:
    //   ${docContext}
    //   ---
    //   Question: ${question}
    //   ---
    //   Instructions:
    //   Answer as Christopher, using the context **only when directly relevant to the specific question**.
      
    //   **Always respond with a single, chill, conversational sentence by default.**  
    //   Do **not** mention specific jobs, technologies, or projects unless the user **explicitly asks** for them.  
    //   Only elaborate if the user says something like “Tell me more” or asks for details.  
    //   Keep it mellow, friendly, and brief — like you're chatting over coffee.
    //   `;

    const prompt = `
    You are Christopher Black, a mellow full-stack dev from Cape Town.

Respond casually, like chatting over coffee. Use markdown if helpful, no images, no process explanation.

Use the context below **only if it's relevant to the question**. Don’t mention jobs, tech, or projects unless asked.

---
Context:
${docContext}
---
Question: ${question}`

        // Step 4: Ask OpenAI
        const completion = await this.openai.chat.completions.create({
            model: 'gpt-4.1-nano',
            messages: [
                {
                    role: 'system',
                    content: 'You answer based on the provided context.',
                },
                { role: 'user', content: prompt },
            ],
        });

        return completion.choices[0].message.content || '';
    }
}
