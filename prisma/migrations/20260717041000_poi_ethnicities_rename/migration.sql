-- RenameColumn
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Poi' AND column_name = 'ethnicityFlags'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Poi' AND column_name = 'ethnicities'
  ) THEN
    ALTER TABLE "Poi" RENAME COLUMN "ethnicityFlags" TO "ethnicities";
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Poi' AND column_name = 'ethnicities'
  ) THEN
    ALTER TABLE "Poi" ADD COLUMN "ethnicities" TEXT[] DEFAULT ARRAY[]::TEXT[];
  END IF;
END $$;
