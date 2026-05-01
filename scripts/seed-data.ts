import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';

const openai = new OpenAI({ apiKey: process.env.OPEN_API_KEY });
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!,
);

async function seedFile(filePath: string) {
  const fileName = path.basename(filePath);
  const rawText = fs.readFileSync(filePath, 'utf-8');
  const cleanText = rawText.replace(/[#*_>`-]/g, '').replace(/\n+/g, '\n').trim();

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });

  const chunks = await splitter.splitText(cleanText);
  console.log(`\n📄 ${fileName} → ${chunks.length} chunks`);

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];

    const embeddingRes = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: chunk,
    });

    const vector = embeddingRes.data[0].embedding;

    const { error } = await supabase.from('vectors').insert({
      content: chunk,
      embedding: vector,
      file_name: fileName,
      file_url: `data/${fileName}`,
      chunk_index: i,
      total_chunks: chunks.length,
      uploaded_at: new Date().toISOString(),
      source_type: 'markdown',
    });

    if (error) {
      console.error(`  ✗ chunk ${i + 1}/${chunks.length}:`, error.message);
    } else {
      console.log(`  ✓ chunk ${i + 1}/${chunks.length}`);
    }
  }
}

async function main() {
  const dataDir = path.resolve(__dirname, '../data');
  const files = fs.readdirSync(dataDir).filter((f) => f.endsWith('.md'));

  if (files.length === 0) {
    console.log('No markdown files found in /data');
    return;
  }

  console.log(`Found ${files.length} file(s) to seed:`, files);

  for (const file of files) {
    await seedFile(path.join(dataDir, file));
  }

  console.log('\n✅ Seeding complete');
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
