import { consola } from 'consola'

export const logger = consola.create({
  // fancy: true,
  formatOptions: {
    compact: false,
    date: false,
  },
})

export default logger