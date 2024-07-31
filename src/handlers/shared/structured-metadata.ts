import { LogReturn } from "@ubiquity-dao/ubiquibot-logger";

function createStructuredMetadata(className: string, logReturn: LogReturn | null) {
  let logMessage, metadata;
  if (logReturn) {
    logMessage = logReturn.logMessage;
    metadata = logReturn.metadata;
  }

  const jsonPretty = JSON.stringify(metadata, null, 2);
  const stackLine = new Error().stack?.split("\n")[2] ?? "";
  const caller = stackLine.match(/at (\S+)/)?.[1] ?? "";
  const ubiquityMetadataHeader = `<!-- Ubiquity - ${className} - ${caller} - ${metadata?.revision}`;

  let metadataSerialized: string;
  const metadataSerializedVisible = ["```json", jsonPretty, "```"].join("\n");
  const metadataSerializedHidden = [ubiquityMetadataHeader, jsonPretty, "-->"].join("\n");

  if (logMessage?.type === "fatal") {
    // if the log message is fatal, then we want to show the metadata
    metadataSerialized = [metadataSerializedVisible, metadataSerializedHidden].join("\n");
  } else {
    // otherwise we want to hide it
    metadataSerialized = metadataSerializedHidden;
  }

  return metadataSerialized;
}

export default {
  create: createStructuredMetadata,
};
