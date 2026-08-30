# COPY.md — FriaDay · Pasada T (tono)

Inventario del copy visible con **antes → después**. Tono objetivo: joven
colombiano, cercano, breve (referencia de registro: Nequi). **Code propone; Edgar
decide.** Si una línea no te suena, se revierte al "antes" sin costo.

## Leyenda

- **🎯 apuesta** — el tono fue una apuesta arriesgada. **Revisa estas primero.**
- **🔒 claro** — zona donde el tono suelto NO aplica (errores, confirmaciones
  destructivas, acceso/seguridad, aviso de racha con plazo). Se buscó claridad y
  calidez, nunca ingenio.
- **✂️ quitado** — texto eliminado en vez de reescrito (la interfaz ya lo dice sola).

## Principios aplicados

1. Breve gana a gracioso. 2. No explicar mecánicas (mejor quitar la frase).
3. Jerga con moderación ("parche"/"fría" ya son de la app; sin saturar).
4. Nunca burlarse ni celebrar cuánto tomó. 5. Segunda persona, presente, activa.

---

# 1) Apuestas — revisa estas primero 🎯

| Dónde | Antes | Después |
|---|---|---|
| Leaderboard sin círculo (LeaderboardTabs) | «Todavía no has salido con nadie del parche» + párrafo explicativo (2 líneas) | **«Invita a tu parche y armamos el ranking.»** (T.1: una línea que **invita a actuar**, no describe un estado; sin celebrar cantidad) |
| Detalle de cerveza · encabezado | «Registros recientes» | **«Quién la ha tomado»** |
| Invitar · intro | «FriaDay es solo por invitación. Genera un código y pásaselo a tu parcero. Cada código sirve una sola vez.» | **«FriaDay es solo por invitación. Genera un código y pásaselo a tu parcero.»** (T.1: se conserva "solo por invitación" y "parcero"; solo se quita «Cada código sirve una sola vez») |

# 2) Cambios de tono (zona suelta)

| Dónde | Antes | Después |
|---|---|---|
| Feed vacío (EmptyFeed) — título | «Está seco por aquí» | *(sin cambio — buen tono)* |
| Feed vacío — subtítulo | «Nadie ha registrado nada todavía. La primera salida es la que arranca la costumbre.» | «Nadie ha registrado nada todavía. Empieza tú.» |
| Leaderboard · pie | «Unidades de tus check-ins. Que te etiqueten no acredita cervezas.» / «Cervezas distintas que has probado. Solo cuentan tus salidas.» | **Eliminado (T.1)** — explicaba una mecánica, justo lo que esta pasada quita. El eyebrow «solo salidas propias» se conserva. |
| Crear cerveza (BeerSheet) | «Solo la cervecería es obligatoria. Lo demás se puede completar después, desde el catálogo.» | «Solo la cervecería es obligatoria. El resto lo completas después.» |
| "No tomé ese día" (TagDismissControl) | «No cuenta para tu racha ni para "quién falta".» | «No afecta tu racha.» |
| "No tomé ese día" (TagDismissControl) | «Márcalo y esta etiqueta queda neutra: no rompe tu racha ni te cuenta como que falta registrar.» | «Márcalo y no afecta tu racha.» |
| Detalle de cerveza · vacío | «Todavía nadie la ha registrado.» | «Nadie la ha probado todavía.» |
| Catálogo · búsqueda vacía | «Ninguna cerveza coincide.» | «Nada coincide.» |
| Catálogo · vacío | «El catálogo está vacío. Se irá llenando al registrar cervezas en tus salidas.» | «Todavía sin cervezas.» |
| Invitar · sin códigos | «No tienes códigos disponibles. Genera uno arriba.» | «Ninguno todavía. Genera uno arriba.» |
| Detalle de salida · sin cervezas | «Sin cervezas registradas.» | «Todavía nada por aquí.» |

# 3) Quitado ✂️

| Dónde | Antes | Después |
|---|---|---|
| Detalle de salida (no dueño) | «Estás viendo la salida de {nombre} en solo lectura.» | **Eliminado.** Si no puedes editar, no ves los botones — basta. **Ojo:** esa frase también atribuía de quién era la salida; para no perder eso, cuando la salida es de otro y **tiene lugar**, el dueño se atribuye en el subtítulo: «Salida de {nombre} · {fecha}». Sin lugar, el título ya dice «Salida de {nombre}». |

# 4) Zona clara — calidez sin ingenio 🔒

Cambios donde el texto sonaba a software pero sigue **claro y accionable**:

| Dónde | Antes | Después |
|---|---|---|
| Aviso de plazo vencido (detalle) | «El plazo de 48 h ya venció para quienes faltaron.» | «Ya se venció el plazo.» (quita la mecánica "48 h") |
| Errores de sesión (todas las actions) | «No autenticado» | «Inicia sesión de nuevo» |
| Error de formulario (todas las actions) | «Datos inválidos» | «Revisa los datos» |
| Validación de correo (registro/login/cuenta) | «Email inválido» | «Revisa tu correo» |
| Crear cerveza · nombre | «Nombre requerido» | «Falta el nombre» |
| Crear cerveza · cervecería | «Cervecería requerida» | «Falta la cervecería» |
| Nueva salida · fecha | «Fecha inválida» | «Revisa la fecha» |
| Subir foto · tipo | «Solo se permiten imágenes.» | «Eso no es una imagen.» |

# 5) Sin cambio — ya breves / con buen tono

Se revisaron y se **mantienen** (muestra representativa; el inventario completo se
barrió pantalla por pantalla):

**Marca y taglines:** «El parche lleva la cuenta.» · «El parche lleva la cuenta.
Nadie más está invitado.» · «Está seco por aquí» · «¿Cuál te tomaste?» ·
«¿Quién eres en el parche?» · «Como te dicen» · «Calificála» · «Listo, entrar».

**Etiquetas / botones neutros:** Feed · Catálogo · Perfil · Invitar · Nueva salida ·
Guardar salida · Agregar a la salida · Agregar otra cerveza · Buscar o crear cerveza ·
Hoy / Ayer / Otra fecha · Unidades / Variedad · Mejor calificadas · Formato / Rating /
Foto · Cuándo / Dónde / Con quién · En esta salida · Otra vez · Las cervezas · Notas ·
Por estilo · TOTAL HISTÓRICO / TOTAL DE LA SALIDA · Tu rating / El parche.

**Onboarding (RegisterWizard) — ya cálido y claro:** «Tu código de invitación» ·
«Te lo manda alguien que ya está adentro. Cada código sirve una sola vez.» · «Escoge
un animal. Se puede cambiar cuando quieras — y no hay fotos, así que nadie sale mal.» ·
«¿Y si cambias de teléfono?» · «Sin contraseñas: entras con FaceID…».

**Zona clara que ya estaba bien (🔒, sin tocar):** «Ese código ya fue usado» · «Ese
código ya expiró» · «Email o contraseña incorrectos» · «Es tu única forma de entrar.
Agrega una contraseña o un correo de recuperación antes de eliminarla.» · «¿Borrar
esta salida?» / «Se perderán N check-ins. Esto no se puede deshacer.» / «Sí, borrar» ·
«No se pudo subir la foto. Intenta de nuevo.» · «La foto sigue muy pesada. Prueba con
otra.» · «Esa persona ya está etiquetada» · «Solo puedes descartar tu propia
etiqueta» · «No es tu salida» (guardas defensivas que la UI ya evita mostrar).

**Racha (info con plazo, 🔒):** «Faltas tú» / «Falta {x}» / «Faltan {x} y {y}» ·
«quedan {n} h» / «hasta mañana» / «hasta el {día}» · «plazo vencido» · «N salidas
seguidas registradas».

---

## Notas para Edgar

- **Solo texto:** no se tocó función, layout ni diseño. La única sutileza estructural
  fue mover la atribución del dueño al subtítulo al quitar la frase de solo lectura
  (fila ✂️), para no perder "de quién es la salida".
- **Verificado:** 54/54 tests (ninguno depende de copy visible) + WebKit (ningún
  texto nuevo desborda su contenedor).
