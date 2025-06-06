import { logger } from "../config";
import { getLLMProvider } from "../llm-provider";
import * as deepseek from "../deepseek";

/**
 * Checks the current LLM provider status in detail
 */
export async function checkProviderDetailed(): Promise<Record<string, unknown>> {
  logger.info("Checking LLM provider status in detail");
  
  // Get environment variables and force read from process.env
  const apiKey = process.env.DEEPSEEK_API_KEY || "";
  
  // Log API key details for debugging
  logger.info(`DEEPSEEK_API_KEY in environment: ${apiKey ? `Present (length: ${apiKey.length})` : "Not present"}`);
  logger.info(`DEEPSEEK_API_KEY first 5 chars: ${apiKey ? apiKey.substring(0, 5) : "N/A"}`);
  
  const envVars = {
    SUGGESTION_MODEL: process.env.SUGGESTION_MODEL,
    SUGGESTION_PROVIDER: process.env.SUGGESTION_PROVIDER,
    EMBEDDING_PROVIDER: process.env.EMBEDDING_PROVIDER,
    DEEPSEEK_API_KEY: apiKey ? `Set (length: ${apiKey.length})` : "Not set",
    DEEPSEEK_API_URL: process.env.DEEPSEEK_API_URL || "https://api.deepseek.com/chat/completions",
    OLLAMA_HOST: process.env.OLLAMA_HOST,
  };
  
  // Get global variables
  const globals = {
    CURRENT_SUGGESTION_MODEL: global.CURRENT_SUGGESTION_MODEL,
    CURRENT_SUGGESTION_PROVIDER: global.CURRENT_SUGGESTION_PROVIDER,
    CURRENT_EMBEDDING_PROVIDER: global.CURRENT_EMBEDDING_PROVIDER,
  };
  
  // Test provider connection
  let connectionStatus = "Unknown";
  let hasApiKey = false;
  let apiKeyConfigured = false;
  
  // First, explicitly check and set the DeepSeek API key
  try {
    const keyConfigured = await deepseek.checkDeepSeekApiKey();
    if (keyConfigured) {
      hasApiKey = true;
      apiKeyConfigured = true;
      // Re-read the key from environment after it's been set by checkDeepSeekApiKey
      const apiKey = process.env.DEEPSEEK_API_KEY || "";
      logger.info(`DeepSeek API key is available with length: ${apiKey.length}`);
    } else {
      logger.warn("DeepSeek API key configuration failed");
    }
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error(`Error checking DeepSeek API key: ${err.message}`);
  }
  
  try {
    // First try direct DeepSeek connection test which is known to work
    if (global.CURRENT_SUGGESTION_PROVIDER === 'deepseek' || process.env.SUGGESTION_PROVIDER === 'deepseek') {
      logger.info("Testing DeepSeek connection directly");
      const connected = await deepseek.testDeepSeekConnection();
      connectionStatus = connected ? "Connected" : "Failed";
      
      // If direct test succeeded but we still want to check the provider interface
      if (connected) {
        hasApiKey = true;
        apiKeyConfigured = true;
        logger.info("DeepSeek connection test successful");
      } else {
        logger.warn("Direct DeepSeek connection test failed");
      }
    } else {
      // For non-DeepSeek providers, use the standard provider interface
      const provider = await getLLMProvider();
      const connected = await provider.checkConnection();
      connectionStatus = connected ? "Connected" : "Failed";
    }
    
    // If connection failed but we have an API key, log more details
    if (connectionStatus === "Failed" && hasApiKey) {
      logger.warn("Connection failed despite having API key. Check API URL and network connectivity.");
    }
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    connectionStatus = `Error: ${err.message}`;
    logger.error(`Provider connection error: ${err.message}`);
  }
  
  return {
    environment: envVars,
    globals: globals,
    connectionStatus: connectionStatus,
    timestamp: new Date().toISOString(),
    apiUrl: process.env.DEEPSEEK_API_URL || "https://api.deepseek.com/chat/completions",
    model: process.env.SUGGESTION_MODEL || global.CURRENT_SUGGESTION_MODEL || "deepseek-coder",
    hasApiKey: hasApiKey,
    apiKeyConfigured: apiKeyConfigured,
    apiEndpointConfigured: !!process.env.DEEPSEEK_API_URL,
    noteText: `Note: For DeepSeek models, ensure you have set the DEEPSEEK_API_KEY environment variable.
You can also set DEEPSEEK_API_URL to use a custom endpoint (defaults to https://api.deepseek.com/chat/completions).
To set your API key permanently, run: npm run set-deepseek-key YOUR_API_KEY
If you're still having issues, try running 'npm run test:deepseek' to test the DeepSeek connection directly.`
  };
}
