import { SYSTEM_PROMPT } from './prompts.js';

export class LLMProvider {
  constructor() {
    this.apiKey = process.env.GROQ_API_KEY || '';
    // Available verified chat models on Groq LPU
    this.model = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
    this.endpoint = 'https://api.groq.com/openai/v1/chat/completions';
  }

  isLiveAIConfigured() {
    this.apiKey = process.env.GROQ_API_KEY || '';
    return Boolean(this.apiKey);
  }

  /**
   * Ultra-Fast Groq LPU Chat Completion with Resilient Model Fallbacks
   */
  async callGroq({ messages, systemPrompt = SYSTEM_PROMPT, temperature = 0.2, maxTokens = 2500, model = null }) {
    if (!this.isLiveAIConfigured()) {
      throw new Error('GROQ_API_KEY is not configured in .env (Get one free at https://console.groq.com/keys)');
    }

    const payloadMessages = [];
    if (systemPrompt) {
      payloadMessages.push({ role: 'system', content: systemPrompt });
    }
    payloadMessages.push(...messages);

    const targetModel = model || this.model || 'openai/gpt-oss-120b';

    const tryCall = async (modelToUse) => {
      return await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: modelToUse,
          messages: payloadMessages,
          temperature,
          max_tokens: maxTokens,
          stream: false
        })
      });
    };

    let response = await tryCall(targetModel);

    // If target model returns error, resiliently fall back to verified models on Groq
    if (!response.ok && targetModel !== 'openai/gpt-oss-120b') {
      console.warn(`[LLMProvider] Model '${targetModel}' returned ${response.status}. Falling back to 'openai/gpt-oss-120b'...`);
      this.model = 'openai/gpt-oss-120b';
      response = await tryCall('openai/gpt-oss-120b');
    }
    if (!response.ok && targetModel !== 'qwen/qwen3.8-27b') {
      console.warn(`[LLMProvider] Falling back to 'qwen/qwen3.8-27b'...`);
      this.model = 'qwen/qwen3.8-27b';
      response = await tryCall('qwen/qwen3.8-27b');
    }

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

  /**
   * Autonomous Deep Code File Audit & Repair:
   * Inspects a code file for logic bugs, runtime errors, boundary flaws, null safety, or edge cases.
   * If an issue is found, provides a diagnosis and the complete corrected source code.
   */
  async auditAndFixFile({ filePath, content, language }) {
    const prompt = `You are CI-Doctor, an elite autonomous software auditor, compiler engineer, and bug repair expert.
Perform a thorough semantic and AST analysis on the following source code file:

File: ${filePath} (${language})
==================== SOURCE CODE ====================
${content}
=====================================================

Task:
1. Carefully audit this code for real bugs, including:
   - Logic bugs, algorithmic mistakes, inverted conditions, off-by-one errors
   - Potential runtime exceptions: NullPointerExceptions, undefined dereferences, array index out of bounds, division by zero, integer overflow
   - Missing input validation or boundary edge case handling (e.g. null inputs, empty arrays, length < 2)
   - Resource leaks (unclosed streams, file handles)
   - Syntax or compilation issues
2. If any bug, edge-case vulnerability, or runtime defect is found:
   - Identify the exact root cause.
   - Produce the complete, robust, corrected source code for '${filePath}'.
3. Format your response strictly as JSON with this exact schema:
{
  "hasBugs": true,
  "bugType": "logic_bug" | "null_safety" | "boundary_edge_case" | "runtime_exception" | "integer_overflow" | "syntax_error",
  "summary": "Brief 1-line summary of the bug",
  "explanation": "Detailed explanation of the issue, root cause, and how it is resolved",
  "affectedScope": "Function name or line numbers",
  "fixedContent": "... COMPLETE CORRECTED RAW CODE FOR THE ENTIRE FILE ..."
}

If the file is already bug-free and robust:
{
  "hasBugs": false,
  "bugType": "none",
  "summary": "Code is clean with no logic or runtime errors.",
  "explanation": "Code correctly handles boundaries and runtime contracts.",
  "affectedScope": "",
  "fixedContent": null
}

CRITICAL RULES:
- Respond ONLY with the raw JSON object.
- Do NOT wrap in markdown backticks or include conversational filler.
- The 'fixedContent' must be the complete raw source code for the file ready to be saved to disk.`;

    const rawResponse = await this.callGroq({
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1
    });

    return this.parseAuditJson(rawResponse);
  }

  parseAuditJson(raw) {
    if (!raw) return { hasBugs: false, summary: 'No response' };
    let cleaned = raw.trim();
    if (cleaned.startsWith('```')) {
      const firstLineEnd = cleaned.indexOf('\n');
      if (firstLineEnd !== -1) cleaned = cleaned.substring(firstLineEnd + 1);
      if (cleaned.endsWith('```')) cleaned = cleaned.substring(0, cleaned.length - 3);
      cleaned = cleaned.trim();
    }

    try {
      return JSON.parse(cleaned);
    } catch (e) {
      // Robust fallback extraction if JSON string formatting has raw newlines
      const hasBugsMatch = cleaned.match(/"hasBugs"\s*:\s*(true|false)/i);
      const hasBugs = hasBugsMatch ? hasBugsMatch[1].toLowerCase() === 'true' : false;
      if (!hasBugs) return { hasBugs: false, summary: 'Code verified clean' };

      const bugTypeMatch = cleaned.match(/"bugType"\s*:\s*"([^"]+)"/);
      const summaryMatch = cleaned.match(/"summary"\s*:\s*"([^"]+)"/);
      const explanationMatch = cleaned.match(/"explanation"\s*:\s*"([^"]+)"/);
      const affectedScopeMatch = cleaned.match(/"affectedScope"\s*:\s*"([^"]+)"/);

      let fixedContent = null;
      const marker = '"fixedContent":';
      const idx = cleaned.indexOf(marker);
      if (idx !== -1) {
        let part = cleaned.substring(idx + marker.length).trim();
        if (part.startsWith('"')) part = part.substring(1);
        const lastQuote = part.lastIndexOf('"');
        if (lastQuote !== -1) part = part.substring(0, lastQuote);
        fixedContent = part.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
      }

      return {
        hasBugs: true,
        bugType: bugTypeMatch ? bugTypeMatch[1] : 'logic_bug',
        summary: summaryMatch ? summaryMatch[1] : 'Code defect detected',
        explanation: explanationMatch ? explanationMatch[1] : 'Autonomous repair synthesized',
        affectedScope: affectedScopeMatch ? affectedScopeMatch[1] : '',
        fixedContent
      };
    }
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
