import { SYSTEM_PROMPT } from './prompts.js';

export class LLMProvider {
  constructor() {
    this.apiKey = process.env.GROQ_API_KEY || '';
    // Fast, state-of-the-art coding models on Groq LPU
    this.model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
    this.endpoint = 'https://api.groq.com/openai/v1/chat/completions';
  }

  isLiveAIConfigured() {
    this.apiKey = process.env.GROQ_API_KEY || '';
    return Boolean(this.apiKey);
  }

  /**
   * Ultra-Fast Groq LPU Chat Completion
   */
  async callGroq({ messages, systemPrompt = SYSTEM_PROMPT, temperature = 0.2, maxTokens = 2500 }) {
    if (!this.isLiveAIConfigured()) {
      throw new Error('GROQ_API_KEY is not configured in .env (Get one free at https://console.groq.com/keys)');
    }

    const payloadMessages = [];
    if (systemPrompt) {
      payloadMessages.push({ role: 'system', content: systemPrompt });
    }
    payloadMessages.push(...messages);

    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        messages: payloadMessages,
        temperature,
        max_tokens: maxTokens,
        stream: false
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Groq API error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    return content.trim();
  }

  /**
   * Autonomous code reasoning: Ask Groq to diagnose failure and synthesize clean source patch
   */
  async synthesizeFix({ brokenCode, errorOutput, testCode, targetFile, language }) {
    const prompt = `You are CI-Doctor, an elite autonomous software engineer.
A test runner failed with the following traceback/error:
================ TEST FAILURE OUTPUT ================
${errorOutput}
=====================================================

Target File: ${targetFile} (${language})
================ ORIGINAL CODE =====================
${brokenCode}
====================================================

${testCode ? `================ TEST CODE =========================\n${testCode}\n====================================================` : ''}

Task:
1. Identify the exact root cause of the error.
2. Produce the entire corrected file content for '${targetFile}'.
3. CRITICAL RULE: Return ONLY the exact raw source code for '${targetFile}'. Do not enclose in markdown code blocks like \`\`\` or include conversational explanations. The entire response will be written directly to the file.`;

    const rawResponse = await this.callGroq({
      messages: [{ role: 'user', content: prompt }]
    });

    return this.stripCodeFences(rawResponse);
  }

  /**
   * Autonomous ReAct reflection: Feed sandbox test failure back to Groq for self-correction
   */
  async reflectAndFix({ brokenCode, previousAttempt, failureOutput, testCode, targetFile, language }) {
    const prompt = `You are CI-Doctor in an Autonomous Reflection Loop.
Your previous patch attempt still caused a failure in the sandbox!

================ PREVIOUS ATTEMPT ==================
${previousAttempt}
================ SANDBOX FAILURE ERROR =============
${failureOutput}
====================================================

Target File: ${targetFile} (${language})
${testCode ? `================ TEST CODE =========================\n${testCode}\n====================================================` : ''}

Reflect on why the previous attempt failed and generate the revised, fully-passing code.
CRITICAL RULE: Return ONLY the raw source code for '${targetFile}'. No backticks, no explanations.`;

    const rawResponse = await this.callGroq({
      messages: [{ role: 'user', content: prompt }]
    });

    return this.stripCodeFences(rawResponse);
  }

  /**
   * Autonomous QA: Synthesize high-coverage unit tests for source code
   */
  async synthesizeTests({ sourceCode, targetFile, language, importsHint = '' }) {
    const prompt = `You are CI-Doctor, an elite autonomous QA and test engineer.
You are inspecting the following source code in '${targetFile}' (${language}):

================ SOURCE CODE ====================
${sourceCode}
================================================

Task:
1. Synthesize a comprehensive, high-coverage, executable unit test suite for '${targetFile}'.
2. If language is Python: use pytest or unittest. Import functions/classes appropriately from '${targetFile.replace(/\\/g, '/')}'.
3. If language is Node.js/JavaScript: use standard node:test, assert, or Jest syntax.
4. Cover standard behavior, edge cases, zero-division or null inputs, and boundary checks.
5. CRITICAL RULE: Return ONLY the exact runnable test code. Do not include markdown code block backticks or conversational explanations.`;

    const rawResponse = await this.callGroq({
      messages: [{ role: 'user', content: prompt }]
    });

    return this.stripCodeFences(rawResponse);
  }

  stripCodeFences(code) {
    if (!code) return '';
    let cleaned = code.trim();
    if (cleaned.startsWith('```')) {
      const firstLineEnd = cleaned.indexOf('\n');
      if (firstLineEnd !== -1) {
        cleaned = cleaned.substring(firstLineEnd + 1);
      }
      if (cleaned.endsWith('```')) {
        cleaned = cleaned.substring(0, cleaned.length - 3);
      }
    }
    return cleaned.trim();
  }
}

export const llmProvider = new LLMProvider();
