import type { InputMessage, OutputInterface } from "@plaios/core/domain";

/** Tells the model where the reply goes and how that destination wants it formatted. */
export function addDeliveryContext(message: InputMessage, output: OutputInterface): InputMessage {
  const metadata = { ...message.metadata, deliveryOutputChannel: output.channel, ...(output.instructions ? { instructions: output.instructions } : {}) };
  if (output.channel === message.channel) return { ...message, metadata };
  return {
    ...message,
    text: [
      message.text,
      "Delivery context:",
      `PLAIOS will deliver your final response to the ${output.channel} output.`,
      "Write the exact content intended for that destination. Do not claim that delivery requires a tool or is unavailable.",
    ].join("\n\n"),
    metadata,
  };
}
