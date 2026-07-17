-- Allow POIs discovered outside enclaves (metro/cuisine sync).
ALTER TABLE "Poi" ALTER COLUMN "communityId" DROP NOT NULL;
