#!/usr/bin/env bun
import { createDefaultIo, main } from './main.ts'

const code = await main(process.argv.slice(2), createDefaultIo())
process.exit(code)
