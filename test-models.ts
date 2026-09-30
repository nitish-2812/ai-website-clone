import { GoogleGenerativeAI } from '@google/generative-ai';

async function main() {
  const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
  
  // Try a simple text generation to test connectivity
  const models = ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-3.8-flash'];
  
  for (const modelName of models) {
    try {
      const model = ai.getGenerativeModel({ model: modelName });
      const result = await model.generateContent('Say hello in one word');
      console.log(`✅ ${modelName}: WORKS — "${result.response.text().trim()}"`);
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.includes('503')) {
        console.log(`⚠️  ${modelName}: 503 — overloaded`);
      } else if (msg.includes('404')) {
        console.log(`❌ ${modelName}: 404 — not found`);
      } else {
        console.log(`❌ ${modelName}: ${msg.substring(0, 300)}`);
      }
    }
  }
}

main();
