export const CARRERAS = [
  { value: "SISTEMAS", label: "Ingeniería en Sistemas Computacionales" },
  { value: "INDUSTRIAL", label: "Ingeniería Industrial" },
  { value: "GESTION", label: "Ingeniería en Gestión Empresarial" },
  { value: "CIVIL", label: "Ingeniería Civil" },
  { value: "ELECTRONICA", label: "Ingeniería Electrónica" },
  { value: "MECATRONICA", label: "Ingeniería Mecatrónica" },
  { value: "ADMINISTRACION", label: "Licenciatura en Administración" },
  { value: "CONTADURIA", label: "Contaduría Pública" },
  { value: "BIOQUIMICA", label: "Ingeniería Bioquímica" },
  { value: "BIOMEDICA", label: "Ingeniería en Biomédica" },
  { value: "LOGISTICA", label: "Ingeniería en Logística" },
] as const;

export const SEMESTRES = Array.from({ length: 12 }, (_, i) => i + 1);

export const LIBRARY_CLOSE_HOUR = 18; // 6 PM
