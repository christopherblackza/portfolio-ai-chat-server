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

async function splitMarkdownBySections(text: string): Promise<string[]> {
  // Split on headings so each section stays together with its heading
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
      // Keep the heading as a prefix on each sub-chunk for context
      const heading = section.match(/^#{1,3}\s[^\n]+/)?.[0] ?? '';
      const subChunks = await splitter.splitText(section);
      subChunks.forEach((sub, i) => {
        chunks.push(i === 0 ? sub : `${heading}\n${sub}`);
      });
    }
  }

  return chunks;
}

async function deleteExistingVectors(fileName: string) {
  const { error } = await supabase
    .from('vectors')
    .delete()
    .eq('file_name', fileName);

  if (error) throw new Error(`Failed to delete vectors for ${fileName}: ${error.message}`);
  console.log(`  🗑  Cleared existing vectors for ${fileName}`);
}

async function seedFile(filePath: string) {
  const fileName = path.basename(filePath);
  const rawText = fs.readFileSync(filePath, 'utf-8');

  await deleteExistingVectors(fileName);

  const chunks = await splitMarkdownBySections(rawText);
  console.log(`  📄 ${chunks.length} chunks`);

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
      console.log(`  ✓ chunk ${i + 1}/${chunks.length}: ${chunk.split('\n')[0].slice(0, 60)}`);
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

  for (const file of files) {
    console.log(`\n📂 ${file}`);
    await seedFile(path.join(dataDir, file));
  }

  console.log('\n✅ Seeding complete');
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
