import { roboticsCandidateMap } from '../lib/robotics-knowledge.ts'
import { roboticsDigest } from '../lib/robotics-evidence.ts'
const candidates = roboticsCandidateMap()
console.log(JSON.stringify({ version: 'robotics-map/0.2', candidates, digest: roboticsDigest(candidates) }, null, 2))
