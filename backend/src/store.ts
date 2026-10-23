import { randomUUID, createHash, randomBytes } from 'node:crypto'
export type Entity = { id: string; active?: boolean; [key: string]: unknown }
export const db = { patients: [] as Entity[], professionals: [] as Entity[], services: [] as Entity[], appointments: [] as Entity[], blocks: [] as Entity[], templates: [] as Entity[], links: [] as Entity[], responses: [] as Entity[], records: [] as Entity[], charges: [] as Entity[], payments: [] as Entity[], expenses: [] as Entity[], audit: [] as Entity[] }
export const make = (data: Omit<Entity,'id'>) => ({ id: randomUUID(), ...data })
export function overlaps(items: Entity[], professionalId: string, startsAt: Date, endsAt: Date, ignoreId?: string) { return items.some(x => x.id !== ignoreId && x.professionalId === professionalId && new Date(x.startsAt as string) < endsAt && new Date(x.endsAt as string) > startsAt) }
export function tokenPair() { const raw = randomBytes(24).toString('hex'); return { raw, hash: createHash('sha256').update(raw).digest('hex') } }
