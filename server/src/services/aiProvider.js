const OpenAI = require('openai');

class AIProvider {
  constructor() {
    if (this.constructor === AIProvider) {
      throw new Error("Abstract class AIProvider cannot be instantiated directly");
    }
  }

  async generateChat(messages, tools, signal) {
    throw new Error("Method 'generateChat()' must be implemented.");
  }
}

class DeepSeekAdapter extends AIProvider {
  constructor(apiKey) {
    super();
    this.client = new OpenAI({
      baseURL: 'https://api.deepseek.com',
      apiKey: apiKey || 'disabled'
    });
    this.modelName = 'deepseek-v4-flash';
  }

  async generateChat(messages, tools, signal) {
    return await this.client.chat.completions.create({
      model: this.modelName,
      messages: messages,
      tools: tools,
      tool_choice: 'auto'
    }, { signal });
  }
}

module.exports = { AIProvider, DeepSeekAdapter };
