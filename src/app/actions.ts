"use server";

import { generateTradingSignals, type GenerateTradingSignalsInput, type GenerateTradingSignalsOutput } from "@/ai/flows/generate-trading-signals";

export async function handleGenerateSignalsAction(
  input: GenerateTradingSignalsInput
): Promise<GenerateTradingSignalsOutput> {
  try {
    const result = await generateTradingSignals(input);
    if (!result || !result.signals || !result.explanation) {
      throw new Error("AI flow returned an invalid or empty response.");
    }
    return result;
  } catch (error) {
    console.error("Error in handleGenerateSignalsAction:", error);
    // Re-throw a generic error or a more specific one if possible
    // This ensures that the client gets an error object that can be handled.
    if (error instanceof Error) {
      throw new Error(`Failed to generate trading signals: ${error.message}`);
    }
    throw new Error("An unknown error occurred while generating trading signals.");
  }
}
