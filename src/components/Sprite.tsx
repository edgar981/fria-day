// Sprite SVG del sistema de diseño (avatares + iconos). Se inyecta una sola vez
// en el layout raíz; luego se referencia con <use href="#av-..."> / <use href="#ic-...">.
// Generado desde el entregable de Claude Design (FriaDay.dc.html). No editar a mano.
// Exportado además para inlinear los símbolos donde `<use href>` no resuelve
// (satori/next-og en la share-card, Pasada S.2).
export const SPRITE = `<symbol id="av-capibara" viewBox="0 0 48 48"><circle cx="15" cy="13" r="4" fill="#FBF0D5"/><circle cx="33" cy="13" r="4" fill="#FBF0D5"/><rect x="9" y="14" width="30" height="25" rx="11" fill="#FBF0D5"/><ellipse cx="24" cy="33" rx="9" ry="6" fill="#E9D5A8"/><circle cx="18" cy="24" r="2.4" fill="#241609"/><circle cx="30" cy="24" r="2.4" fill="#241609"/><ellipse cx="24" cy="31" rx="3" ry="2" fill="#241609"/></symbol>
<symbol id="av-tucan" viewBox="0 0 48 48"><circle cx="31" cy="21" r="12" fill="#FBF0D5"/><path d="M23 14 L2 23 L22 30 Z" fill="#FBF0D5"/><path d="M23 21 L6 24 L22 30 Z" fill="#D8A24A"/><path d="M23 13v18" stroke="#241609" stroke-width="2" stroke-linecap="round"/><circle cx="32" cy="18" r="3.2" fill="#241609"/><path d="M24 33h14a7 7 0 0 1-14 0z" fill="#E9D5A8"/></symbol>
<symbol id="av-jaguar" viewBox="0 0 48 48"><path d="M12 20 L14.5 7 L25 15 Z" fill="#FBF0D5"/><path d="M36 20 L33.5 7 L23 15 Z" fill="#FBF0D5"/><path d="M15.5 18 L16.8 11 L22 16 Z" fill="#B98A4A"/><path d="M32.5 18 L31.2 11 L26 16 Z" fill="#B98A4A"/><circle cx="24" cy="27" r="14" fill="#FBF0D5"/><circle cx="12.8" cy="22" r="1.9" fill="#241609"/><circle cx="35.2" cy="22" r="1.9" fill="#241609"/><circle cx="13.2" cy="32" r="1.7" fill="#241609"/><circle cx="34.8" cy="32" r="1.7" fill="#241609"/><ellipse cx="18.5" cy="25" rx="3" ry="2.4" fill="#241609"/><ellipse cx="29.5" cy="25" rx="3" ry="2.4" fill="#241609"/><path d="M21.5 30.8h5l-2.5 2.6z" fill="#241609"/><path d="M24 33.4v1.8M24 35.2q-3.2 2.2-5.2-.2M24 35.2q3.2 2.2 5.2-.2" stroke="#241609" stroke-width="1.7" fill="none" stroke-linecap="round"/></symbol>
<symbol id="av-mono" viewBox="0 0 48 48"><circle cx="9" cy="24" r="6" fill="#FBF0D5"/><circle cx="39" cy="24" r="6" fill="#FBF0D5"/><circle cx="24" cy="24" r="15" fill="#FBF0D5"/><path d="M24 12c8 0 11 6 11 12s-5 11-11 11-11-5-11-11 3-12 11-12z" fill="#E9D5A8"/><circle cx="19" cy="23" r="2.4" fill="#241609"/><circle cx="29" cy="23" r="2.4" fill="#241609"/><path d="M20 31q4 3 8 0" stroke="#241609" stroke-width="2" fill="none" stroke-linecap="round"/></symbol>
<symbol id="av-rana" viewBox="0 0 48 48"><circle cx="13" cy="15" r="8" fill="#FBF0D5"/><circle cx="35" cy="15" r="8" fill="#FBF0D5"/><circle cx="13" cy="15" r="3.4" fill="#241609"/><circle cx="35" cy="15" r="3.4" fill="#241609"/><path d="M8 24h32a16 16 0 0 1-32 0z" fill="#FBF0D5"/><path d="M14 30q10 6 20 0" stroke="#241609" stroke-width="2.2" fill="none" stroke-linecap="round"/></symbol>
<symbol id="av-chucha" viewBox="0 0 48 48"><circle cx="13" cy="16" r="6.5" fill="#E9D5A8"/><circle cx="35" cy="16" r="6.5" fill="#E9D5A8"/><path d="M24 10c-8 0-12 5-12 11 0 8 6 13 12 18 6-5 12-10 12-18 0-6-4-11-12-11z" fill="#FBF0D5"/><circle cx="19" cy="22" r="2.2" fill="#241609"/><circle cx="29" cy="22" r="2.2" fill="#241609"/><circle cx="24" cy="34" r="2.6" fill="#E07B12"/></symbol>
<symbol id="av-armadillo" viewBox="0 0 48 48"><path d="M40 34a16 14 0 0 0-32 0z" fill="#FBF0D5"/><path d="M19 20h4v14h-4z M27 20.5h4V34h-4z" fill="#D8BE8C"/><path d="M13 22c-4 0-9 3-11 6 3 3 8 6 11 6z" fill="#E9D5A8"/><circle cx="12" cy="26" r="2" fill="#241609"/><circle cx="3" cy="28" r="1.6" fill="#241609"/></symbol>
<symbol id="av-condor" viewBox="0 0 48 48"><circle cx="27" cy="19" r="11" fill="#FBF0D5"/><path d="M18 14 L3 20 L18 26 Z" fill="#241609"/><path d="M3 20q6 6 9 4z" fill="#241609"/><circle cx="29" cy="16" r="2.8" fill="#241609"/><path d="M13 31h26a13 13 0 0 1-26 0z" fill="#241609"/></symbol>
<symbol id="av-iguana" viewBox="0 0 48 48"><path d="M14 16h4l2-4 2 4h4l2-4 2 4h4" stroke="#F2A016" stroke-width="3" fill="none" stroke-linecap="round"/><rect x="10" y="18" width="30" height="17" rx="8" fill="#FBF0D5"/><path d="M6 24q6-6 10-5v14c-5 1-9-4-10-9z" fill="#E9D5A8"/><circle cx="17" cy="25" r="2.6" fill="#241609"/><circle cx="26" cy="31" r="4.5" fill="#E07B12"/></symbol>
<symbol id="av-oso" viewBox="0 0 48 48"><circle cx="13" cy="14" r="5.5" fill="#FBF0D5"/><circle cx="35" cy="14" r="5.5" fill="#FBF0D5"/><circle cx="24" cy="25" r="15" fill="#FBF0D5"/><circle cx="18" cy="22" r="5" fill="none" stroke="#241609" stroke-width="2"/><circle cx="30" cy="22" r="5" fill="none" stroke="#241609" stroke-width="2"/><circle cx="18" cy="22" r="1.8" fill="#241609"/><circle cx="30" cy="22" r="1.8" fill="#241609"/><ellipse cx="24" cy="32" rx="4.5" ry="3.5" fill="#E9D5A8"/><ellipse cx="24" cy="31" rx="2" ry="1.4" fill="#241609"/></symbol>
<symbol id="av-anon" viewBox="0 0 48 48"><circle cx="24" cy="18" r="8.5" fill="#7E6A53"/><path d="M8 42a16 13 0 0 1 32 0z" fill="#7E6A53"/></symbol>
<symbol id="ic-home" viewBox="0 0 24 24"><path d="M4 11l8-6 8 6v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/></symbol>
<symbol id="ic-mug" viewBox="0 0 24 24"><path d="M5 7h10v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/><path d="M15 10h2.5a2.5 2.5 0 0 1 0 5.5H15" fill="none" stroke="currentColor" stroke-width="1.9"/></symbol>
<symbol id="ic-chart" viewBox="0 0 24 24"><path d="M5 19v-8M12 19V5M19 19v-6" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"/></symbol>
<symbol id="ic-mail" viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="12" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="m4 8 8 5.5L20 8" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></symbol>
<symbol id="ic-plus" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></symbol>
<symbol id="ic-back" viewBox="0 0 24 24"><path d="M14 6l-7 6 7 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></symbol>
<symbol id="ic-search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="m16 16 4.5 4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></symbol>
<symbol id="ic-lock" viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="10" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M8.5 10V8a3.5 3.5 0 0 1 7 0v2" fill="none" stroke="currentColor" stroke-width="1.9"/></symbol>`;

export function Sprite() {
  return (
    <svg
      width={0}
      height={0}
      aria-hidden="true"
      style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}
      dangerouslySetInnerHTML={{ __html: SPRITE }}
    />
  );
}
