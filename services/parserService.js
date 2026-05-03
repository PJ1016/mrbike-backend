const { OpenAI } = require('openai');

const client = new OpenAI({
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  baseURL: `${process.env.AZURE_OPENAI_ENDPOINT}openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT_NAME}`,
  defaultQuery: { 'api-version': '2025-01-01-preview' },
  defaultHeaders: {
    'api-key': process.env.AZURE_OPENAI_API_KEY,
  },
});

const parseDocument = async (text, documentType = 'Combined Documents') => {
  const prompt = `
You are an expert at extracting information from Indian government documents (Aadhaar, PAN cards) and bank documents (passbooks).

DOCUMENTS PROVIDED: ${documentType}

The OCR text below may contain:
- Mixed English and regional language text
- OCR errors and noise
- Special characters and symbols
- Duplicate information
- HELPLINE NUMBERS (like 1800 300 1947 or 1947) - DO NOT extract these as account numbers

EXTRACT the following information and return ONLY a valid JSON object:

{
  "name": "",
  "aadhaarNumber": "",
  "panNumber": "",
  "dob": "",
  "accountNumber": "",
  "ifscCode": "",
  "bankName": "",
  "accountHolderName": ""
}

RULES:
1. Name: Extract the person's full name (ignore S/O, D/O, W/O prefixes)
2. Aadhaar: Find exactly 12 digits (format: XXXX XXXX XXXX). Only extract if Aadhaar is in provided documents.
3. PAN: Find 10 characters (format: ABCDE1234F). Only extract if PAN is in provided documents.
4. DOB: Find date in DD/MM/YYYY or DD-MM-YYYY format
5. Account Number: Extract bank account number (usually 9-18 digits). ONLY extract if 'Bank Passbook' is in the provided documents list.
6. IFSC Code: Extract IFSC code (format: ABCD0123456). ONLY extract if 'Bank Passbook' is in the provided documents list.
7. Bank Name: Extract bank name from passbook. ONLY extract if 'Bank Passbook' is in the provided documents list.
8. Account Holder Name: Extract account holder name from bank document. ONLY extract if 'Bank Passbook' is in the provided documents list.

IMPORTANT:
- Ignore OCR noise like random symbols
- Skip government boilerplate text
- DO NOT hallucinate bank details from Aadhaar or PAN cards. Aadhaar cards often contain the helpline "1947" or "1800 300 1947" - IGNORE THESE.
- If information is not clearly found or the corresponding document was not provided, leave the field empty ("")
- Return ONLY the JSON object, no other text

OCR TEXT:
${text}
`;

  try {
    const res = await client.chat.completions.create({
      model: process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 800,
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(res.choices[0].message.content);
    
    // Clean and validate the result
    return {
      name: cleanName(result.name || ''),
      aadhaarNumber: validateAadhaar(result.aadhaarNumber || ''),
      panNumber: validatePAN(result.panNumber || ''),
      dob: validateDOB(result.dob || ''),
      accountNumber: validateAccountNumber(result.accountNumber || ''),
      ifscCode: validateIFSC(result.ifscCode || ''),
      bankName: cleanBankName(result.bankName || ''),
      accountHolderName: cleanName(result.accountHolderName || '')
    };
  } catch (error) {
    console.error('Azure OpenAI parsing error:', error);
    // Fallback to regex parser
    return fallbackParser(text, documentType);
  }
};

// Validation and cleaning functions
const cleanName = (name) => {
  if (!name) return '';
  return name
    .replace(/\b(S\/O|D\/O|W\/O|Father|Mother|Husband)\b/gi, '')
    .replace(/[^a-zA-Z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
};

const validateAadhaar = (aadhaar) => {
  if (!aadhaar) return '';
  const cleaned = aadhaar.replace(/\D/g, '');
  return cleaned.length === 12 ? cleaned : '';
};

const validatePAN = (pan) => {
  if (!pan) return '';
  const cleaned = pan.replace(/\s/g, '').toUpperCase();
  return /^[A-Z]{5}\d{4}[A-Z]$/.test(cleaned) ? cleaned : '';
};

const validateDOB = (dob) => {
  if (!dob) return '';
  const match = dob.match(/(\d{2})[\/-](\d{2})[\/-](\d{4})/);
  return match ? `${match[1]}/${match[2]}/${match[3]}` : '';
};

const validatePincode = (pincode) => {
  if (!pincode) return '';
  const cleaned = pincode.replace(/\D/g, '');
  return cleaned.length === 6 ? cleaned : '';
};

const validateAccountNumber = (accountNumber) => {
  if (!accountNumber) return '';
  const cleaned = accountNumber.replace(/\D/g, '');
  // Ignore known helpline numbers (like 1947 or numbers ending in 1947)
  if (cleaned.includes('1947') || cleaned === '18003001947') return '';
  return cleaned.length >= 9 && cleaned.length <= 18 ? cleaned : '';
};

const validateIFSC = (ifsc) => {
  if (!ifsc) return '';
  const cleaned = ifsc.replace(/\s/g, '').toUpperCase();
  return /^[A-Z]{4}0[A-Z0-9]{6}$/.test(cleaned) ? cleaned : '';
};

const cleanBankName = (bankName) => {
  if (!bankName) return '';
  return bankName
    .replace(/\b(Bank|Ltd|Limited|Pvt|Private)\b/gi, '')
    .replace(/[^a-zA-Z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
};

const cleanAddress = (address) => {
  if (!address) return '';
  return address
    .replace(/\b(S\/O|D\/O|W\/O|Government|UIDAI|help@|www\.)\b/gi, '')
    .replace(/\b\d{10,}\b/g, '') // Remove long numbers
    .replace(/[^a-zA-Z0-9\s,\/-]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/,\s*,/g, ',')
    .trim();
};

const fallbackParser = (text, documentType = '') => {
  const data = {
    name: '',
    aadhaarNumber: '',
    panNumber: '',
    dob: '',
    accountNumber: '',
    ifscCode: '',
    bankName: '',
    accountHolderName: ''
  };
  
  if (!text) return data;
  
  const isBankProvided = documentType.includes('Bank Passbook');
  const isAadhaarProvided = documentType.includes('Aadhaar');
  const isPANProvided = documentType.includes('PAN');

  // Extract name
  const namePatterns = [
    /(?:Name[:\s]*|^)([A-Z][a-zA-Z\s]{2,30})(?:\s*(?:DOB|Date|S\/O|D\/O|W\/O|\d{2}\/\d{2}\/\d{4}))/i,
    /^([A-Z][A-Z\s]{5,30})(?:\s*S\/O)/i,
    /([A-Z]{2,}\s+[A-Z]{2,}(?:\s+[A-Z]{2,})?)/
  ];
  
  for (const pattern of namePatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      data.name = cleanName(match[1]);
      break;
    }
  }
  
  // Extract Aadhaar number
  if (isAadhaarProvided) {
    const aadhaarMatch = text.match(/\b(\d{4})\s?(\d{4})\s?(\d{4})\b/);
    if (aadhaarMatch) {
      data.aadhaarNumber = aadhaarMatch[1] + aadhaarMatch[2] + aadhaarMatch[3];
    }
  }
  
  // Extract PAN number
  if (isPANProvided) {
    const panMatch = text.match(/\b([A-Z]{5}\d{4}[A-Z])\b/);
    if (panMatch) {
      data.panNumber = panMatch[1];
    }
  }
  
  // Extract DOB
  const dobMatch = text.match(/\b(\d{2}[\/\-]\d{2}[\/\-]\d{4})\b/);
  if (dobMatch) {
    data.dob = dobMatch[1].replace(/-/g, '/');
  }
  
  // Extract Account Number (Only if bank document provided)
  if (isBankProvided) {
    const accountMatch = text.match(/\b(\d{9,18})\b/);
    if (accountMatch) {
      const accNum = accountMatch[1];
      if (!accNum.includes('1947')) {
        data.accountNumber = accNum;
      }
    }
  }
  
  // Extract IFSC Code (Only if bank document provided)
  if (isBankProvided) {
    const ifscMatch = text.match(/\b([A-Z]{4}0[A-Z0-9]{6})\b/);
    if (ifscMatch) {
      data.ifscCode = ifscMatch[1];
    }
  }
  
  // Extract Bank Name (Only if bank document provided)
  if (isBankProvided) {
    const bankPatterns = [
      /\b(State Bank|HDFC|ICICI|Axis|Punjab National|Bank of Baroda|Canara Bank|Union Bank|Indian Bank)\b/i,
      /\b([A-Z][a-z]+\s+Bank)\b/i
    ];
    
    for (const pattern of bankPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        data.bankName = cleanBankName(match[1]);
        break;
      }
    }
  }
  
  return data;
};

const parseDocuments = async (extractedTexts) => {
  const parsedData = {};
  
  if (extractedTexts.aadhaarFront) {
    parsedData.aadhaarFront = await parseDocument(extractedTexts.aadhaarFront, 'Aadhaar Front');
  }
  
  if (extractedTexts.aadhaarBack) {
    parsedData.aadhaarBack = await parseDocument(extractedTexts.aadhaarBack, 'Aadhaar Back');
  }
  
  if (extractedTexts.pan) {
    parsedData.pan = await parseDocument(extractedTexts.pan, 'PAN Card');
  }
  
  return parsedData;
};

module.exports = {
  parseDocument,
  parseDocuments
};