import { useRef, useState } from 'react';
import { Loader2, PenLine, FileDown } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { WorkOrderDocument } from './WorkOrderDocument';
import { SignaturePad } from './SignaturePad';
import { useOrderReceipt } from '../hooks/useOrders';
import { useWorkOrderPDF } from '../hooks/useWorkOrderPDF';
import { useSettingsStore } from '../stores/settingsStore';

interface Props {
  orderId: string;
  open: boolean;
  onClose: () => void;
}

export function WorkOrderViewer({ orderId, open, onClose }: Props) {
  const { data: receipt, isLoading } = useOrderReceipt(orderId);
  const { settings } = useSettingsStore();
  const { generate, isGenerating } = useWorkOrderPDF();
  const pdfRef = useRef<HTMLDivElement>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [showPad, setShowPad] = useState(false);

  function handleClose() {
    setSignature(null);
    setShowPad(false);
    onClose();
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
        <DialogContent className="max-w-4xl h-[90vh] flex flex-col gap-0 p-0 overflow-hidden">
          <DialogHeader className="flex-shrink-0 px-5 py-4 border-b">
            <DialogTitle>
              工單預覽{receipt ? ` — ${receipt.orderNo}` : ''}
            </DialogTitle>
          </DialogHeader>

          {/* Scrollable A4 document */}
          <div className="flex-1 overflow-auto bg-gray-100">
            {isLoading || !receipt ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : (
              <div className="py-6 px-4 flex justify-center">
                <div className="shadow-xl" style={{ width: 794 }}>
                  <WorkOrderDocument
                    ref={pdfRef}
                    order={receipt}
                    settings={settings}
                    signature={signature ?? undefined}
                    onSignatureClick={() => setShowPad(true)}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex-shrink-0 border-t px-5 py-3 flex gap-2 bg-white">
            <Button
              variant="outline"
              disabled={!receipt}
              onClick={() => setShowPad(true)}
            >
              <PenLine className="h-4 w-4" />
              {signature ? '重新簽名' : '電子簽名'}
            </Button>
            <Button
              variant="outline"
              disabled={isGenerating || !receipt}
              onClick={() => {
                if (pdfRef.current && receipt) {
                  generate(pdfRef.current, `工單_${receipt.orderNo}.pdf`);
                }
              }}
            >
              {isGenerating ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> 產生中…</>
              ) : (
                <><FileDown className="h-4 w-4" /> 下載 PDF</>
              )}
            </Button>
            <Button className="ml-auto" onClick={handleClose}>
              關閉
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Signature pad renders above the dialog */}
      {showPad && (
        <SignaturePad
          onConfirm={(url) => { setSignature(url); setShowPad(false); }}
          onCancel={() => setShowPad(false)}
        />
      )}
    </>
  );
}
