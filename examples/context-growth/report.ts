import { readFile } from 'node:fs/promises'
import { measure } from './measurement.ts'

const file = process.argv[2]
if (!file) throw new Error('Supply a private observations JSON file; do not commit participant data.')
console.log(JSON.stringify(measure(JSON.parse(await readFile(file, 'utf8'))), null, 2))
