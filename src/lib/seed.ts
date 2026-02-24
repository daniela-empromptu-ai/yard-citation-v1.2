import { seedDemoData } from './seed-data'

export async function seedDatabase(): Promise<{ inserted: number; errors: string[] }> {
  return seedDemoData()
}
