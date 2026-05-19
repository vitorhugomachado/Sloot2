-- CreateTable
CREATE TABLE "barber_schedule_blocks" (
    "id" SERIAL NOT NULL,
    "barberId" INTEGER NOT NULL,
    "date" TEXT NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "barber_schedule_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_barber_schedule_block_date" ON "barber_schedule_blocks"("barberId", "date");

-- AddForeignKey
ALTER TABLE "barber_schedule_blocks" ADD CONSTRAINT "barber_schedule_blocks_barberId_fkey" FOREIGN KEY ("barberId") REFERENCES "Barber"("id") ON DELETE CASCADE ON UPDATE CASCADE;
