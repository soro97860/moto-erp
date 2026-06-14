import { useState } from 'react';

export function useWorkOrderPDF() {
  const [isGenerating, setIsGenerating] = useState(false);

  async function generate(element: HTMLElement, filename: string): Promise<void> {
    setIsGenerating(true);
    try {
      // Lazy-load heavy libs only on first use
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        // Ensure fonts are rendered — defer a tick so layout is stable
        onclone: (doc) => {
          const el = doc.querySelector('[data-work-order]') as HTMLElement | null;
          if (el) el.style.display = 'block';
        },
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.93);
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pdfW = pdf.internal.pageSize.getWidth();   // 210mm
      const pdfPageH = pdf.internal.pageSize.getHeight(); // 297mm
      const imgH = (canvas.height * pdfW) / canvas.width;

      if (imgH <= pdfPageH) {
        // Single page
        pdf.addImage(imgData, 'JPEG', 0, 0, pdfW, imgH);
      } else {
        // Multi-page: slide the image upward on each new page
        let remaining = imgH;
        let offset = 0;
        while (remaining > 0) {
          pdf.addImage(imgData, 'JPEG', 0, offset, pdfW, imgH);
          remaining -= pdfPageH;
          offset -= pdfPageH;
          if (remaining > 0) pdf.addPage();
        }
      }

      pdf.save(filename);
    } finally {
      setIsGenerating(false);
    }
  }

  return { generate, isGenerating };
}
