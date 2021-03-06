const { Router } = require('express')
const { Client } = require('pg')
const { batchCandleJSON } = require('candlestick-convert')
const dayjs = require('dayjs')
const consola = require('consola')

const utc = require('dayjs/plugin/utc')
dayjs.extend(utc)

const router = Router()

router.get('/candles', (req, res) => {
  const user = process.env.DB_USER
  const host = process.env.DB_HOST
  const database = process.env.DB_NAME
  const password = process.env.DB_PASSWORD
  const port = process.env.DB_PORT

  if (user && host && database && port) {
    const client = new Client({
      user,
      host,
      database,
      password,
      port
    })

    client
      .connect()
      .then(() => consola.success('Database connection OK'))
      .catch((err) => {
        consola.error('Database connection error:', err.message)
      })

    const {
      symbol,
      exchange,
      entryTimestamp,
      exitTimestamp,
      selectedTimeframe = null
    } = req.query

    // Add time before start time of first trade
    const entry = dayjs(parseInt(entryTimestamp))
      .utc()
      .subtract(2, 'hour')
      .unix() * 1000

    // Add time after end time of last trade
    const exit = dayjs(parseInt(exitTimestamp))
      .utc()
      .add(2, 'hour')
      .unix() * 1000

    client
      .query(`SELECT timestamp as time,open,high,low,close,volume
            FROM candle
            WHERE symbol='${symbol}'
            AND exchange='${exchange}'
            AND timestamp BETWEEN ${entry} AND ${exit}`)
      .then((result) => {
        const supportedTimeframes = [1, 3, 5, 15, 30, 60, 120, 180, 240, 360, 480, 1440]
        const candlesLength = result.rows.length
        const goal = 10000
        let calculatedFrame = 60

        if (selectedTimeframe) {
          calculatedFrame = selectedTimeframe
        }
        else {
          // Calculate recommended minimum timeframe
          let current = null

          for (let i = 0; i < supportedTimeframes.length; i++) {
            const count = candlesLength / supportedTimeframes[i]

            if (Math.abs(goal - count) < Math.abs(goal - current)) {
              current = count
              calculatedFrame = supportedTimeframes[i]
            }
          }

          if (!current) {
            calculatedFrame = supportedTimeframes[supportedTimeframes.length - 1]
          }
        }

        let candles = batchCandleJSON(result.rows, 60, calculatedFrame * 60)

        candles = candles.map((i) => {
          const item = i
          i.time = i.time / 1000

          return item
        })
        client.end()
        res.json({
          calculatedFrame,
          data: candles
        })
      })
      .catch((err) => {
        client.end()
        res.status(500).json(err.stack)
      })
  }
  else {
    const message = 'There is no database credentials. Don\'t you forget set up .env?'
    consola.error(message)
    res.status(500).json({
      message
    })
  }
})

module.exports = router
