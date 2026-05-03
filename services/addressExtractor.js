const extractCleanAddress = (aadhaarBackText) => {
  if (!aadhaarBackText || typeof aadhaarBackText !== 'string') {
    return '';
  }

  let text = aadhaarBackText;

  // Step 1: Find the "Address:" section (case insensitive)
  const addressMatch = text.match(/address[:\s]*(.*)/is);
  if (addressMatch) {
    text = addressMatch[1];
  } else {
    // If no "Address:" found, use the entire text but be more selective
    text = aadhaarBackText;
  }

  // Step 2: Split into lines for processing
  let lines = text.split(/[\n\r]+/).map(line => line.trim()).filter(line => line.length > 0);

  // Step 3: Stop at first valid 6-digit pincode and collect address lines
  let addressLines = [];
  let pincodeFound = null;

  for (const line of lines) {
    const pincodeMatch = line.match(/\b(\d{6})\b/);
    
    if (pincodeMatch) {
      pincodeFound = pincodeMatch[1];
      // Include the line but remove the pincode from it
      const lineWithoutPincode = line.replace(/\b\d{6}\b/, '').trim();
      if (lineWithoutPincode && !isUnwantedLine(lineWithoutPincode)) {
        addressLines.push(lineWithoutPincode);
      }
      break;
    }
    
    // Only add line if it's not unwanted
    if (!isUnwantedLine(line)) {
      addressLines.push(line);
    }
  }

  // Step 4: Filter unwanted lines
  function isUnwantedLine(line) {
    const unwantedPatterns = [
      /\b\d{10,12}\b/, // Phone numbers (10-12 digits)
      /\b\d{4}\s?\d{4}\s?\d{4}\b/, // Aadhaar numbers
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/, // Email addresses
      /uidai/i,
      /government/i,
      /help@/i,
      /www\./i,
      /\.gov\./i,
      /unique\s+identification/i,
      /authority/i,
      /signature/i,
      /thumb/i,
      /^[*\-=\s]+$/, // Lines with only special characters
      /^\d+$/, // Lines with only numbers
      /^[a-z]$/i, // Single letters
    ];

    return unwantedPatterns.some(pattern => pattern.test(line));
  }

  // Step 5: Remove duplicate words and clean
  const cleanAddressParts = addressLines
    .join(' ')
    .split(/[,\s]+/) // Split by commas and spaces
    .map(part => part.trim())
    .filter(part => part.length > 0)
    .map(part => cleanSpecialCharacters(part))
    .filter(part => part.length > 0);

  // Remove consecutive duplicates
  const deduplicatedParts = [];
  for (let i = 0; i < cleanAddressParts.length; i++) {
    const current = cleanAddressParts[i].toLowerCase();
    const previous = i > 0 ? cleanAddressParts[i - 1].toLowerCase() : '';
    
    if (current !== previous) {
      deduplicatedParts.push(cleanAddressParts[i]);
    }
  }

  // Step 6: Clean special characters and noise
  function cleanSpecialCharacters(text) {
    return text
      .replace(/[^\w\s\-\/]/g, '') // Keep only letters, numbers, spaces, hyphens, slashes
      .replace(/\s+/g, ' ') // Normalize spaces
      .trim();
  }

  // Step 7: Join with proper formatting
  let finalAddress = deduplicatedParts.join(', ');

  // Clean up formatting
  finalAddress = finalAddress
    .replace(/,\s*,/g, ',') // Remove double commas
    .replace(/^,\s*|,\s*$/g, '') // Remove leading/trailing commas
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim();

  // Add pincode at the end if found
  if (pincodeFound && !finalAddress.includes(pincodeFound)) {
    finalAddress = finalAddress ? `${finalAddress}, ${pincodeFound}` : pincodeFound;
  }

  // Validate final address (should have some meaningful content)
  if (finalAddress.length < 10 || /^\d+$/.test(finalAddress)) {
    return '';
  }

  return finalAddress;
};

module.exports = {
  extractCleanAddress
};