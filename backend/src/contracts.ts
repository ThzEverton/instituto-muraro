import { z } from 'zod'

export const id = z.string().min(1)
export const role = z.enum(['ADMIN', 'RECEPTION', 'PROFESSIONAL'])
export const loginInput = z.object({ email: z.string().email(), password: z.string().min(8) })
export const patientInput = z.object({ name: z.string().min(2), phone: z.string().optional() }).strict()
export const professionalInput = z.object({ name: z.string().min(2), specialty: z.string().min(2) }).strict()
export const serviceInput = z.object({ name: z.string().min(2), durationMin: z.number().int().positive(), priceCents: z.number().int().nonnegative() }).strict()
export const appointmentInput = z.object({ patientId: id, professionalId: id, serviceId: id, startsAt: z.coerce.date(), endsAt: z.coerce.date() }).strict()
export const appointmentPatch = appointmentInput.partial().strict()
export const blockInput = z.object({ professionalId: id, startsAt: z.coerce.date(), endsAt: z.coerce.date(), kind: z.string().min(2), recurring: z.boolean().default(false) }).strict()
export const templateInput = z.object({ title: z.string().min(2), version: z.number().int().positive(), questions: z.array(z.record(z.string(), z.unknown())) }).strict()
export const chargeInput = z.object({ patientId: id, description: z.string().min(2), amountCents: z.number().int().positive(), dueAt: z.coerce.date() }).strict()
export const paymentInput = z.object({ amountCents: z.number().int().positive() }).strict()
export const recordEntryInput = z.object({ text: z.string().min(2) }).strict()
export const responseInput = z.record(z.string(), z.unknown())
export type Role = z.infer<typeof role>
