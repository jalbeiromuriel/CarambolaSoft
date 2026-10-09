// src/components/BotonComprobante.jsx — 📸 Toma la foto del comprobante y la manda a la patrona. La foto no se guarda en la app.
import { useRef } from 'react';
import { leerWhatsappPatrona } from '../cuenta/fiadosDb.js';
import { enlaceWhatsApp } from '../informes/datos.js';

export default function BotonComprobante({ texto }) {
  const ref = useRef(null);
  async function alElegir(e) {
    const foto = e.target.files?.[0]; e.target.value = '';
    if (!foto) return;
    try {
      if (navigator.canShare?.({ files: [foto] })) { await navigator.share({ files: [foto], text: texto }); return; }
    } catch (err) { if (err?.name === 'AbortError') return; }
    // Sin menú de compartir (computador): abre WhatsApp con el texto; la foto se adjunta allí. La imagen se descarta.
    window.open(enlaceWhatsApp(texto, await leerWhatsappPatrona()), '_blank', 'noopener');
  }
  return (
    <>
      <input ref={ref} type="file" accept="image/*" capture="environment" hidden onChange={alElegir} />
      <button type="button" className="cb-foto" onClick={() => ref.current?.click()}>📸 Enviar comprobante a la patrona</button>
    </>
  );
}
