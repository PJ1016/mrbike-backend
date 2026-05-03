const { DocumentAnalysisClient, AzureKeyCredential } = require('@azure/ai-form-recognizer');

const client = new DocumentAnalysisClient(
  process.env.AZURE_FORM_RECOGNIZER_ENDPOINT,
  new AzureKeyCredential(process.env.AZURE_FORM_RECOGNIZER_KEY)
);

const extractText = async (fileBuffer) => {
  try {
    const poller = await client.beginAnalyzeDocument('prebuilt-document', fileBuffer);
    const result = await poller.pollUntilDone();
    
    return result.content;
  } catch (error) {
    console.error('OCR extraction error:', error);
    throw error;
  }
};

module.exports = {
  extractText
};