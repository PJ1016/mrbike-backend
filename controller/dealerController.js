const multer = require('multer');
const { extractText } = require('../services/ocrService');
const { parseDocument } = require('../services/parserService');
const { extractCleanAddress } = require('../services/addressExtractor');

const storage = multer.memoryStorage();
const upload = multer({ storage });

const processDealer = [
  upload.fields([
    { name: 'aadhaarFront', maxCount: 1 },
    { name: 'aadhaarBack', maxCount: 1 },
    { name: 'pan', maxCount: 1 },
    { name: 'bankPassbook', maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      const extractedData = {};
      
      // Extract text from files
      if (req.files.aadhaarFront) {
        extractedData.aadhaarFront = await extractText(req.files.aadhaarFront[0].buffer);
      }
      
      if (req.files.aadhaarBack) {
        extractedData.aadhaarBack = await extractText(req.files.aadhaarBack[0].buffer);
      }
      
      if (req.files.pan) {
        extractedData.pan = await extractText(req.files.pan[0].buffer);
      }
      
      if (req.files.bankPassbook) {
        extractedData.bankPassbook = await extractText(req.files.bankPassbook[0].buffer);
      }
      
      // Extract clean address as fallback
      const cleanAddress = extractCleanAddress(extractedData.aadhaarBack);
      
      // Combine all text for AI parsing
      const combinedText = [
        extractedData.aadhaarFront || '',
        extractedData.aadhaarBack || '',
        extractedData.pan || '',
        extractedData.bankPassbook || ''
      ].filter(text => text.trim()).join('\n\n');
      
      // Parse using AI
      const documentsProvided = [
        req.files.aadhaarFront || req.files.aadhaarBack ? 'Aadhaar' : '',
        req.files.pan ? 'PAN' : '',
        req.files.bankPassbook ? 'Bank Passbook' : ''
      ].filter(Boolean);

      const aiResult = await parseDocument(combinedText, documentsProvided.join(', '));
      
      const parsedData = {
        aadhaar: {
          name: aiResult.name || '',
          aadhaarNumber: aiResult.aadhaarNumber || '',
          dob: aiResult.dob || ''
        },
        pan: {
          name: aiResult.name || '',
          panNumber: aiResult.panNumber || '',
          dob: aiResult.dob || ''
        },
        bank: {
          accountNumber: aiResult.accountNumber || '',
          ifscCode: aiResult.ifscCode || '',
          bankName: aiResult.bankName || '',
          accountHolderName: aiResult.accountHolderName || ''
        }
      };
      
      res.json({
        success: true,
        message: 'Dealer files processed successfully',
        data: parsedData
      });
    } catch (error) {
      console.error('Processing error:', error);
      res.status(500).json({
        success: false,
        message: 'Error processing files',
        error: error.message
      });
    }
  }
];

// Helper function to extract pincode from address
const extractPincode = (address) => {
  if (!address) return '';
  const match = address.match(/\b(\d{6})\b/);
  return match ? match[1] : '';
};

module.exports = {
  processDealer
};