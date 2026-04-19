-- CreateEnum
CREATE TYPE "Sexo" AS ENUM ('M', 'F');

-- CreateEnum
CREATE TYPE "Carrera" AS ENUM ('SISTEMAS', 'INDUSTRIAL', 'GESTION', 'CIVIL', 'ELECTRONICA', 'MECATRONICA', 'ADMINISTRACION', 'CONTADURIA', 'BIOQUIMICA', 'BIOMEDICA', 'LOGISTICA');

-- CreateTable
CREATE TABLE "students" (
    "id" TEXT NOT NULL,
    "numero_control" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido_paterno" TEXT NOT NULL,
    "apellido_materno" TEXT NOT NULL,
    "sexo" "Sexo" NOT NULL,
    "carrera" "Carrera" NOT NULL,
    "semestre" INTEGER NOT NULL,
    "device_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "students_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_records" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "entry_time" TIMESTAMP(3) NOT NULL,
    "exit_time" TIMESTAMP(3),
    "duration_minutes" INTEGER,
    "auto_closed" BOOLEAN NOT NULL DEFAULT false,
    "local_id" TEXT NOT NULL,
    "synced_at" TIMESTAMP(3),

    CONSTRAINT "access_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "survey_responses" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "access_record_id" TEXT NOT NULL,
    "stars" INTEGER NOT NULL,
    "limpieza" INTEGER NOT NULL,
    "mesas" INTEGER NOT NULL,
    "silencio" INTEGER NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "survey_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "students_numero_control_key" ON "students"("numero_control");

-- CreateIndex
CREATE UNIQUE INDEX "access_records_local_id_key" ON "access_records"("local_id");

-- CreateIndex
CREATE INDEX "access_records_student_id_idx" ON "access_records"("student_id");

-- CreateIndex
CREATE INDEX "access_records_entry_time_idx" ON "access_records"("entry_time");

-- CreateIndex
CREATE INDEX "access_records_exit_time_idx" ON "access_records"("exit_time");

-- CreateIndex
CREATE UNIQUE INDEX "survey_responses_access_record_id_key" ON "survey_responses"("access_record_id");

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users"("email");

-- AddForeignKey
ALTER TABLE "access_records" ADD CONSTRAINT "access_records_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_access_record_id_fkey" FOREIGN KEY ("access_record_id") REFERENCES "access_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
