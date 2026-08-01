/**
 * @file backend/src/quantix/agents/analyticalThinker.js
 * @description Base Specialist Agent for Cognitive Mesh.
 */
import logger from '../../utils/logger.js';

export class AnalyticalThinker {
  constructor({
    client,
    modelName = 'gpt-4o',
    name = 'AnalyticalThinker',
    capabilities = ['deductive_reasoning', 'generic_math'],
    logger: appLogger = logger
  }) {
    if (!client) {
      throw new Error(`[AnalyticalThinker] Agent '${name}' requires an LLM client.`);
    }
    this.client = client;
    this.modelName = modelName;
    this.name = name;
    this.capabilities = capabilities;
    this.logger = appLogger;
  }

  async think(task, context = {}) {
    const taskPrompt = typeof task === 'string' ? task : (task.prompt || task.name || JSON.stringify(task));
    const problemGoal = context.problem?.goal?.statement || context.problem?.naturalText || 'Solve mathematical problem';

    this.logger.info(`[${this.name}] Executing task: "${taskPrompt.slice(0, 80)}..."`);

    const systemPrompt = `You are ${this.name}, a mathematical specialist in NeuroSyn-Math.
Capabilities: ${this.capabilities.join(', ')}
Goal: ${problemGoal}

Provide rigorous, step-by-step mathematical reasoning. Use LaTeX for math equations.`;

    const userPrompt = `Task: ${taskPrompt}\n\nContext:\n${JSON.stringify(context.taskResults || context.worldModel || {})}`;

    try {
      const response = await this.client.chat.completions.create({
        model: this.modelName,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.1
      });

      const content = response.choices[0].message.content;
      return {
        agent: this.name,
        capabilities: this.capabilities,
        content,
        proofSteps: [content]
      };
    } catch (err) {
      this.logger.error(`[${this.name}] Execution error: ${err.message}`);
      throw err;
    }
  }
}
