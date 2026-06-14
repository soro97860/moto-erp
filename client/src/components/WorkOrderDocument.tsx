import { forwardRef } from 'react';
import type { Receipt } from '../hooks/useOrders';
import type { ShopSettings } from '../stores/settingsStore';

interface Props {
  order: Receipt;
  settings: ShopSettings;
  signature?: string; // data URL from SignaturePad
}

// ── Style helpers ────────────────────────────────────────────────────────────
const th: React.CSSProperties = {
  padding: '6px 8px',
  textAlign: 'center',
  fontWeight: 600,
  fontSize: 11,
  borderBottom: '1.5px solid #374151',
  borderRight: '1px solid #d1d5db',
  whiteSpace: 'nowrap',
};
const td: React.CSSProperties = {
  padding: '5px 8px',
  fontSize: 11,
  borderBottom: '1px solid #e5e7eb',
  borderRight: '1px solid #e5e7eb',
  verticalAlign: 'middle',
};
const tdR: React.CSSProperties = { ...td, textAlign: 'right' };
const tdC: React.CSSProperties = { ...td, textAlign: 'center' };

function fmt(n: number) {
  return n.toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

// ── Component ────────────────────────────────────────────────────────────────
export const WorkOrderDocument = forwardRef<HTMLDivElement, Props>(
  ({ order, settings, signature }, ref) => {
    const info = [
      settings.address && `地址：${settings.address}`,
      settings.phone && `電話：${settings.phone}`,
      settings.taxId && `統編：${settings.taxId}`,
    ]
      .filter(Boolean)
      .join('　　');

    const totalItems = order.items.length + (order.laborFee > 0 ? 1 : 0);

    return (
      <div
        ref={ref}
        style={{
          width: 794,
          minHeight: 1123,
          padding: '48px 56px',
          fontFamily:
            '"Noto Sans CJK TC", "PingFang TC", "Microsoft JhengHei", "微軟正黑體", Arial, sans-serif',
          background: '#ffffff',
          color: '#111827',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* ── HEADER ───────────────────────────────────────────── */}
        <div
          style={{
            textAlign: 'center',
            borderBottom: '2px solid #111827',
            paddingBottom: 14,
            marginBottom: 18,
          }}
        >
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: 2 }}>
            {settings.name}
          </div>
          {info && (
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>{info}</div>
          )}
          <div
            style={{
              display: 'inline-block',
              marginTop: 10,
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: 4,
              borderBottom: '1.5px solid #111827',
              paddingBottom: 2,
            }}
          >
            維 修 工 單
          </div>
        </div>

        {/* ── ORDER INFO ────────────────────────────────────────── */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 11,
            marginBottom: 10,
            gap: 8,
          }}
        >
          <span>
            工單號碼：<strong style={{ fontFamily: 'monospace' }}>{order.orderNo}</strong>
          </span>
          <span>日期時間：<strong>{order.issuedAt}</strong></span>
          <span>服務人員：<strong>{order.operator}</strong></span>
        </div>

        <div style={{ borderTop: '1px dashed #d1d5db', marginBottom: 12 }} />

        {/* ── CUSTOMER INFO ─────────────────────────────────────── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '6px 32px',
            fontSize: 11,
            marginBottom: 12,
          }}
        >
          <span>
            車牌號碼：
            <strong style={{ fontFamily: 'monospace', fontSize: 13 }}>
              {order.customer.licensePlate}
            </strong>
          </span>
          <span>車主姓名：<strong>{order.customer.name}</strong></span>
          <span>聯絡電話：<strong>{order.customer.phone}</strong></span>
          <span>車身顏色：<strong>{order.customer.vehicleColor ?? '—'}</strong></span>
          {order.customer.vehicleModel && (
            <span style={{ gridColumn: '1 / -1' }}>
              車款型號：<strong>{order.customer.vehicleModel}</strong>
            </span>
          )}
        </div>

        <div style={{ borderTop: '1px dashed #d1d5db', marginBottom: 14 }} />

        {/* ── ITEMS TABLE ───────────────────────────────────────── */}
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            marginBottom: 4,
            border: '1px solid #d1d5db',
          }}
        >
          <thead>
            <tr style={{ backgroundColor: '#f3f4f6' }}>
              <th style={{ ...th, width: 36 }}>項次</th>
              <th style={{ ...th, textAlign: 'left', width: 'auto' }}>品名 / 服務項目</th>
              <th style={{ ...th, width: 52 }}>數量</th>
              <th style={{ ...th, width: 40 }}>單位</th>
              <th style={{ ...th, width: 80 }}>單價</th>
              <th style={{ ...th, width: 90, borderRight: 'none' }}>小計</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item, i) => (
              <tr key={i}>
                <td style={tdC}>{i + 1}</td>
                <td style={{ ...td, textAlign: 'left' }}>{item.name}</td>
                <td style={tdC}>{item.qty}</td>
                <td style={tdC}>{item.unit}</td>
                <td style={tdR}>{fmt(item.unitPrice)}</td>
                <td style={{ ...tdR, borderRight: 'none' }}>{fmt(item.subtotal)}</td>
              </tr>
            ))}
            {/* Labor fee row */}
            {order.laborFee > 0 && (
              <tr>
                <td style={tdC}>{order.items.length + 1}</td>
                <td style={{ ...td, textAlign: 'left' }}>工資 / 服務費</td>
                <td style={tdC}>1</td>
                <td style={tdC}>次</td>
                <td style={tdR}>{fmt(order.laborFee)}</td>
                <td style={{ ...tdR, borderRight: 'none' }}>{fmt(order.laborFee)}</td>
              </tr>
            )}
            {/* Empty padding rows to fill short orders */}
            {Array.from({ length: Math.max(0, 6 - totalItems) }, (_, i) => (
              <tr key={`pad-${i}`}>
                <td style={tdC} />
                <td style={{ ...td, textAlign: 'left' }} />
                <td style={tdC} />
                <td style={tdC} />
                <td style={tdR} />
                <td style={{ ...tdR, borderRight: 'none' }} />
              </tr>
            ))}
          </tbody>
          <tfoot>
            {order.discount > 0 && (
              <tr style={{ backgroundColor: '#fef2f2' }}>
                <td colSpan={5} style={{ ...td, textAlign: 'right', color: '#6b7280' }}>
                  折扣優惠
                </td>
                <td style={{ ...tdR, color: '#ef4444', fontWeight: 600, borderRight: 'none' }}>
                  -{fmt(order.discount)}
                </td>
              </tr>
            )}
            <tr style={{ backgroundColor: '#f9fafb', borderTop: '1.5px solid #374151' }}>
              <td colSpan={5} style={{ ...td, textAlign: 'right', fontWeight: 700, fontSize: 12 }}>
                合　計
              </td>
              <td
                style={{
                  ...tdR,
                  fontWeight: 700,
                  fontSize: 14,
                  borderRight: 'none',
                  letterSpacing: 1,
                }}
              >
                NT$ {fmt(order.total)}
              </td>
            </tr>
          </tfoot>
        </table>

        {/* ── NOTES ─────────────────────────────────────────────── */}
        {(order.serviceDescription || order.note) && (
          <div
            style={{
              border: '1px solid #e5e7eb',
              borderRadius: 4,
              padding: '10px 14px',
              fontSize: 11,
              color: '#374151',
              marginTop: 12,
              minHeight: 48,
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 4 }}>維修說明備註</div>
            <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
              {[order.serviceDescription, order.note].filter(Boolean).join('\n')}
            </div>
          </div>
        )}

        {/* Spacer to push footer to bottom */}
        <div style={{ flex: 1 }} />

        {/* ── FOOTER ────────────────────────────────────────────── */}
        <div
          style={{
            marginTop: 24,
            paddingTop: 14,
            borderTop: '1px solid #e5e7eb',
            fontSize: 11,
            color: '#4b5563',
          }}
        >
          {settings.thankYou && (
            <p style={{ textAlign: 'center', marginBottom: 4 }}>{settings.thankYou}</p>
          )}
          {settings.warranty && (
            <p style={{ textAlign: 'center', marginBottom: 14, color: '#6b7280', fontSize: 10 }}>
              {settings.warranty}
            </p>
          )}

          {/* Signature area */}
          <div
            style={{
              border: '1px solid #9ca3af',
              borderRadius: 4,
              padding: '12px 16px',
            }}
          >
            <p style={{ fontWeight: 600, fontSize: 12, marginBottom: 14, textAlign: 'center' }}>
              ⚠ 以上維修項目及費用已與客戶確認，如有異議請於 7 日內告知。
            </p>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 32, marginTop: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 4 }}>客戶簽名</div>
                {signature ? (
                  <img
                    src={signature}
                    style={{ display: 'block', height: 64, maxWidth: '100%', objectFit: 'contain', objectPosition: 'left bottom' }}
                  />
                ) : (
                  <div style={{ height: 64, borderBottom: '1px solid #374151' }} />
                )}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 20 }}>
                  服務人員：{order.operator}
                </div>
                <div style={{ borderBottom: '1px solid #374151', height: 1 }} />
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#6b7280', whiteSpace: 'nowrap' }}>
                  日期：__________ 年 ____ 月 ____ 日
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  },
);
WorkOrderDocument.displayName = 'WorkOrderDocument';
