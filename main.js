const { Command } = require ("commander");
const express = require('express');
const pgpInit = require('pg-promise');
require('dotenv').config();

const dbUser = process.env.DB_USER;
const dbPassword = process.env.DB_PASSWORD;
const dbHost = process.env.DB_HOST;
const dbPort = process.env.DB_PORT;
const dbName = process.env.DB_NAME;


const program = new Command();

program
    .requiredOption("-h, --host <host>", "Server host")
    .requiredOption("-p, --port <port>", "Server port", parseInt)

program.parse(process.argv);
const options = program.opts();

const app = express();
const pgp = pgpInit();
const db = pgp(`postgres://${dbUser}:${dbPassword}@${dbHost}:${dbPort}/${dbName}`)

app.get('/', (req, res) => {
    res.send('Hello world')
    })

app.use('/register', express.json());
app.post('/register', async (req, res) => {
    const { device_name, serial_number } = req.body;

    if(!device_name || !serial_number) {
        return res.status(400).send("Bad request")
    }
    try {
        const existing_device = await db.oneOrNone('SELECT * FROM device WHERE serial_number = $1', [serial_number]);
        if(existing_device) {
            return res.status(400).send("Device is already exist")
        }

        await db.none('INSERT INTO device(device_name, serial_number) VALUES ($1, $2)', [device_name, serial_number]);
        return res.status(201).type("application/json").send("Created")
    } catch (error) {
        console.log(error);
        return res.status(500).send("Server error")
    }
})

app.get('/devices', async (req, res) => {
    try {
        const data = await db.any("SELECT device_name, serial_number FROM device");

        if(data.length == 0) {
            return res.status(404).send("Data not found")
        }

        return res.status(200).send(data)
    } catch (error) {
        console.log(error);
        return res.status(500).send("Server error")
    }
})

app.listen(options.port, options.host, () => {
    console.log(`Server is running on http://${options.host}:${options.port}`)
})