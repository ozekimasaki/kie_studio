/**
 * CLI: npm run sync:models
 */
import { syncCatalog } from '../server/catalog/sync.ts'

const force = process.argv.includes('--force')

syncCatalog({ force, quiet: false })
  .then((result) => {
    if (result.skipped) {
      console.log(`Skipped: ${result.reason}`)
      console.log('Use --force to sync anyway.')
      return
    }
    console.log('Done.')
  })
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
