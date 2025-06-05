import { Injectable, InternalServerErrorException } from '@nestjs/common';
import OpenAI from 'openai';
import { DataAPIClient } from '@datastax/astra-db-ts';


@Injectable()
export class ChatService {
//     private openai = new OpenAI({ apiKey: process.env.OPEN_API_KEY });
//     private client = new DataAPIClient(process.env.ASTRA_DB_APPLICATION_TOKEN);
//     private db = this.client.db(process.env.ASTRA_DB_API_ENDPOINT, {
//         keyspace: process.env.ASTRA_DB_NAMESPACE,
//     });

//     async processChat(messages: any[]) {
//         const latestMessage = messages[messages.length - 1].content;

//         const embedding = await this.openai.embeddings.create({
//             model: 'text-embedding-3-small',
//             input: latestMessage,
//             encoding_format: 'float',
//         });

//         let docContext = '';

//         try {
//             const collection = await this.db.collection(
//                 process.env.ASTRA_DB_COLLECTION,
//             );
//             const cursor = collection.find(null, {
//                 sort: { $vector: embedding.data[0].embedding },
//                 limit: 10,
//             });

//             const documents = await cursor.toArray();
//             const docsMap = documents.map((doc) => doc.text);
//             docContext = JSON.stringify(docsMap);
//         } catch (err) {
//             console.error('Error querying db', err);
//             throw new InternalServerErrorException('Failed to query DB');
//         }

//         const template = {
//             role: 'system',
//             content: `
//                 You are Christopher Black, an experienced full stack developer from Cape Town, South Africa. You offer your services to companies and individuals looking to create and maintain robust web applications with a modern and user-friendly interface.

//                 You answer as **Christopher** by default. Only speak generically as an AI if no info about Christopher is available.

//                 Use markdown if it helps. No images. Don't explain your process.

//                 ---
//                 Context:
//                 ${docContext}
//                 ---
//                 Question: ${latestMessage}
//                 ---
//                 Instructions:
//                 Answer as Christopher, using the context **only when directly relevant to the specific question**.

//                 **Always respond with a single, chill, conversational sentence by default.**  
//                 Do **not** mention specific jobs, technologies, or projects unless the user **explicitly asks** for them.  
//                 Only elaborate if the user says something like "Tell me more" or asks for details.  
//                 Keep it mellow, friendly, and brief — like you're chatting over coffee.
// `,
//         };

//         const response = await this.openai.chat.completions.create({
//             model: 'gpt-4o-mini', // Note: 'gpt-4.1-nano' might not be a valid model
//             stream: true,
//             messages: [template, ...messages],
//             max_tokens: 300,
//             temperature: 0.5,
//         });

//         console.log('resp is', response);
        
//         // Convert the OpenAI stream to a proper ReadableStream
//         return new ReadableStream({
//             async start(controller) {
//                 try {
//                     for await (const chunk of response) {
//                         const content = chunk.choices[0]?.delta?.content || '';
//                         if (content) {
//                             controller.enqueue(new TextEncoder().encode(content));
//                         }
//                     }
//                     controller.close();
//                 } catch (error) {
//                     controller.error(error);
//                 }
//             }
//         });
//     }
}
