-- SC · Turno 6: brillo real de la foto para el alfa del velo del modo-foto (nullable; las fotos
-- ya subidas quedan en NULL → el share-card usa un alfa medio de respaldo).
ALTER TABLE "session_photo" ADD COLUMN     "luminance" DOUBLE PRECISION;
