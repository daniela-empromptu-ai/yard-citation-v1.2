import { clearProjectData } from './clear-data'

export async function clearDatabase(): Promise<{ cleared: string[]; skipped: string[]; errors: string[] }> {
  return clearProjectData()
}
