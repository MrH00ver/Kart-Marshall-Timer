const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.static(__dirname + '/public'));

let remainingSeconds = 900;  // start at 15 min
let sessionStatus = "WAITING";
let lastUpdate = Date.now();
let lastRaceMessage = null;   // store full WS message for laps

// serve JSON for frontend
app.get('/session.json', (req, res) => {
    res.json({
        remainingSeconds,
        sessionStatus,
        connected: Date.now() - lastUpdate < 5000,
        lastRaceMessage
    });
});

app.listen(PORT, () => {
    console.log(`SERVER RUNNING: http://localhost:${PORT}`);
});

const WS_URL = "wss://webserver4.sms-timing.com:10015";
let ws;

function connectWS() {
    ws = new WebSocket(WS_URL);

    ws.on('open', () => {
        console.log("WS CONNECTED");
        ws.send(JSON.stringify({
            $type: "BcStart",
            ClientKey: "teamsportmanchestertraffordpark",
            ResourceId: "19476",
            Timing: true,
            Notifications: true,
            Security: "THIRD PARTY TV"
        }));
    });

    ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());

        if (msg.$type === "BcRace" && typeof msg.ClockMs === "number") {
            remainingSeconds = Math.floor(msg.ClockMs / 1000);
            sessionStatus = msg.RaceState || "RUNNING";
            lastUpdate = Date.now();
            lastRaceMessage = msg; // store full race info for laps
        }
    });

    ws.on('close', () => setTimeout(connectWS, 3000));
    ws.on('error', () => ws.close());
}

connectWS();
