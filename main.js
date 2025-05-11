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

app.use(express.json());
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

app.post('/take', express.json(), async(req, res) => {
    const { user_name, serial_number } = req.body;
    if (!user_name || !serial_number) {
        return res.status(400).send("Bad request");
    }
    try {
        const device = await db.oneOrNone('SELECT * FROM device WHERE serial_number =$1', [serial_number]);
        if (!device) {
            return res.status(404).send("Device is not found");
        }
        
        if (device.user_name) {
            return res.status(400).send("Device is already taken");
        }

        await db.none(
            'UPDATE device SET user_name = $1 WHERE serial_number = $2',
            [user_name, serial_number]
        );
        return res.status(200).send("Device successfully taken");
    } catch(error) {
        console.log(error);
        return res.status(500).send("Server error")
    }

})

app.post('/return', async (req, res) => {
    const { serial_number } = req.body;
    
    if (!serial_number) {
        return res.status(400).send("Bad request");
    }

    try {
        const device = await db.oneOrNone(
            'SELECT * FROM device WHERE serial_number =$1', [serial_number]
        );
        if (!device) {
            return res.status(404).send("Device not found");
        }

        if(!device.user_name) {
            return res.status(400).send("Device is not in use");
        }

        await db.none(
            'UPDATE device SET user_name = NULL WHERE serial_number = $1', [serial_number]
        );
        return res.status(200).type("application/json").send("Device successfully returned")
    } catch (error){
        console.error(error);
        return res.status(500).send("Server error");
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


app.get('/devices/:serial_number', async (req, res) => {
    const { serial_number } = req.params;

    try {
        const device = await db.oneOrNone(
            'SELECT device_name, user_name FROM device WHERE serial_number = $1',
            [serial_number]
        );

        if (!device) {
            return res.status(404).send("Device not found");
        }

        return res
            .status(200)
            .type("application/json")
            .send({
                device_name: device.device_name,
                user_name: device.user_name || null
            });
    } catch (error) {
        console.error(error);
        return res.status(500).send("Server error");
    }
});


app.listen(options.port, options.host, () => {
    console.log(`Server is running on http://${options.host}:${options.port}`)
})