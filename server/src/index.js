import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import mongoose from 'mongoose'
import api from './routes/api.js'

const app = express()
app.use(cors({ origin: true, credentials: true }))
app.use(express.json({ limit: '20mb' }))

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.use('/api', api)

const port = Number(process.env.PORT) || 4000
const uri = process.env.MONGODB_URI

if (!uri) {
  console.error('Missing MONGODB_URI')
  process.exit(1)
}

await mongoose.connect(uri)
console.log('MongoDB connected')

app.listen(port, () => {
  console.log(`API http://localhost:${port}`)
})
