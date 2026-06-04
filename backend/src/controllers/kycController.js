const path = require('path');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const { runOcr, parseOcrText, isExpired, runFaceMatch, interpretKycResult } = require('../services/kycService');
const { sendKycResultEmail } = require('../services/emailService');
const { createNotification } = require('../services/notificationService');

const prisma = new PrismaClient();

// POST /kyc/upload-id
const uploadId = async (req, res, next) => {
  try {
    const { ticketId, idType } = req.body;
    const userId = req.user.id;

    if (!req.file) return res.status(400).json({ error: 'ID document file is required.' });

    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket || ticket.customerId !== userId) {
      return res.status(403).json({ error: 'Invalid ticket.' });
    }

    // Upsert KYC record
    await prisma.kycRecord.upsert({
      where: { ticketId },
      create: { ticketId, userId, idType, idImagePath: req.file.path },
      update: { idType, idImagePath: req.file.path },
    });

    res.json({ message: 'ID document uploaded successfully.' });
  } catch (err) {
    next(err);
  }
};

// POST /kyc/upload-selfie
const uploadSelfie = async (req, res, next) => {
  try {
    const { ticketId, livenessPass } = req.body;
    const userId = req.user.id;

    if (!req.file) return res.status(400).json({ error: 'Selfie file is required.' });

    const kyc = await prisma.kycRecord.findUnique({ where: { ticketId } });
    if (!kyc || kyc.userId !== userId) return res.status(400).json({ error: 'Upload ID document first.' });

    await prisma.kycRecord.update({
      where: { ticketId },
      data: {
        selfiePath: req.file.path,
        livenessPass: livenessPass === 'true',
      },
    });

    res.json({ message: 'Selfie uploaded successfully.' });
  } catch (err) {
    next(err);
  }
};

// POST /kyc/verify
const verifyKyc = async (req, res, next) => {
  try {
    const { ticketId } = req.body;
    const userId = req.user.id;

    const kyc = await prisma.kycRecord.findUnique({
      where: { ticketId },
      include: { user: true },
    });

    if (!kyc || kyc.userId !== userId) return res.status(404).json({ error: 'KYC record not found.' });
    if (!kyc.idImagePath || !kyc.selfiePath) {
      return res.status(400).json({ error: 'Both ID document and selfie are required before verification.' });
    }
    if (!kyc.livenessPass) {
      return res.status(400).json({ error: 'Liveness check must be completed.' });
    }

    // Step 1: OCR
    const ocrResult = await runOcr(kyc.idImagePath);
    if (!ocrResult.success) {
      return res.status(422).json({ error: 'Could not read ID document. Please upload a clearer image.' });
    }

    const parsed = parseOcrText(ocrResult.text, kyc.idType);

    // Step 2: Expiry check
    if (parsed.expiry && isExpired(parsed.expiry)) {
      await prisma.kycRecord.update({
        where: { ticketId },
        data: { status: 'FAILED', failureReason: 'ID document has expired.' },
      });
      return res.status(422).json({ error: 'Your ID document has expired. Please upload a valid document.' });
    }

    // Step 3: Face match
    const faceMatch = await runFaceMatch(kyc.selfiePath, kyc.idImagePath);
    if (!faceMatch.success) {
      return res.status(422).json({ error: 'Face match could not be completed. Please retake your selfie.' });
    }

    // Step 4: Interpret result
    const kycStatus = interpretKycResult(faceMatch.similarity);

    await prisma.kycRecord.update({
      where: { ticketId },
      data: {
        ocrName: parsed.name,
        ocrDob: parsed.dob,
        ocrIdNumber: parsed.idNumber,
        ocrExpiry: parsed.expiry,
        ocrRaw: { text: ocrResult.text },
        faceMatchScore: faceMatch.similarity,
        status: kycStatus,
        verifiedAt: kycStatus === 'VERIFIED' ? new Date() : null,
        failureReason: kycStatus === 'FAILED' ? 'Face match confidence too low.' : null,
      },
    });

    // Schedule image deletion (24h) if verified or failed
    if (kycStatus !== 'MANUAL_REVIEW') {
      scheduleImageDeletion(ticketId, kyc.idImagePath, kyc.selfiePath);
    }

    await sendKycResultEmail(kyc.user, kycStatus, null);
    await createNotification({
      userId,
      type: kycStatus === 'VERIFIED' ? 'KYC_VERIFIED' : 'KYC_FAILED',
      title: kycStatus === 'VERIFIED' ? 'Identity Verified' : 'Verification Issue',
      body: kycStatus === 'VERIFIED'
        ? 'Your identity has been verified successfully.'
        : 'There was an issue verifying your identity. An agent will review your case.',
      ticketId,
    });

    res.json({
      status: kycStatus,
      faceMatchScore: faceMatch.similarity,
      message: kycStatus === 'VERIFIED'
        ? 'Identity verified successfully.'
        : kycStatus === 'MANUAL_REVIEW'
        ? 'Your documents have been submitted for manual review by an agent.'
        : 'Verification failed. Please retry with clearer documents.',
    });
  } catch (err) {
    next(err);
  }
};

const scheduleImageDeletion = (ticketId, idPath, selfiePath) => {
  setTimeout(async () => {
    try {
      if (idPath && fs.existsSync(idPath)) fs.unlinkSync(idPath);
      if (selfiePath && fs.existsSync(selfiePath)) fs.unlinkSync(selfiePath);
      await prisma.kycRecord.update({
        where: { ticketId },
        data: { imagesDeletedAt: new Date(), idImagePath: null, selfiePath: null },
      });
    } catch (err) {
      console.error('[KYC] Image deletion failed:', err.message);
    }
  }, 24 * 60 * 60 * 1000); // 24 hours
};

module.exports = { uploadId, uploadSelfie, verifyKyc };
