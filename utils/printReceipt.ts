import { Order, Product, Settings, Table } from '../types';

export const printReceipt = (
  order: Order, 
  products: Product[], 
  settings: Settings, 
  table: Table,
  cashierName?: string,
  serverName?: string,
  paymentMode?: string
) => {
  const printWindow = window.open('', '_blank', 'width=300,height=600');
  if (!printWindow) {
      alert("Veuillez autoriser les pop-ups pour imprimer la facture.");
      return;
  }

  const totalUSD = order.items.reduce((acc, item) => acc + (item.prixUnitaireUSD * item.quantite), 0);
  const totalCDF = totalUSD * settings.tauxUSD_CDF;
  const taxeUSD = totalUSD * (settings.taxeDGRK / 100);
  const grandTotalUSD = totalUSD + taxeUSD;
  const grandTotalCDF = grandTotalUSD * settings.tauxUSD_CDF;

  const itemsHtml = order.items.map(item => {
    const p = products.find(prod => prod.id === item.productId);
    return `
      <div class="item">
        <span>${item.quantite}x ${p?.nom || 'Produit'}</span>
        <span>$${(item.prixUnitaireUSD * item.quantite).toFixed(2)}</span>
      </div>
    `;
  }).join('');

  const html = `
    <html>
    <head>
      <title>Ticket de Caisse - ${settings.nomEtablissement || 'KinTerrasse'}</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        @page { margin: 0; size: auto; }
        body { 
          font-family: 'Courier New', Courier, monospace; 
          width: 80mm; 
          margin: 0 auto; 
          padding: 10px; 
          font-size: 12px;
          color: #000;
          background: #fff;
        }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .font-bold { font-weight: bold; }
        .divider { border-top: 1px dashed #000; margin: 10px 0; }
        .item { display: flex; justify-content: space-between; margin-bottom: 5px; }
        .totals { margin-top: 10px; }
        .totals .item { font-weight: bold; }
        @media print {
            body { padding: 0; }
            button { display: none; }
        }
      </style>
    </head>
    <body onload="setTimeout(function(){ window.print(); }, 500);">
      <div class="text-center font-bold" style="font-size: 16px; margin-bottom: 5px;">
        ${settings.nomEtablissement || 'KinTerrasse'}
      </div>
      <div class="text-center" style="font-size: 10px; margin-bottom: 5px;">
        ${settings.adresse || ''}
      </div>
      <div class="text-center" style="font-size: 20px; font-weight: bold; border: 1px solid #000; padding: 5px; margin-bottom: 10px;">
        Table ${table.numero}
      </div>
      <div class="text-center" style="margin-bottom: 10px;">
        Date: ${new Date().toLocaleString()}
      </div>
      
      <div class="divider"></div>
      
      ${itemsHtml}
      
      <div class="divider"></div>
      
      <div class="totals">
        <div class="item text-xs" style="font-size: 10px;">
          <span>S/Total:</span>
          <span>$${totalUSD.toFixed(2)}</span>
        </div>
        <div class="item text-xs" style="font-size: 10px;">
          <span>Taxe (${settings.taxeDGRK}%):</span>
          <span>$${taxeUSD.toFixed(2)}</span>
        </div>
        <div class="divider"></div>
        <div class="item" style="font-size: 16px;">
          <span>TOT USD:</span>
          <span>$${grandTotalUSD.toFixed(2)}</span>
        </div>
        <div class="item" style="font-size: 16px;">
          <span>TOT CDF:</span>
          <span>${grandTotalCDF.toLocaleString()} FC</span>
        </div>
      </div>
      
      <div class="divider"></div>
      
      ${paymentMode ? '<div class="text-center" style="margin-bottom:5px;">Mode: ' + paymentMode + '</div>' : '<div class="text-center" style="margin-bottom:5px;"><b>(PRE-FACTURE)</b></div>'}
      <div class="text-center">Serveur: ${serverName || 'N/A'}</div>
      ${cashierName ? '<div class="text-center">Caisse: ' + cashierName + '</div>' : ''}
      
      <div class="divider"></div>
      <div class="text-center">Merci de votre visite !</div>
      <div class="text-center" style="font-size: 9px; margin-top: 10px;">Propulsé par KinTerrasse</div>
      <div class="text-center" style="margin-top: 20px;">
        <button onclick="window.print()" style="padding: 10px 20px; font-size: 14px; cursor: pointer;">Imprimer</button>
      </div>
    </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
};
