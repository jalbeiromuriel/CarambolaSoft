// src/components/Sesion.jsx — Usuario en turno + navegación, disponibles para toda la app.
import { createContext, useContext } from 'react';
export const SesionContext = createContext({ usuario: null, irA: () => {}, cerrarSesion: () => {} });
export const useSesion = () => useContext(SesionContext);
