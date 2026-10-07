// src/components/LogoBola9.jsx
// Logo de Mero Parche: bola 9 (amarilla, de rayas) con volumen y aro dorado. SVG: nítido a cualquier tamaño.
import { useId } from 'react';

export default function LogoBola9({ size = 46, titulo = 'Mero Parche' }) {
  const u = useId().replace(/:/g, '');
  const id = (n) => `${n}${u}`;
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width={size} height={size} role="img" aria-label={titulo}
      style={{ filter: 'drop-shadow(0 0 10px rgba(232,192,106,.45))' }}>
      <defs>
        <radialGradient id={id('aro')} cx="35%" cy="28%" r="90%">
          <stop offset="0" stopColor="#fff3bf" /><stop offset=".35" stopColor="#e8c06a" />
          <stop offset=".75" stopColor="#b98d2f" /><stop offset="1" stopColor="#6e4f12" />
        </radialGradient>
        <radialGradient id={id('col')} cx="36%" cy="30%" r="82%">
          <stop offset="0" stopColor="#fff6a8" /><stop offset=".45" stopColor="#facc15" /><stop offset="1" stopColor="#a16207" />
        </radialGradient>
        <radialGradient id={id('bl')} cx="36%" cy="30%" r="82%">
          <stop offset="0" stopColor="#fff" /><stop offset=".6" stopColor="#e9ecf4" /><stop offset="1" stopColor="#9aa1b4" />
        </radialGradient>
        <radialGradient id={id('num')} cx="40%" cy="32%" r="75%">
          <stop offset="0" stopColor="#fff" /><stop offset=".7" stopColor="#e6e9f2" /><stop offset="1" stopColor="#aeb4c4" />
        </radialGradient>
        <radialGradient id={id('br')}><stop offset="0" stopColor="#fff" stopOpacity=".95" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></radialGradient>
        <radialGradient id={id('som')}><stop offset="0" stopColor="#000" stopOpacity=".55" /><stop offset="1" stopColor="#000" stopOpacity="0" /></radialGradient>
        <radialGradient id={id('sh')} cx="50%" cy="50%" r="50%"><stop offset=".55" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity=".45" /></radialGradient>
        <clipPath id={id('cp')}><circle cx="60" cy="58" r="47" /></clipPath>
      </defs>
      <ellipse cx="62" cy="112" rx="34" ry="6" fill={`url(#${id('som')})`} />
      <circle cx="60" cy="58" r="52" fill={`url(#${id('aro')})`} />
      <circle cx="60" cy="58" r="47" fill={`url(#${id('bl')})`} />
      <g clipPath={`url(#${id('cp')})`}><rect x="0" y="30" width="120" height="56" fill={`url(#${id('col')})`} /></g>
      <circle cx="60" cy="58" r="47" fill={`url(#${id('sh')})`} />
      <circle cx="60" cy="58" r="21" fill={`url(#${id('num')})`} />
      <text x="60" y="68.5" textAnchor="middle" fontFamily="Georgia,serif" fontWeight="700" fontSize="32" fill="#10131c">9</text>
      <ellipse cx="42" cy="32" rx="17" ry="10" transform="rotate(-32 42 32)" fill={`url(#${id('br')})`} />
      <ellipse cx="82" cy="86" rx="9" ry="4" transform="rotate(-38 82 86)" fill="#fff" opacity=".12" />
    </svg>
  );
}
