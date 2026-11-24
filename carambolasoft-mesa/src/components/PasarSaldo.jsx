// src/components/PasarSaldo.jsx — Modal "Pasar saldo a…" (maqueta aprobada 2026-11-24).
// El cliente paga lo que tiene y el resto pasa a la cuenta de un amigo (de esta mesa, de otra, o una cuenta nueva en esta mesa).
// Las reglas viven en cuenta/traspaso.js; aquí solo se elige y se confirma.
import { useState } from 'react';
import SelectorCliente, { personasDe } from './SelectorCliente.jsx';
import { METODOS } from '../cuenta/cobro.js';
import { planTraspaso } from '../cuenta/traspaso.js';
import { agrupar } from '../cuenta/grupos.js';

const fmt = (n) => '$' + Math.round(n ?? 0).toLocaleString('es-CO');
const soloDigitos = (v) => Number(String(v).replace(/\D/g, '')) || 0;
const sinTildes = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const tipoDe = (c) => (c.TipoCuenta === 'BILLAR' ? 'Billar' : c.TipoCuenta === 'GARITA' ? 'Garita' : 'Licores');
// La mesa se llama como su primera cuenta: «Licores», o «Licores · mesa de Juan» si la cuenta no es la primera
const mesaDe = (g, c) => (g[0].Id === c.Id ? tipoDe(c) : `${tipoDe(c)} · mesa de ${g[0].NombreLibre}`);

/**
 * cuenta: la que pasa el saldo · total: lo que debe · abiertas: todas las cuentas ABIERTAS · totalDe(c): lo que lleva cada una
 * chicoCorriendo: bloquea todo · terminarChico(): botón del aviso · confirmar({ paga, metodo, destinoId, nueva }) → '' o mensaje de error
 */
export default function PasarSaldo({ cuenta, total, abiertas, totalDe, chicoCorriendo, terminarChico, confirmar, cerrar }) {
  const [paga, setPaga] = useState(0);
  const [metodo, setMetodo] = useState('EFECTIVO');
  const [destinoId, setDestinoId] = useState(null);
  const [nueva, setNueva] = useState(null);   // { sel, creando } — cuenta nueva en esta mesa
  const [busca, setBusca] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const otras = abiertas.filter((c) => c.Id !== cuenta.Id && (!busca || sinTildes(c.NombreLibre).includes(sinTildes(busca))));
  const grupos = agrupar(otras);
  const miGrupo = (c) => (c.MesaId ?? c.GaritaRelojId ?? c.GrupoMesaId ?? c.Id) === (cuenta.MesaId ?? cuenta.GaritaRelojId ?? cuenta.GrupoMesaId ?? cuenta.Id);
  const deEstaMesa = grupos.filter((g) => miGrupo(g[0])).flat();
  const deOtras = grupos.filter((g) => !miGrupo(g[0]));

  const saldo = paga < total ? total - paga : 0;
  const destino = abiertas.find((c) => c.Id === destinoId);
  const nombreNueva = nueva ? personasDe(nueva.sel)[0]?.etiqueta : null;
  const nombreDestino = nueva ? nombreNueva : destino?.NombreLibre;
  const plan = planTraspaso({ total, paga, metodo, chicoCorriendo, destinoId: nueva ? (nombreNueva ? 'nueva' : null) : destinoId, origenId: cuenta.Id });

  async function enviar() {
    if (plan.error) { setError(plan.error); return; }
    setEnviando(true);
    const err = await confirmar({ paga, metodo, destinoId: nueva ? null : destinoId, nueva: nueva ? personasDe(nueva.sel)[0] : null });
    setEnviando(false);
    if (err) setError(err);
  }

  const Fila = ({ c, mesa }) => (
    <button className={`ps-fila ${destinoId === c.Id && !nueva ? 'on' : ''}`} disabled={chicoCorriendo}
      onClick={() => { setNueva(null); setDestinoId(c.Id); setError(''); }}>
      <span>{chicoCorriendo ? '🔒 ' : destinoId === c.Id && !nueva ? '✓ ' : ''}{c.NombreLibre}{mesa && <small> · {mesa}</small>}</span>
      <em>{fmt(totalDe(c))}</em>
    </button>
  );

  return (
    <div className="pn-velo alto" onClick={(e) => e.target === e.currentTarget && cerrar()}>
      <div className="pn-modal ps">
        <h3>⇄ Pasar saldo · {cuenta.NombreLibre}</h3>
        <div className="ps-cab">Cuenta <b>{fmt(total)}</b></div>

        {chicoCorriendo && (
          <div className="ps-aviso">
            <b>⏱ El chico sigue corriendo</b>
            Todavía no se sabe cuánto es la deuda. El saldo se puede pasar cuando termine el chico.
            <button onClick={terminarChico}>■ Terminar chico</button>
          </div>
        )}

        {!chicoCorriendo && (
          <>
            <div className="ps-pago">
              <div className="p"><small>{cuenta.NombreLibre.toUpperCase()} PAGA AHORA</small>
                <input inputMode="numeric" placeholder="$0 (no paga nada)" value={paga ? '$' + paga.toLocaleString('es-CO') : ''}
                  onChange={(e) => { setPaga(soloDigitos(e.target.value)); setError(''); }} /></div>
              <div className="s"><small>SALDO A PASAR</small><div className="n">{fmt(saldo)}</div></div>
            </div>
            {paga > 0 && (
              <div className="cb-met ps-met">
                {METODOS.filter((m) => m.v !== 'FIADO').map((m) => (
                  <button key={m.v} className={metodo === m.v ? 'on' : ''} onClick={() => setMetodo(m.v)}>{m.t}</button>))}
              </div>
            )}
          </>
        )}

        {!nueva && (
          <>
            <input className="ps-busca" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="🔍 Buscar cuenta por nombre…" disabled={chicoCorriendo} />
            <div className="ps-lista">
              <div className="cb-lab">Esta mesa</div>
              {deEstaMesa.map((c) => <Fila key={c.Id} c={c} />)}
              <button className="ps-nueva" disabled={chicoCorriendo} onClick={() => { setNueva({ sel: { cliente: null, nombre: '' }, creando: false }); setDestinoId(null); setError(''); }}>
                ＋ Nueva cuenta en esta mesa (para quien no tiene cuenta)</button>
              {deOtras.length > 0 && <div className="cb-lab">Otras mesas</div>}
              {deOtras.map((g) => g.map((c) => <Fila key={c.Id} c={c} mesa={mesaDe(g, c)} />))}
              {otras.length === 0 && busca && <div className="ms-vacio">Ninguna cuenta abierta con ese nombre.</div>}
            </div>
          </>
        )}

        {nueva && (
          <div className="ps-lista">
            <button className="ps-volver" onClick={() => setNueva(null)}>← Volver a la lista de cuentas</button>
            <div className="cb-lab">Nueva cuenta en esta mesa</div>
            <SelectorCliente valor={nueva.sel} onChange={(sel) => setNueva((n) => ({ ...n, sel }))}
              onModoNuevo={(creando) => setNueva((n) => ({ ...n, creando }))} error={error} setError={setError} />
          </div>
        )}

        {!chicoCorriendo && nombreDestino && saldo > 0 && (
          <div className="ps-res">
            {paga > 0 ? <>Se factura la cuenta de {cuenta.NombreLibre}: paga <b className="v">{fmt(paga)}</b> y los </> : <>Los </>}
            <b className="a">{fmt(saldo)}</b> {paga > 0 ? 'restantes' : 'de la cuenta'} pasan a <b className="o">{nombreDestino}</b> como «Saldo de {cuenta.NombreLibre}».
            <small>Los productos se quedan en la factura de {cuenta.NombreLibre}. El inventario no se mueve.</small>
          </div>
        )}

        {error && !nueva?.creando && <div className="pn-err">{error}</div>}
        {!nueva?.creando && (
          <div className="pn-acc">
            <button className="no" onClick={cerrar}>CANCELAR</button>
            <button className="si" disabled={chicoCorriendo || enviando || !!plan.error} onClick={enviar}>
              {paga > 0 ? 'COBRAR Y PASAR SALDO' : 'PASAR SALDO'}</button>
          </div>
        )}
      </div>
    </div>
  );
}
