import { clearDemoData } from './clear-data'

export async function clearDatabase(): Promise<{ cleared: string[]; errors: string[] }> {
  return clearDemoData()
}
