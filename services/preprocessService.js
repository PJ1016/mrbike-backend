const { extractCleanAddress } = require('./addressExtractor');

const preprocessOCRData = (aadhaarText, aadhaarBackText, panText) => {
  // Clean OCR noise from text
  const cleanText = (text) => {
    if (!text) return '';
    
    return text
      // Remove special characters except letters, numbers, commas, spaces, forward slashes
      .replace(/[^\w\s,\/\-]/g, ' ')
      // Remove repeated spaces
      .replace(/\s+/g, ' ')
      // Split into lines and clean each line
      .split('\n')
      .map(line => line.trim())
      // Remove empty lines
      .filter(line => line.length > 0)
      // Remove useless government lines
      .filter(line => !isUselessLine(line))
      // Remove duplicate lines
      .filter((line, index, arr) => arr.indexOf(line) === index)
      .join('\n')
      .trim();
  };

  // Check if line contains useless government text
  const isUselessLine = (line) => {
    const uselessPatterns = [
      /government\s+of\s+india/i,
      /unique\s+identification\s+authority/i,
      /help@uidai/i,
      /www\.uidai/i,
      /uidai\.gov\.in/i,
      /income\s+tax\s+department/i,
      /permanent\s+account\s+number/i,
      /signature/i,
      /thumb\s+impression/i,
      /^[*\-=]+$/,
      /^\s*$/ // Empty or whitespace only
    ];
    
    return uselessPatterns.some(pattern => pattern.test(line));
  };

  // Extract Aadhaar number
  const extractAadhaarNumber = (text) => {
    if (!text) return null;
    const match = text.match(/\d{4}\s?\d{4}\s?\d{4}/);
    return match ? match[0].replace(/\s/g, '') : null;
  };

  // Extract PAN number
  const extractPANNumber = (text) => {
    if (!text) return null;
    const match = text.match(/[A-Z]{5}[0-9]{4}[A-Z]{1}/);
    return match ? match[0] : null;
  };

  // Extract DOB
  const extractDOB = (text) => {
    if (!text) return null;
    const match = text.match(/\d{2}\/\d{2}\/\d{4}/);
    return match ? match[0] : null;
  };

  // Extract clean address from Aadhaar back
  const extractCleanAddressLocal = (backText) => {
    return extractCleanAddress(backText);
  };

  // Clean all texts
  const cleanAadhaarText = cleanText(aadhaarText);
  const cleanAadhaarBackText = cleanText(aadhaarBackText);
  const cleanPanText = cleanText(panText);

  // Extract structured data
  const aadhaarNumber = extractAadhaarNumber(cleanAadhaarText + ' ' + cleanAadhaarBackText);
  const panNumber = extractPANNumber(cleanPanText);
  const dob = extractDOB(cleanAadhaarText + ' ' + cleanPanText);
  const cleanAddress = extractCleanAddressLocal(cleanAadhaarBackText);

  // Build structured input for GPT
  const structuredInput = `
Name candidates:
${cleanAadhaarText}

PAN details:
${cleanPanText}

Address:
${cleanAddress || 'Not found'}

Extracted values:
Aadhaar: ${aadhaarNumber || 'Not found'}
PAN: ${panNumber || 'Not found'}
DOB: ${dob || 'Not found'}
`.trim();

  return {
    structuredInput,
    aadhaarNumber,
    panNumber,
    dob,
    cleanAddress
  };
};

module.exports = {
  preprocessOCRData
};