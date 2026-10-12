import { Router } from 'express';
import {
  generateProjectGuidePDF,
  generatePresentationScriptPDF,
  generateIEEEPaperPDF,
} from './pdfGenerator.ts';

export const docsRouter = Router();

// ---------------- EXPORT PROJECT GUIDE AS PDF ----------------
docsRouter.get('/download-guide-pdf', async (_req, res) => {
  try {
    const pdfBuffer = await generateProjectGuidePDF();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="OmniLife_Studio_Mentor_Guide.pdf"');
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (error: any) {
    console.error('PDF generation error:', error);
    res.status(500).json({ error: 'Failed to generate PDF document' });
  }
});

// ---------------- EXPORT PRESENTATION SCRIPT AS PDF ----------------
docsRouter.get('/download-presentation-script-pdf', async (_req, res) => {
  try {
    const pdfBuffer = await generatePresentationScriptPDF();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="OmniLife_Studio_Mentor_Presentation_Script.pdf"');
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (error: any) {
    console.error('Presentation script PDF generation error:', error);
    res.status(500).json({ error: 'Failed to generate Presentation Script PDF' });
  }
});

// ---------------- EXPORT IEEE FORMAT PAPER AS PDF ----------------
docsRouter.get('/download-ieee-paper-pdf', async (_req, res) => {
  try {
    const pdfBuffer = await generateIEEEPaperPDF();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="OmniLife_Studio_IEEE_Paper.pdf"');
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (error: any) {
    console.error('IEEE Paper PDF generation error:', error);
    res.status(500).json({ error: 'Failed to generate IEEE Paper PDF' });
  }
});
