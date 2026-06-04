// KYC Service — OCR + Face Match
// OCR uses Tesseract.js locally.
// Face match is mocked here with the exact interface AWS Rekognition would return.
// To go live: replace mockFaceMatch with real AWS Rekognition call.

const Tesseract = require('tesseract.js');

const runOcr = async (imagePath) => {
  try {
    const { data: { text } } = await Tesseract.recognize(imagePath, 'eng', {
      logger: () => {},
    });
    return { success: true, text };
  } catch (err) {
    console.error('[KYC] OCR failed:', err.message);
    return { success: false, error: err.message };
  }
};

const parseOcrText = (text, idType) => {
  // Basic field extraction — extend per ID format as needed
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  const result = {
    name: null,
    dob: null,
    idNumber: null,
    expiry: null,
    raw: text,
  };

  // Date pattern: DD/MM/YYYY or YYYY-MM-DD
  const dateRegex = /\b(\d{2}[\/\-]\d{2}[\/\-]\d{4}|\d{4}[\/\-]\d{2}[\/\-]\d{2})\b/g;
  const dates = text.match(dateRegex) || [];

  // ID number pattern: alphanumeric, 8-12 chars
  const idRegex = /\b[A-Z0-9]{8,12}\b/;
  const idMatch = text.match(idRegex);

  if (idMatch) result.idNumber = idMatch[0];
  if (dates.length > 0) result.dob = dates[0];
  if (dates.length > 1) result.expiry = dates[dates.length - 1];

  // Attempt name extraction (lines with 2+ words in uppercase)
  const nameCandidate = lines.find(l => /^[A-Z]{2,}\s+[A-Z]{2,}/.test(l));
  if (nameCandidate) result.name = nameCandidate.split('\n')[0].trim();

  return result;
};

const isExpired = (expiryString) => {
  if (!expiryString) return false;

  const parts = expiryString.split(/[\/\-]/);
  let expiryDate;

  if (parts[0].length === 4) {
    // YYYY-MM-DD
    expiryDate = new Date(`${parts[0]}-${parts[1]}-${parts[2]}`);
  } else {
    // DD/MM/YYYY
    expiryDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
  }

  return expiryDate < new Date();
};

// Mock face match — replace with AWS Rekognition in production
const runFaceMatch = async (selfiePath, idImagePath) => {
  // Simulates the structure of AWS Rekognition CompareFaces response
  await new Promise(r => setTimeout(r, 300)); // simulate API latency

  // In dev/test: return a high confidence match
  const similarity = Math.floor(Math.random() * 20) + 80; // 80-99

  return {
    success: true,
    similarity,
    faceDetails: {
      selfieHasFace: true,
      idHasFace: true,
    },
  };
};

const interpretKycResult = (faceMatchScore) => {
  if (faceMatchScore >= 80) return 'VERIFIED';
  if (faceMatchScore >= 60) return 'MANUAL_REVIEW';
  return 'FAILED';
};

module.exports = { runOcr, parseOcrText, isExpired, runFaceMatch, interpretKycResult };
