import { useState } from 'react';

export function useWorkOrderPDF() {
  const [isGenerating, setIsGenerating] = useState(false);

  async function generate(element: HTMLElement, filename: string): Promise<void> {
    setIsGenerating(true);
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        // Capture the element's own content area, not the page viewport
        x: 0,
        y: 0,
        scrollX: 0,
        scrollY: 0,
        width: element.scrollWidth,
        height: element.scrollHeight,
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight,
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.93);
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pdfW = pdf.internal.pageSize.getWidth();
      const pdfPageH = pdf.internal.pageSize.getHeight();
      const imgH = (canvas.height * pdfW) / canvas.width;

      if (imgH <= pdfPageH) {
        pdf.addImage(imgData, 'JPEG', 0, 0, pdfW, imgH);
      } else {
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
