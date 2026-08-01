/**
 * @file src/quantix/perception/problemParser.js
 * @description NeuroSyn Problem Perception Engine with Fast Pattern Matching & Safe Micro-LLM Extraction.
 */
import logger from '../../utils/logger.js';
import clients, { getModelForRole } from '../../config/clients.js';

export const MATHEMATICAL_DOMAINS = [
  'Algebra', 'Number Theory', 'Geometry', 'Calculus', 'Analysis', 'Topology',
  'Logic', 'Combinatorics', 'Graph Theory', 'Probability', 'Optimization',
  'Category Theory', 'Set Theory', 'Linear Algebra', 'Differential Equations'
];

export class ProblemParser {
  constructor({ client, logger: appLogger = logger, model } = {}) {
    this.logger = appLogger;
    this.model = model || getModelForRole('fast_parser') || 'gpt-4o-mini';

    if (this.model.includes('deepseek-r1') || this.model.includes('qwq') || this.model.includes('qwen')) {
      this.client = clients.ollama || clients.deepseek || client;
    } else {
      this.client = client || clients.openai;
    }
  }

  async parse(rawProblem) {
    this.logger.info(`[NeuroSyn-Math Parser] Ingesting prompt on model "${this.model}"...`);

    // ⚡ INSTANT FAST-PATH: Instant Regex (<1ms)
    const fastParsed = this._fastRuleBasedParse(rawProblem);
    if (fastParsed) {
      this.logger.info(`[NeuroSyn-Math Parser] Fast-path pattern match succeeded. Skipping LLM parsing delay.`);
      return fastParsed;
    }

    // ⚡ SUB-SECOND FALLBACK: Micro-call capped at 20 tokens to guarantee speed
    const systemPrompt = `You are a mathematical domain classifier. Respond ONLY with a single JSON object: {"primaryDomain": "DomainName"}. Options: Number Theory, Algebra, Geometry, Combinatorics, Calculus, Logic, Analysis. Do not include reasoning tags or markdown.`;
    const userPrompt = `Classify this prompt:\n"""\n${rawProblem.slice(0, 300)}\n"""`;

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.0,
        max_tokens: 20
      });

      const rawContent = response.choices[0].message.content;
      const parsed = this._extractAndParseJson(rawContent, rawProblem);
      return this._buildWorldModel(rawProblem, parsed);

    } catch (error) {
      this.logger.warn(`[NeuroSyn-Math Parser] API Fallback activated: ${error.message}`);
      return this._fallbackStructuredProblem(rawProblem, error.message);
    }
  }

  _fastRuleBasedParse(rawProblem) {
    const text = rawProblem.toLowerCase();
    const domains = [];

    if (/prime|mod|mersenne|divisib|gcd|lcm|congruen|diophantine/i.test(text)) domains.push('Number Theory');
    if (/group|ring|field|polynomial|matrix|vector|equation/i.test(text)) domains.push('Algebra');
    if (/graph|vertex|edge|tree|combinator|permutation/i.test(text)) domains.push('Combinatorics');
    if (/triangle|circle|geometry|angle|point/i.test(text)) domains.push('Geometry');

    if (domains.length === 0) return null;

    return {
      rawText: rawProblem,
      domains: domains,
      primaryDomain: domains[0],
      type: 'theorem-proof',
      formalRepresentation: { latex: rawProblem, quantifiers: [], lean4Signature: '' },
      objects: [],
      constraints: { knownAssumptions: [], allowedRules: [], forbiddenAssumptions: [], intermediateGoals: [] },
      goal: { statement: rawProblem, targetType: 'proof', leanGoal: '' },
      worldModel: { objects: [], relations: [] }
    };
  }

  _extractAndParseJson(rawContent, rawProblem) {
    if (!rawContent) return this._createFallbackObject(rawProblem);

    let cleaned = rawContent.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    cleaned = cleaned.replace(/```json/gi, '').replace(/```/g, '').trim();

    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');

    if (start === -1 || end === -1 || start >= end) {
      return this._createFallbackObject(rawProblem);
    }

    try {
      return JSON.parse(cleaned.substring(start, end + 1));
    } catch (err) {
      return this._createFallbackObject(rawProblem);
    }
  }

  _createFallbackObject(rawProblem) {
    return {
      domains: ['Number Theory', 'Algebra'],
      primaryDomain: 'Number Theory',
      theoremType: 'theorem-proof',
      formalRepresentation: { latex: rawProblem, quantifiers: [], lean4Signature: '' },
      constraints: { knownAssumptions: [], allowedRules: [], forbiddenAssumptions: [], intermediateGoals: [] },
      goal: { statement: rawProblem, targetType: 'proof' }
    };
  }

  _buildWorldModel(rawProblem, parsed) {
    const primaryDomain = parsed.primaryDomain || parsed.domains?.[0] || 'Number Theory';
    return {
      rawText: rawProblem,
      domains: [primaryDomain],
      primaryDomain: primaryDomain,
      type: parsed.theoremType || 'theorem-proof',
      formalRepresentation: {
        latex: parsed.formalRepresentation?.latex || rawProblem,
        quantifiers: parsed.formalRepresentation?.quantifiers || [],
        lean4Signature: parsed.formalRepresentation?.lean4Signature || ''
      },
      objects: parsed.objects || [],
      constraints: {
        knownAssumptions: parsed.constraints?.knownAssumptions || [],
        allowedRules: parsed.constraints?.allowedRules || [],
        forbiddenAssumptions: parsed.constraints?.forbiddenAssumptions || [],
        intermediateGoals: parsed.constraints?.intermediateGoals || []
      },
      goal: {
        statement: parsed.goal?.statement || rawProblem,
        targetType: parsed.goal?.targetType || 'proof',
        leanGoal: parsed.goal?.leanGoal || ''
      },
      worldModel: { objects: parsed.objects || [], relations: parsed.relations || [] }
    };
  }

  createPerceptionPrompt() {
    return `{"primaryDomain": "Number Theory"}`;
  }

  _fallbackStructuredProblem(rawProblem, err) {
    return { ...this._createFallbackObject(rawProblem), error: err };
  }
}