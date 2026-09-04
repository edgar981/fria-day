-- Pasada RK — desacoplar la clave de reacción del glifo.
-- `session_reaction.emoji` deja de guardar el carácter Unicode y pasa a una clave interna
-- ESTABLE; el glifo (SVG) es presentación y puede cambiar sin migrar de nuevo. Mapa
-- explícito, incluyendo 🫡 → 'fiesta' (el matasuegras que reemplazó al saludo).
-- Solo toca los seis valores conocidos; cualquier otro se deja intacto (no debería haber:
-- la UI solo escribió estos seis, verificado por conteo antes de aplicar).
UPDATE "session_reaction" SET "emoji" = 'brindis' WHERE "emoji" = '🍻';
UPDATE "session_reaction" SET "emoji" = 'fuego'   WHERE "emoji" = '🔥';
UPDATE "session_reaction" SET "emoji" = 'risa'    WHERE "emoji" = '😂';
UPDATE "session_reaction" SET "emoji" = 'baba'    WHERE "emoji" = '🤤';
UPDATE "session_reaction" SET "emoji" = 'corazon' WHERE "emoji" = '❤️';
UPDATE "session_reaction" SET "emoji" = 'fiesta'  WHERE "emoji" = '🫡';
