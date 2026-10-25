import { z } from "zod";

export const userRoleSchema = z.enum(["SUPERADMINISTRADOR", "ADMINISTRADOR", "ASESOR"]);
export type UserRole = z.infer<typeof userRoleSchema>;

export const bootstrapAdminSchema = z.object({
  token: z.string().min(32).max(512),
  email: z.string().email().max(150),
  username: z
    .string()
    .trim()
    .min(3)
    .max(80)
    .regex(/^[a-zA-Z0-9._-]+$/),
  names: z.string().trim().min(3).max(120),
  password: z.string().min(12).max(128),
});

export type BootstrapAdminInput = z.infer<typeof bootstrapAdminSchema>;

export const loginSchema = z.object({
  identifier: z.string().trim().min(3).max(150),
  password: z.string().min(1).max(128),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const managedUserSchema = z.object({
  names: z.string().trim().min(3).max(120),
  username: z.string().trim().min(3).max(80).regex(/^[a-zA-Z0-9._-]+$/),
  email: z.string().email().max(150),
  role: z.enum(["ADMINISTRADOR", "ASESOR"]),
  password: z.string().min(12).max(128),
});
export type ManagedUserInput = z.infer<typeof managedUserSchema>;

export function collapseWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function toTitleCase(value: string): string {
  return collapseWhitespace(value)
    .toLocaleLowerCase("es-PE")
    .replace(/(^|\s)\S/g, (letter) => letter.toLocaleUpperCase("es-PE"));
}

export function normalizePlate(value: string): string {
  const raw = value.replace(/[^0-9A-Za-z]/g, "").toUpperCase();
  if (/^EPA\d{3}$/.test(raw)) return `EPA-${raw.slice(3)}`;
  if (/^E[A-Z]{3}\d{3}$/.test(raw))
    return `E ${raw.slice(1, 4)}-${raw.slice(4)}`;
  if (/^E[A-Z]{2}\d{3}$/.test(raw))
    return `E ${raw.slice(1, 3)}-${raw.slice(3)}`;
  if (/^(CD|CC)\d{4}$/.test(raw)) return `${raw.slice(0, 2)}-${raw.slice(2)}`;
  if (/^PR\d{3}$/.test(raw)) return `PR-${raw.slice(2)}`;
  if (/^[A-Z]{2}\d{4,5}$/.test(raw))
    return `${raw.slice(0, 2)}-${raw.slice(2)}`;
  if (/^[A-Z]\d[A-Z]\d{3,4}$/.test(raw))
    return `${raw.slice(0, 3)}-${raw.slice(3)}`;
  if (/^[A-Z]{3}\d{3,4}$/.test(raw))
    return `${raw.slice(0, 3)}-${raw.slice(3)}`;
  return raw;
}

export function isRecognizedPlate(value: string): boolean {
  const raw = value.replace(/[^0-9A-Za-z]/g, "").toUpperCase();
  return (
    /^EPA\d{3}$/.test(raw) ||
    /^E[A-Z]{2,3}\d{3}$/.test(raw) ||
    /^(CD|CC)\d{4}$/.test(raw) ||
    /^PR\d{3}$/.test(raw) ||
    /^[A-Z]{2}\d{4,5}$/.test(raw) ||
    /^[A-Z]\d[A-Z]\d{3,4}$/.test(raw) ||
    /^[A-Z]{3}\d{3,4}$/.test(raw)
  );
}

const humanText = (min: number, max: number) =>
  z.string().transform(collapseWhitespace).pipe(z.string().min(min).max(max));
const optionalText = (max: number) =>
  z
    .string()
    .transform(collapseWhitespace)
    .pipe(z.string().max(max))
    .optional()
    .transform((value) => value || undefined);
const digitText = z.string().transform((value) => value.replace(/\D/g, ""));

// Preserve the reception form's existing email rules with a linear scan.
export function isReceptionEmail(value: string): boolean {
  const at = value.indexOf("@");
  if (at < 1 || at !== value.lastIndexOf("@") || /\s/.test(value)) return false;
  const domain = value.slice(at + 1);
  const dot = domain.indexOf(".", 1);
  return dot > 0 && dot < domain.length - 1;
}
const optionalNumericText = (pattern: RegExp, message: string) =>
  z
    .union([z.string(), z.number()])
    .optional()
    .transform((value) =>
      value === undefined || value === "" ? undefined : String(value),
    )
    .refine((value) => !value || pattern.test(value), { message })
    .transform((value) => (value ? Number(value) : undefined));

export const receptionStepOneSchema = z
  .object({
    documentType: z.enum(["DNI", "RUC"]),
    documentNumber: digitText,
    fullName: z
      .string()
      .transform(toTitleCase)
      .pipe(z.string().min(1).max(160)),
    phone: z
      .string()
      .transform((value) => value.replace(/\D/g, ""))
      .pipe(z.string().max(15))
      .optional()
      .transform((value) => value || undefined),
    email: optionalText(150),
    plate: z.string().transform(normalizePlate).pipe(z.string().min(5).max(9)),
    modality: z.enum([
      "PARTICULAR",
      "PACIFICO",
      "MAPFRE",
      "LA_POSITIVA",
      "RIMAC",
      "QUALITAS",
    ]),
    claimNumber: optionalText(60),
    claimPendingReminder: z.boolean(),
    brand: humanText(1, 80).transform((value) => value.toUpperCase()),
    model: humanText(1, 80).transform((value) => value.toUpperCase()),
    color: humanText(2, 60),
    colorType: z.enum(["CATALOGO", "PERSONALIZADO"]),
    year: optionalNumericText(
      /^(19|20)\d{2}$/,
      "El año debe tener 4 dígitos (1900-2099).",
    ),
    vin: z
      .string()
      .transform((value) => value.replace(/[^A-Za-z0-9]/g, "").toUpperCase())
      .pipe(z.string().max(17))
      .optional()
      .transform((value) => value || undefined),
    mileage: optionalNumericText(
      /^\d{1,7}$/,
      "El kilometraje debe ser numérico y tener hasta 7 dígitos.",
    ),
    bodyTypeId: z.coerce.number().int().positive(),
  })
  .superRefine((value, context) => {
    const documentPattern =
      value.documentType === "DNI" ? /^\d{8}$/ : /^\d{11}$/;
    if (!documentPattern.test(value.documentNumber))
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["documentNumber"],
        message:
          value.documentType === "DNI"
            ? "El DNI debe tener 8 dígitos."
            : "El RUC debe tener 11 dígitos.",
      });
    if (value.phone && !/^\d{7,15}$/.test(value.phone))
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["phone"],
        message: "El celular debe tener entre 7 y 15 dígitos.",
      });
    if (value.email && !isReceptionEmail(value.email))
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["email"],
        message: "El correo no es válido.",
      });
    if (!/^[A-HJ-NPR-Z0-9]{17}$/i.test(value.vin ?? "") && value.vin)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["vin"],
        message: "El VIN debe tener 17 caracteres válidos.",
      });
    if (
      value.colorType === "PERSONALIZADO" &&
      !/^[A-Za-zÀ-ÿ ]{2,40}$/.test(value.color)
    )
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["color"],
        message: "El color personalizado debe tener entre 2 y 40 letras.",
      });
    if (
      value.modality !== "PARTICULAR" &&
      !value.claimNumber &&
      !value.claimPendingReminder
    )
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["claimNumber"],
        message: "El siniestro es obligatorio para aseguradoras.",
      });
  });

export const createOrderSchema = z
  .object({
    client: z.object({
      documentType: z.enum(["DNI", "RUC"]),
      documentNumber: z.string().regex(/^\d{8}$|^\d{11}$/),
      fullName: z.string().trim().min(3).max(160),
      phone: z.string().trim().max(20).optional(),
      email: z.string().trim().email().max(150).optional(),
    }),
    vehicle: z.object({
      plate: z.string().trim().min(5).max(9),
      brand: z.string().trim().min(1).max(80),
      model: z.string().trim().min(1).max(80),
      year: z.coerce.number().int().min(1900).max(2099).optional(),
      vin: z.string().trim().length(17).optional(),
      color: z.string().trim().min(2).max(60),
      colorType: z.enum(["CATALOGO", "PERSONALIZADO"]),
      bodyTypeId: z.coerce.number().int().positive(),
    }),
    modality: z.enum([
      "PARTICULAR",
      "PACIFICO",
      "MAPFRE",
      "LA_POSITIVA",
      "RIMAC",
      "QUALITAS",
    ]),
    claimNumber: z.string().trim().max(60).optional(),
    claimPendingReminder: z.boolean().default(false),
    diagnosisPendingReminder: z.boolean().default(false),
    mileage: z.coerce.number().int().min(0).max(9999999).optional(),
    fuelLevel: z
      .union([
        z.literal(0),
        z.literal(25),
        z.literal(50),
        z.literal(75),
        z.literal(100),
      ])
      .optional(),
    considerations: z
      .array(z.string().trim().min(1).max(300))
      .max(30)
      .default([]),
    damages: z
      .array(
        z.object({
          body: z.enum(["V1", "V2", "V3", "V4"]),
          view: z.enum(["01", "02", "03", "04", "05"]),
          path: z
            .array(
              z.object({
                u: z.number().min(0).max(1),
                v: z.number().min(0).max(1),
              }),
            )
            .min(1),
          description: z.string().trim().max(300).optional(),
        }),
      )
      .max(100)
      .default([]),
    diagnosis: z.string().trim().max(10000).optional(),
    diagnosisLegibility: z
      .enum(["PENDIENTE", "LEGIBLE", "ILEGIBLE"])
      .default("PENDIENTE"),
    diagnosisReviewState: z
      .enum(["PENDIENTE_REVISION", "REVISADA"])
      .default("PENDIENTE_REVISION"),
    checklistReviewed: z.literal(true),
    signature: z.string().regex(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/),
    checklist: z.array(
      z.object({
        itemId: z.coerce.number().int().positive(),
        answer: z.enum(["SI", "NO"]),
        observation: z.string().trim().max(300).optional(),
      }),
    ),
    acceptedTerms: z.literal(true),
  })
  .superRefine((value, context) => {
    const validation = receptionStepOneSchema.safeParse({
      documentType: value.client.documentType,
      documentNumber: value.client.documentNumber,
      fullName: value.client.fullName,
      phone: value.client.phone,
      email: value.client.email,
      plate: value.vehicle.plate,
      modality: value.modality,
      claimNumber: value.claimNumber,
      claimPendingReminder: value.claimPendingReminder,
      brand: value.vehicle.brand,
      model: value.vehicle.model,
      color: value.vehicle.color,
      colorType: value.vehicle.colorType,
      year: value.vehicle.year,
      vin: value.vehicle.vin,
      mileage: value.mileage,
      bodyTypeId: value.vehicle.bodyTypeId,
    });
    if (!validation.success)
      for (const issue of validation.error.issues)
        context.addIssue({ code: "custom", path: issue.path, message: issue.message });
  });

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export const operationalDataSchema = z.object({
  phoneOverride: z
    .string()
    .transform((value) => value.replace(/\D/g, ""))
    .pipe(z.string().max(15))
    .optional()
    .transform((value) => value || undefined),
  emailOverride: optionalText(150),
  modality: z.enum(["PARTICULAR", "PACIFICO", "MAPFRE", "LA_POSITIVA", "RIMAC", "QUALITAS"]).optional(),
  claimNumber: optionalText(60),
  claimPendingReminder: z.boolean(),
  reason: z.string().transform(collapseWhitespace).pipe(z.string().min(1).max(500)),
}).superRefine((value, context) => {
  if (value.phoneOverride && !/^\d{7,15}$/.test(value.phoneOverride))
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["phoneOverride"], message: "El celular debe tener entre 7 y 15 dígitos." });
  if (value.emailOverride && !isReceptionEmail(value.emailOverride))
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["emailOverride"], message: "El correo no es válido." });
});

export type OperationalDataInput = z.infer<typeof operationalDataSchema>;

export type CurrentUser = {
  id: number;
  names: string;
  username: string;
  email: string;
  role: UserRole;
};

export type ApiError = {
  error: {
    code: string;
    message: string;
    requestId?: string;
  };
};

/** Identity as recorded at reception, independent from mutable master records. */
export type ReceptionIdentitySnapshot = {
  client: string; documentType: string; documentNumber: string;
  phone?: string; email?: string; plate: string; brand: string; model: string;
  year?: number; vin?: string; color: string; colorType: string;
  bodyCode: string; bodyName: string; modality: string; claimNumber?: string;
  advisorName?: string; receivedAt: string;
};
export type ReceptionSnapshot = {
  source: "RECEPTION" | "LEGACY_BASELINE";
  capturedAt: string;
  payload: ReceptionIdentitySnapshot;
};
