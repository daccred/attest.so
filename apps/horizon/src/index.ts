import app from './app'
import { ingestQueue } from './common/queue';

const port = process.env.PORT || 3001
app.listen(port, () => {
  /* eslint-disable no-console */
  console.log(`Listening: http://localhost:${port}`)
  /* eslint-enable no-console */
})
ingestQueue.start();