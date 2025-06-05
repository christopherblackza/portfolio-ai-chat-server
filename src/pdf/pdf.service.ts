import { Injectable } from '@nestjs/common';
import axios from 'axios';


@Injectable()
export class PdfService {

  model1 = 'distilbert-base-uncased-distilled-squad';
  model2 = 'bert-large-uncased-whole-word-masking-finetuned-squad';
  model3 = 'deepset/roberta-base-squad2';
  model4 = 'deepset/bert-base-cased-squad2';
  
  private pdfTextCache: { [key: string]: string } = {};

  async storePdfText(text: string): Promise<string> {
    const fileId = Math.random().toString(36).substring(7); // Generate a simple unique ID
    this.pdfTextCache[fileId] = text;
    return fileId;
  }

   async answerQuestionFromCache(fileId: string, question: string): Promise<string> {
    const pdfText = this.pdfTextCache[fileId];
    if (!pdfText) {
      throw new Error('PDF text not found. Please upload the file first.');
    }
    return this.answerQuestion(pdfText, question);
  }

  private async answerQuestion(pdfText: string, question: string): Promise<string> {
    console.log('Answering question...');
    try {
      

      const apiKey = process.env.HUGGING_FACE_API_KEY;
    
      if (!apiKey) {
        throw new Error('Hugging Face API key is not configured');
      }
  

      const response = await axios.post(
        `https://api-inference.huggingface.co/models/${this.model3}`,
        {
          inputs: {
            question: question,
            context: pdfText,
          },
        },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
             "Accept": "application/json"
          },
        },
      );

      const answer = response.data && response.data.answer ? response.data.answer : "Sorry, I couldn't find an answer.";
      return answer;
    } catch (error) {
      console.error('Error with Hugging Face API:', error);
      return "Error fetching answer. Please try again later.";
    }
  }
}