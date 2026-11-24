// src/components/NombreCuenta.jsx — Nombre de la cuenta con el apodo después: «Luis Arango «Chiqui»».
// La cuenta guarda el texto completo en NombreLibre (ver etiquetaCliente); aquí solo se separa para darle estilo al apodo.
export const partesNombre = (texto = '') => {
  const m = /^(.*?)\s*«(.+)»\s*$/.exec(texto);
  return m ? { nombre: m[1], apodo: m[2] } : { nombre: texto, apodo: null };
};

/** bloque: el apodo va en su propia línea (tarjetas del panel), para que un nombre largo no lo esconda. */
export default function NombreCuenta({ texto, bloque = false }) {
  const { nombre, apodo } = partesNombre(texto);
  if (bloque) return <><span className="nom">{nombre}</span>{apodo && <span className="apodo bloque">«{apodo}»</span>}</>;
  return <>{nombre}{apodo && <span className="apodo"> «{apodo}»</span>}</>;
}
